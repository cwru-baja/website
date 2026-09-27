import { DurableObject } from "cloudflare:workers";

import {
  CLOSE_REPLACED,
  CLOSE_UNAUTHORIZED,
  HELLO_TIMEOUT_MS,
  PING,
  PONG,
  type Latest,
  type LiveFrame,
  type PublisherStatus,
  type ViewerMessage,
} from "./protocol";
import { mergeLatest, parsePublisherMessage, tokensMatch } from "./state";

// What each socket carries through hibernation. Tags are fixed when a socket
// is accepted, so a publisher is tagged "publisher" from the start and its
// attachment says whether it has authenticated yet.
type Attachment =
  | { role: "publisher"; id: string; authed: boolean; openedAt: number }
  | { role: "viewer" };

type Stored = { latest: Latest; lastSeenAt: string | null };

const STATE_KEY = "state";

// Storage is written at most this often. Workers Free allows 100,000 row
// writes a day; one write per frame at 10 Hz would spend that in under three
// hours, one a second lasts a whole day of racing.
const PERSIST_INTERVAL_MS = 1_000;

export type Health = { viewers: number; publisher: PublisherStatus };

/**
 * The one relay instance (the Worker always asks for "car"). The publisher's
 * frames go straight out to every viewer, and the newest frame of each kind is
 * kept so a viewer who joins mid-race gets a snapshot at once.
 *
 * Every socket goes through the Hibernation API, so an idle relay with viewers
 * attached costs nothing: it sleeps, and the constructor runs again on the next
 * message. That is why latest is reloaded from storage below.
 */
