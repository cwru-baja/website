// The relay's decisions, kept free of Workers APIs so they run under plain
// vitest: what counts as a valid message, which frame is the newest, whether a
// token matches, and who is allowed to try.

import {
  FRAME_KINDS,
  LOCKOUT_ATTEMPTS,
  LOCKOUT_WINDOW_MS,
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

export function isRecord(value: unknown): value is Record<string, unknown> {
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

// ---- Who may try ------------------------------------------------------------

/**
 * Whether a page on `origin` may connect. Browsers always send Origin on a
 * WebSocket upgrade, so this stops some other site's script from using a
 * visitor's browser to guess passwords. Tools with no Origin (the fake publisher,
 * curl) are let through: they are held to the token and the lockout like
 * anyone else.
 */
export function originAllowed(origin: string | null, allowed: string | undefined): boolean {
  if (origin === null) return true;
  const list = (allowed ?? "").split(",").map((entry) => entry.trim()).filter(Boolean);
  return list.includes(origin);
}

/** Something one address did: how many times, since when. */
export type Tally = { count: number; since: number };

/** How many times an address may do something within a window. */
export type RateRule = { limit: number; windowMs: number };

/** Wrong passwords, on any door: the sockets, the total, the dare log. */
export const LOCKOUT: RateRule = { limit: LOCKOUT_ATTEMPTS, windowMs: LOCKOUT_WINDOW_MS };

/** Whether the address has used up its allowance for the current window. */
export function isFull(tally: Tally | undefined, now: number, rule: RateRule): boolean {
  return !!tally && now - tally.since < rule.windowMs && tally.count >= rule.limit;
}

/** Counts one more. A window that has run out starts again. */
export function bump(tally: Tally | undefined, now: number, rule: RateRule): Tally {
  if (!tally || now - tally.since >= rule.windowMs) return { count: 1, since: now };
  return { count: tally.count + 1, since: tally.since };
}

/** A team password as sent: a non-empty string of sane length. */
export function isPassword(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 256;
}

// ---- Giving Tuesday total ---------------------------------------------------

/** The most a team member can type in as the amount raised, in whole dollars. */
export const MAX_RAISED = 10_000_000;

/** What POST /dares carries: the team password and the new total. */
export type RaisedUpdate = { password: string; raised: number };

/**
 * A valid update has a string password and a whole-dollar total from 0 to
 * MAX_RAISED. Anything else is null, so a typo can't store "12.5k" or -40.
 */
export function parseRaisedUpdate(value: unknown): RaisedUpdate | null {
  if (!isRecord(value)) return null;
  const { password, raised } = value;
  if (!isPassword(password)) return null;
  if (typeof raised !== "number" || !Number.isInteger(raised) || raised < 0 || raised > MAX_RAISED) return null;
  return { password, raised };
}

// ---- Dare log ----------------------------------------------------------------
//
// /dares records who dared whom, since the Blackbaud form's "Other" box never
// reaches the team. The browser that made the dare picks its id and a key; the
// key is the only thing that can later mark that dare's form as finished.
// v2/src/lib/dareLog.ts mirrors these types.

export const DARE_LIMITS = {
  from: 80,
  member: 80,
  members: 60,
  title: 240,
  dares: 20,
  count: 10,
  message: 500,
  /** Per person, in whole dollars. */
  price: 10_000,
  total: 100_000,
} as const;

/**
 * New dares one address may log. High because campus wifi puts many donors
 * behind a few addresses; still a wall for a script.
 */
export const DARE_LOG_RATE: RateRule = { limit: 300, windowMs: 60 * 60_000 };

/** One dare as the donor built it on /dares. */
export type DareDraft = {
  id: string;
  key: string;
  from: string;
  members: string[];
  /** Each dare, its times, and its price per person (null: the member names it). */
  dares: { title: string; count: number; price: number | null }[];
  /**
   * What the priced dares cost, in whole dollars: price x times, summed, x
   * members. null when every dare is one the member prices.
   */
  total: number | null;
  /** Anything else the donor wants the team to know, or null. */
  message: string | null;
};

/**
 * POST /dares/log: the dare, and whether Blackbaud's form has shown its
 * thank-you. Sent on arrival (false) and again at the thank-you (true), in
 * either order; the relay keeps the first copy and the first finish.
 */
export type DareRecord = DareDraft & { finished: boolean };

/** A logged dare, as /dares/update lists it. */
export type DareEntry = Omit<DareDraft, "key"> & {
  createdAt: string;
  /** When the Blackbaud form reported success on the donor's page, or null. */
  completedAt: string | null;
};

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const KEY_PATTERN = /^[0-9a-f]{32}$/;

const isWhole = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;

/** Trimmed, with runs of whitespace (newlines included) collapsed to one space. */
function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > 0 && text.length <= max ? text : null;
}

function parseDare(value: unknown): DareDraft["dares"][number] | null {
  if (!isRecord(value)) return null;
  const title = cleanText(value.title, DARE_LIMITS.title);
  const { count, price } = value;
  if (!title || !isWhole(count, 1, DARE_LIMITS.count)) return null;
  if (price !== null && !isWhole(price, 0, DARE_LIMITS.price)) return null;
  return { title, count, price };
}

/** A valid POST /dares/log body, cleaned, or null if anything is off. */
export function parseDareRecord(value: unknown): DareRecord | null {
  if (!isRecord(value)) return null;
  const { id, key, from, members, dares, total, finished, message } = value;
  if (typeof id !== "string" || !ID_PATTERN.test(id)) return null;
  if (typeof key !== "string" || !KEY_PATTERN.test(key)) return null;
  if (typeof finished !== "boolean") return null;
  const name = cleanText(from, DARE_LIMITS.from);
  if (!name) return null;
  if (total !== null && !isWhole(total, 0, DARE_LIMITS.total)) return null;
  // Optional: null for none (the page sends null, never a blank string).
  const note = message === null ? null : cleanText(message, DARE_LIMITS.message);
  if (message !== null && !note) return null;

  if (!Array.isArray(members) || members.length === 0 || members.length > DARE_LIMITS.members) return null;
  const who = members.map((m) => cleanText(m, DARE_LIMITS.member));
  if (!who.every((m) => m !== null)) return null;

  if (!Array.isArray(dares) || dares.length === 0 || dares.length > DARE_LIMITS.dares) return null;
  const what = dares.map(parseDare);
  if (!what.every((d) => d !== null)) return null;

  return { id, key, from: name, members: who, dares: what, total, message: note, finished };
}
