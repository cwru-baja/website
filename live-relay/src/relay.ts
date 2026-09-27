import { DurableObject } from "cloudflare:workers";

import {
  CLOSE_LOCKED_OUT,
  CLOSE_REPLACED,
  CLOSE_UNAUTHORIZED,
  HELLO_TIMEOUT_MS,
  PING,
  PONG,
  type Latest,
  type LiveFrame,
  type PublisherStatus,
  type RelayToPublisherMessage,
  type ViewerMessage,
} from "./protocol";
import {
  addFailure,
  isLockedOut,
  mergeLatest,
  parsePublisherMessage,
  tokensMatch,
  type Failures,
} from "./state";

// What each socket carries through hibernation. Tags are fixed when a socket
// is accepted, so it is tagged with its role from the start and its attachment
// says whether its password has matched yet. Until then it gets nothing.
type Role = "publisher" | "viewer";
type Attachment = { role: Role; id: string; ip: string; authed: boolean; openedAt: number };

type Stored = { latest: Latest; lastSeenAt: string | null };

const STATE_KEY = "state";
/** Wrong tokens per address live under fail:<ip>. Written only on a failure. */
const failuresKey = (ip: string) => `fail:${ip}`;

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
 * Both doors are password-protected. A publisher's first message must carry
 * LIVE_PUBLISH_TOKEN (the team password typed into /host); a viewer's must
 * carry LIVE_WATCH_TOKEN (the watch password typed into /live), or the team
 * password, so the pit crew needs only one.
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
    const role: Role = pathname === "/publish" ? "publisher" : "viewer";
    const attachment: Attachment = {
      role,
      id: crypto.randomUUID(),
      ip: request.headers.get("CF-Connecting-IP") ?? "unknown",
      authed: false,
      openedAt: Date.now(),
    };
    this.ctx.acceptWebSocket(server, [role]);
    server.serializeAttachment(attachment);
    // Accepted and then closed, rather than refused, so the page can tell
    // "locked out" from "no internet".
    if (isLockedOut(this.ctx.storage.kv.get<Failures>(failuresKey(attachment.ip)), attachment.openedAt)) {
      close(server, CLOSE_LOCKED_OUT, "Too many wrong passwords. Try again in a few minutes.");
    } else {
      await this.armHelloDeadline(attachment.openedAt + HELLO_TIMEOUT_MS);
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const attachment = ws.deserializeAttachment() as Attachment | null;
    if (!attachment) return;
    const message = parsePublisherMessage(raw);

    if (!attachment.authed) {
      const inTime = Date.now() - attachment.openedAt <= HELLO_TIMEOUT_MS;
      const authed =
        message?.t === "hello" && inTime && (await this.passwordFits(attachment.role, message.token));
      if (!authed) {
        // Only a wrong token counts toward the lockout; a slow hello doesn't.
        if (message?.t === "hello" && inTime) {
          const key = failuresKey(attachment.ip);
          this.ctx.storage.kv.put(key, addFailure(this.ctx.storage.kv.get<Failures>(key), Date.now()));
        }
        close(ws, CLOSE_UNAUTHORIZED, "Unauthorized");
        return;
      }
      this.ctx.storage.kv.delete(failuresKey(attachment.ip));
      ws.serializeAttachment({ ...attachment, authed: true } satisfies Attachment);
      if (attachment.role === "viewer") {
        send(ws, { t: "snapshot", latest: this.latest, publisher: this.publisherStatus() });
        return;
      }
      // One publisher at a time: the newest one wins.
      for (const other of this.authedPublishers()) {
        if (other.attachment.id === attachment.id) continue;
        other.ws.serializeAttachment({ ...other.attachment, authed: false });
        close(other.ws, CLOSE_REPLACED, "Replaced by a newer publisher");
      }
      try {
        ws.send(JSON.stringify({ t: "ready" } satisfies RelayToPublisherMessage));
      } catch {
        // Gone already; its close handler tidies up.
      }
      this.broadcast({ t: "publisher", ...this.publisherStatus() });
      return;
    }

    // Viewers are receive-only: whatever they send after the hello (bar the
    // auto-answered ping) is ignored, so no viewer can reach another.
    if (attachment.role !== "publisher") return;
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
   * Closes sockets that haven't given a password in time. An alarm rather than a
   * setTimeout, so a silent socket doesn't keep the relay from hibernating.
   * (Under `wrangler dev` the client gets the 4001 close frame on time, but its
   * close event only fires ~10 s later, when the connection is torn down.)
   */
  async alarm(): Promise<void> {
    const now = Date.now();
    let next = Infinity;
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = ws.deserializeAttachment() as Attachment | null;
      if (!attachment || attachment.authed) continue;
      const deadline = attachment.openedAt + HELLO_TIMEOUT_MS;
      if (deadline <= now) close(ws, CLOSE_UNAUTHORIZED, "No hello");
      else next = Math.min(next, deadline);
    }
    if (next < Infinity) await this.ctx.storage.setAlarm(next);
  }

  /** For GET /health. */
  health(): Health {
    return {
      viewers: this.authed("viewer").length,
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
    return this.authed("publisher");
  }

  private authed(role: Role) {
    return this.ctx.getWebSockets(role).flatMap((ws) => {
      const attachment = ws.deserializeAttachment() as Attachment | null;
      return attachment?.authed ? [{ ws, attachment }] : [];
    });
  }

  /** The watch password lets you watch; the team password lets you do either. */
  private async passwordFits(role: Role, token: string): Promise<boolean> {
    if (await tokensMatch(token, this.env.LIVE_PUBLISH_TOKEN)) return true;
    return role === "viewer" && (await tokensMatch(token, this.env.LIVE_WATCH_TOKEN));
  }

  private publisherStatus(): PublisherStatus {
    return { connected: this.authedPublishers().length > 0, lastSeenAt: this.lastSeenAt };
  }

  private broadcast(message: ViewerMessage): void {
    const text = JSON.stringify(message);
    for (const { ws } of this.authed("viewer")) {
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
