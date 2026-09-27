// The relay's decisions, kept free of Workers APIs so they run under plain
// vitest: what counts as a valid message, which frame is the newest, and
// whether a token matches.

import {
  FRAME_KINDS,
  MAX_MESSAGE_BYTES,
  type FrameKind,
  type Latest,
  type LiveFrame,
  type TelemetryPacket,
} from "./protocol";

export type ParsedPublisherMessage =
  | { t: "hello"; token: string; v: 1 }
  | { t: "frames"; session: string | null; seq: number | null; frames: LiveFrame[] };

const encoder = new TextEncoder();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFrameKind(value: unknown): value is FrameKind {
  return typeof value === "string" && (FRAME_KINDS as readonly string[]).includes(value);
}

/** Numbers, or null: JSON turns NaN (no GPS fix, no signal reading) into null. */
function isNumberish(value: unknown): boolean {
  return value === null || typeof value === "number";
}

/** Milliseconds since the epoch, or NaN when receivedAt is not a date. */
export function frameTime(frame: Pick<LiveFrame, "receivedAt">): number {
  return Date.parse(frame.receivedAt);
}

/**
 * A frame is kept when its kind is known, its packet is of that kind and its
 * time parses. The packet's fields are not checked one by one: viewers treat
 * anything that isn't a finite number as missing, so a bad field costs a blank
 * reading, not a crash.
 */
export function parseFrame(value: unknown): LiveFrame | null {
  if (!isRecord(value)) return null;
  const { kind, receivedAt, rssi, snr, packet } = value;
  if (!isFrameKind(kind)) return null;
  if (typeof receivedAt !== "string" || !Number.isFinite(Date.parse(receivedAt))) return null;
  if (!isNumberish(rssi) || !isNumberish(snr)) return null;
  if (!isRecord(packet) || packet.type !== kind) return null;
  return {
    kind,
    receivedAt,
    rssi: rssi as number,
    snr: snr as number,
    packet: packet as TelemetryPacket,
  };
}

/**
 * Parses one publisher message. Returns null for anything to drop: binary,
 * oversized, not JSON, or not a hello/frames message. Frames that fail
 * parseFrame are dropped one by one; the rest of their batch still counts.
 */
export function parsePublisherMessage(raw: string | ArrayBuffer): ParsedPublisherMessage | null {
  if (typeof raw !== "string") return null;
  // A UTF-16 unit is at least one UTF-8 byte, so the cheap check goes first.
  if (raw.length > MAX_MESSAGE_BYTES || encoder.encode(raw).byteLength > MAX_MESSAGE_BYTES) {
    return null;
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value)) return null;

  if (value.t === "hello") {
    if (typeof value.token !== "string" || value.v !== 1) return null;
    return { t: "hello", token: value.token, v: 1 };
  }

  if (value.t === "frames") {
    if (!Array.isArray(value.frames)) return null;
    const frames = value.frames.map(parseFrame).filter((frame) => frame !== null);
    return {
      t: "frames",
      session: typeof value.session === "string" ? value.session : null,
      seq: typeof value.seq === "number" ? value.seq : null,
      frames,
    };
  }

  return null;
}

/**
 * Folds frames into the latest-of-each-kind. A frame replaces the held one
 * only when it is strictly newer, so a backfilled batch from before a dropout
 * can't overwrite what arrived after it. Returns the same object when nothing
 * changed.
 */
export function mergeLatest(latest: Latest, frames: readonly LiveFrame[]): Latest {
  let next = latest;
  for (const frame of frames) {
    const held = next[frame.kind];
    if (held && !(frameTime(frame) > frameTime(held))) continue;
    if (next === latest) next = { ...latest };
    next[frame.kind] = frame;
  }
  return next;
}

/**
 * Constant-time token check. Both sides are hashed first, so the comparison
 * always runs over 32 bytes and leaks neither the token's length nor where
 * the first wrong character is. An empty expected token never matches, so a
 * relay deployed without its secret refuses every publisher.
 */
export async function tokensMatch(given: string, expected: string | undefined): Promise<boolean> {
  if (!expected) return false;
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(given)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let difference = 0;
  for (let i = 0; i < x.length; i++) difference |= x[i] ^ y[i];
  return difference === 0;
}