export class LiveRelay extends DurableObject<Env> {
  private latest: Latest;
  private lastSeenAt: string | null;
  private lastPersistAt = 0;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const stored = ctx.storage.kv.get<Stored>(STATE_KEY);
    this.latest = stored?.latest ?? {};
    this.lastSeenAt = stored?.lastSeenAt ?? null;
    // Keepalives are answered by the runtime and never wake the relay.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING, PONG));
  }

  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);
    const [client, server] = Object.values(new WebSocketPair());

    if (pathname === "/publish") {
      const attachment: Attachment = {
        role: "publisher",
        id: crypto.randomUUID(),
        authed: false,
        openedAt: Date.now(),
      };
      this.ctx.acceptWebSocket(server, ["publisher"]);
      server.serializeAttachment(attachment);
      await this.armHelloDeadline(attachment.openedAt + HELLO_TIMEOUT_MS);
    } else {
      this.ctx.acceptWebSocket(server, ["viewer"]);
      server.serializeAttachment({ role: "viewer" } satisfies Attachment);
      send(server, { t: "snapshot", latest: this.latest, publisher: this.publisherStatus() });
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const attachment = ws.deserializeAttachment() as Attachment | null;
    // Viewers are receive-only: whatever they send (bar the auto-answered
    // ping) is ignored, so no viewer can reach another.
    if (attachment?.role !== "publisher") return;

    const message = parsePublisherMessage(raw);

    if (!attachment.authed) {
      const inTime = Date.now() - attachment.openedAt <= HELLO_TIMEOUT_MS;
      const authed =
        message?.t === "hello" &&
        inTime &&
        (await tokensMatch(message.token, this.env.LIVE_PUBLISH_TOKEN));
      if (!authed) {
        close(ws, CLOSE_UNAUTHORIZED, "Unauthorized");
        return;
      }
      // One publisher at a time: the newest one wins.
      for (const other of this.authedPublishers()) {
        if (other.attachment.id === attachment.id) continue;
        other.ws.serializeAttachment({ ...other.attachment, authed: false });
        close(other.ws, CLOSE_REPLACED, "Replaced by a newer publisher");
      }
      ws.serializeAttachment({ ...attachment, authed: true } satisfies Attachment);
      this.broadcast({ t: "publisher", ...this.publisherStatus() });
      return;
    }

    if (message?.t !== "frames" || message.frames.length === 0) return;
    this.acceptFrames(message.frames);
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    // The runtime has already finished the close handshake
    // (web_socket_auto_reply_to_close, on from compatibility date 2026-04-07).
    this.publisherGone(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    this.publisherGone(ws);
  }

  /**
   * Closes publishers that haven't said hello in time. An alarm rather than a
   * setTimeout, so a silent socket doesn't keep the relay from hibernating.
   * (Under `wrangler dev` the client gets the 4001 close frame on time, but its
   * close event only fires ~10 s later, when the connection is torn down.)
   */
  async alarm(): Promise<void> {
    const now = Date.now();
    let next = Infinity;
    for (const ws of this.ctx.getWebSockets("publisher")) {
      const attachment = ws.deserializeAttachment() as Attachment | null;
      if (attachment?.role !== "publisher" || attachment.authed) continue;
      const deadline = attachment.openedAt + HELLO_TIMEOUT_MS;
      if (deadline <= now) close(ws, CLOSE_UNAUTHORIZED, "No hello");
      else next = Math.min(next, deadline);
    }
    if (next < Infinity) await this.ctx.storage.setAlarm(next);
  }

  /** For GET /health. */
  health(): Health {
    return {
      viewers: this.ctx.getWebSockets("viewer").length,
      publisher: this.publisherStatus(),
    };
  }

  private acceptFrames(frames: LiveFrame[]): void {
    this.lastSeenAt = new Date().toISOString();
    this.latest = mergeLatest(this.latest, frames);
    // Viewers get every valid frame, backfill included. They apply the same
    // newer-only rule to what they display.
    this.broadcast({ t: "frames", frames });
    this.schedulePersist();
    // History seam: this is the one place every accepted frame passes. To keep
    // a race log, buffer frames here and flush batches (say every 30 s, keyed
    // by the publisher's session and seq) to R2 from the persist timer.
  }

  /** There is one alarm per object; keep it at the earliest open deadline. */
  private async armHelloDeadline(deadline: number): Promise<void> {
    const current = await this.ctx.storage.getAlarm();
    if (current === null || current > deadline) await this.ctx.storage.setAlarm(deadline);
  }

  private publisherGone(ws: WebSocket): void {
    const attachment = ws.deserializeAttachment() as Attachment | null;
    if (attachment?.role !== "publisher" || !attachment.authed) return;
    ws.serializeAttachment({ ...attachment, authed: false } satisfies Attachment);
    this.persist();
    if (this.authedPublishers().length === 0) {
      this.broadcast({ t: "publisher", ...this.publisherStatus() });
    }
  }

  private authedPublishers() {
    return this.ctx.getWebSockets("publisher").flatMap((ws) => {
      const attachment = ws.deserializeAttachment() as Attachment | null;
      return attachment?.role === "publisher" && attachment.authed ? [{ ws, attachment }] : [];
    });
  }

  private publisherStatus(): PublisherStatus {
    return { connected: this.authedPublishers().length > 0, lastSeenAt: this.lastSeenAt };
  }

  private broadcast(message: ViewerMessage): void {
    const text = JSON.stringify(message);
    for (const ws of this.ctx.getWebSockets("viewer")) {
      try {
        ws.send(text);
      } catch {
        // Closing under us; its close handler tidies up.
      }
    }
  }

  /** Writes now if the last write was long enough ago, otherwise once it is. */
  private schedulePersist(): void {
    const wait = this.lastPersistAt + PERSIST_INTERVAL_MS - Date.now();
    if (wait <= 0) {
      this.persist();
    } else if (!this.persistTimer) {
      this.persistTimer = setTimeout(() => this.persist(), wait);
    }
  }

  private persist(): void {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = null;
    this.lastPersistAt = Date.now();
    this.ctx.storage.kv.put<Stored>(STATE_KEY, { latest: this.latest, lastSeenAt: this.lastSeenAt });
  }
}

function send(ws: WebSocket, message: ViewerMessage): void {
  try {
    ws.send(JSON.stringify(message));
  } catch {
    // Already closing.
  }
}

function close(ws: WebSocket, code: number, reason: string): void {
  try {
    ws.close(code, reason);
  } catch {
    // Already closed.
  }
}
