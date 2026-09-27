// What the pit laptop has decoded but the relay hasn't confirmed yet.
//
// The track connection is a phone hotspot, so the socket drops, and worse, it
// can go quiet without closing. Frames therefore stay here until the relay has
// provably received them: a "ping" is sent after the frames, the relay's
// "pong" comes back on the same ordered connection, so a pong confirms every
// message sent before its ping. When the socket is lost, whatever wasn't
// confirmed goes back to the front of the queue and is sent again, oldest
// first. A frame the relay already had is harmless twice: it keeps only newer
// frames and viewers do the same.

import { MAX_MESSAGE_BYTES, type LiveFrame } from "./liveTelemetry";

export type OutboxOptions = {
  /** Kept under the relay's 16 KB limit with room to spare. */
  maxMessageBytes?: number;
  /** Past this, the oldest unsent frames are dropped (the recording keeps them). */
  maxQueuedFrames?: number;
};

export type OutboxStats = {
  /** Waiting to be sent. */
  queued: number;
  /** Sent, not yet confirmed by a pong. */
  unconfirmed: number;
  /** Confirmed by the relay, in total. */
  confirmed: number;
  /** Dropped because the queue was full. */
  dropped: number;
  /** receivedAt of the oldest frame waiting to be sent, in ms, or null. */
  oldestQueued: number | null;
};

export class Outbox {
  readonly session: string;
  private readonly maxMessageBytes: number;
  private readonly maxQueuedFrames: number;
  private seq = 0;
  /** Serialised frames, oldest first. */
  private queue: string[] = [];
  private inFlight: { seq: number; frames: string[] }[] = [];
  /** For each ping still unanswered, the first seq sent after it. */
  private pings: number[] = [];
  private confirmed = 0;
  private dropped = 0;

  constructor(session: string, options: OutboxOptions = {}) {
    this.session = session;
    this.maxMessageBytes = Math.min(options.maxMessageBytes ?? 12_000, MAX_MESSAGE_BYTES);
    // About 20 minutes of fast packets at 10 Hz.
    this.maxQueuedFrames = options.maxQueuedFrames ?? 12_000;
  }

  push(frames: readonly LiveFrame[]): void {
    for (const frame of frames) this.queue.push(JSON.stringify(frame));
    this.trim();
  }

  /**
   * Up to `limit` messages ready to send, each as full as the size limit
   * allows. They count as in flight from here on.
   */
  take(limit: number): string[] {
    const messages: string[] = [];
    while (messages.length < limit && this.queue.length > 0) {
      const head = `{"t":"frames","session":${JSON.stringify(this.session)},"seq":${this.seq},"frames":[`;
      const tail = "]}";
      let size = head.length + tail.length;
      let count = 0;
      while (count < this.queue.length) {
        // Frames are ASCII (numbers, keys, ISO times), so characters are bytes.
        const next = this.queue[count].length + (count > 0 ? 1 : 0);
        if (count > 0 && size + next > this.maxMessageBytes) break;
        size += next;
        count += 1;
      }
      const frames = this.queue.splice(0, count);
      this.inFlight.push({ seq: this.seq, frames });
      messages.push(head + frames.join(",") + tail);
      this.seq += 1;
    }
    return messages;
  }

  /** Call as a ping is sent. */
  pinged(): void {
    this.pings.push(this.seq);
  }

  /** Call when a pong arrives: everything sent before its ping has landed. */
  ponged(): void {
    const mark = this.pings.shift();
    if (mark === undefined) return;
    const landed = this.inFlight.filter((message) => message.seq < mark);
    this.inFlight = this.inFlight.filter((message) => message.seq >= mark);
    for (const message of landed) this.confirmed += message.frames.length;
  }

  /** How many pings are still waiting for their pong. */
  get unansweredPings(): number {
    return this.pings.length;
  }

  /** The socket is gone: anything unconfirmed goes back in line, oldest first. */
  connectionLost(): void {
    const resend = this.inFlight.flatMap((message) => message.frames);
    this.queue = resend.concat(this.queue);
    this.inFlight = [];
    this.pings = [];
    this.trim();
  }

  stats(): OutboxStats {
    return {
      queued: this.queue.length,
      unconfirmed: this.inFlight.reduce((n, message) => n + message.frames.length, 0),
      confirmed: this.confirmed,
      dropped: this.dropped,
      oldestQueued: this.queue.length ? Date.parse((JSON.parse(this.queue[0]) as LiveFrame).receivedAt) : null,
    };
  }

  private trim(): void {
    const over = this.queue.length - this.maxQueuedFrames;
    if (over > 0) {
      this.queue.splice(0, over);
      this.dropped += over;
    }
  }
}

/**
 * Gives each frame a strictly increasing receivedAt. Several frames can come
 * out of one serial read in the same millisecond, and the relay keeps a frame
 * only if it is newer than the one it holds, so a tie would lose the later one.
 */
export function createStamper(): (now: number) => string {
  let last = -Infinity;
  return (now) => {
    last = Math.max(now, last + 1);
    return new Date(last).toISOString();
  };
}
