// Live car telemetry for /live: the wire contract, and the pure state the page
// renders from.
//
// The types mirror live-relay/src/protocol.ts at the repo root (the relay
// Worker), which the pit laptop's publisher in lora-dashboard is built against
// too. Change all three together.

// ---- Wire contract (mirror of live-relay/src/protocol.ts) -------------------

export const BOARD_STATUS_FLAGS = [
  "wheel",
  "f_HFU",
  "r_HFU",
  "fl_vcmom",
  "fr_vcmom",
  "rl_vcmom",
  "rr_vcmom",
  "pi",
  "pmu",
  "gofobomo",
] as const;

export type BoardStatusFlag = (typeof BOARD_STATUS_FLAGS)[number];

export type FastTelemetryPacket = {
  type: "fast";
  primary_rpm: number;
  output_rpm: number;
  speed_mph: number;
  latitude_deg: number;
  longitude_deg: number;
};

export type MediumTelemetryPacket = {
  type: "medium";
  mPs: [number, number, number];
  mPs2: [number, number, number];
  degPs: [number, number, number];
};

export type SlowTelemetryPacket = {
  type: "slow";
  board_statuses: Record<BoardStatusFlag, boolean>;
  setpoints: [number, number, number, number];
  fuel_percent: number;
  deg: [number, number];
  altitude_deg: number;
};

export type TelemetryPacket = FastTelemetryPacket | MediumTelemetryPacket | SlowTelemetryPacket;

export type LiveFrame = {
  /** Equals packet.type. */
  kind: "fast" | "medium" | "slow";
  /** ISO 8601, when the pit laptop read it. The laptop's clock, not the car's. */
  receivedAt: string;
  /** dBm */
  rssi: number;
  /** dB */
  snr: number;
  packet: TelemetryPacket;
};

export type FrameKind = LiveFrame["kind"];
export type Latest = Partial<Record<FrameKind, LiveFrame>>;
export type PublisherStatus = { connected: boolean; lastSeenAt: string | null };

export type ViewerMessage =
  // Sent once, as soon as a viewer connects.
  | { t: "snapshot"; latest: Latest; publisher: PublisherStatus }
  | { t: "frames"; frames: LiveFrame[] }
  | { t: "publisher"; connected: boolean; lastSeenAt: string | null };

/** Sent as a keepalive; the relay answers "pong" without waking up. */
export const PING = "ping";
export const PONG = "pong";

// ---- Page state -------------------------------------------------------------

export const LIVE_WS_URL =
  process.env.NEXT_PUBLIC_LIVE_WS_URL ||
  (process.env.NODE_ENV === "development"
    ? "ws://localhost:8787/watch"
    : "wss://live.cwrumotorsports.com/watch");

/** The car counts as live while frames keep arriving at least this often. */
export const LIVE_WINDOW_MS = 5_000;
/** How much of the recent path the map draws. By time, since the packet rate is unknown. */
export const TRAIL_WINDOW_MS = 90_000;
export const TRAIL_MAX_POINTS = 600;

export type TrailPoint = { t: number; lat: number; lon: number };

export type LiveState = {
  /** This page's own socket to the relay. */
  socket: "connecting" | "open" | "closed";
  /** A snapshot has arrived since the page loaded. */
  synced: boolean;
  /** A connection attempt failed before any snapshot arrived. */
  unreachable: boolean;
  publisher: PublisherStatus;
  latest: Latest;
  /** Date.now() when the newest frame reached this page. */
  lastFrameAt: number | null;
  /** Oldest first. */
  trail: TrailPoint[];
};

export const INITIAL_STATE: LiveState = {
  socket: "connecting",
  synced: false,
  unreachable: false,
  publisher: { connected: false, lastSeenAt: null },
  latest: {},
  lastFrameAt: null,
  trail: [],
};

export type LiveEvent =
  | { type: "socket"; status: LiveState["socket"] }
  | { type: "message"; message: ViewerMessage; now: number };

export function reduceLive(state: LiveState, event: LiveEvent): LiveState {
  if (event.type === "socket") {
    if (state.socket === event.status) return state;
    const failed = event.status === "closed" && !state.synced;
    return { ...state, socket: event.status, unreachable: state.unreachable || failed };
  }

  const { message, now } = event;
  switch (message.t) {
    case "snapshot": {
      const frames = Object.values(message.latest).filter((frame) => frame !== undefined);
      const seen = timeOf(message.publisher.lastSeenAt);
      return {
        ...state,
        synced: true,
        unreachable: false,
        publisher: message.publisher,
        latest: mergeLatest(state.latest, frames),
        // The relay's clock stands in for ours until a frame arrives here.
        lastFrameAt: latestOf(state.lastFrameAt, seen),
        trail: extendTrail(state.trail, frames),
      };
    }
    case "frames": {
      if (message.frames.length === 0) return state;
      return {
        ...state,
        // Frames only come from a connected publisher, whatever we last heard.
        publisher: { connected: true, lastSeenAt: new Date(now).toISOString() },
        latest: mergeLatest(state.latest, message.frames),
        lastFrameAt: now,
        trail: extendTrail(state.trail, message.frames),
      };
    }
    case "publisher":
      return { ...state, publisher: { connected: message.connected, lastSeenAt: message.lastSeenAt } };
  }
}

/**
 * The newest frame of each kind. Backfilled frames from before a dropout
 * arrive after newer ones and must not replace them. Same rule as the relay's
 * mergeLatest.
 */
export function mergeLatest(latest: Latest, frames: readonly LiveFrame[]): Latest {
  let next = latest;
  for (const frame of frames) {
    const held = next[frame.kind];
    if (held && !((timeOf(frame.receivedAt) ?? -Infinity) > (timeOf(held.receivedAt) ?? -Infinity))) {
      continue;
    }
    if (next === latest) next = { ...latest };
    next[frame.kind] = frame;
  }
  return next;
}

/** Adds each fast frame's position in time order, and forgets what's older than the window. */
export function extendTrail(trail: TrailPoint[], frames: readonly LiveFrame[]): TrailPoint[] {
  let next = trail;
  for (const frame of frames) {
    if (frame.packet?.type !== "fast") continue;
    const position = gpsPosition(frame.packet);
    const t = timeOf(frame.receivedAt);
    if (!position || t === null) continue;
    if (next === trail) next = trail.slice();
    // Usually the new point goes on the end; backfill finds its place.
    let i = next.length;
    while (i > 0 && next[i - 1].t > t) i--;
    if (i > 0 && next[i - 1].t === t) continue;
    next.splice(i, 0, { t, ...position });
  }
  if (next === trail || next.length === 0) return next;
  const cutoff = next[next.length - 1].t - TRAIL_WINDOW_MS;
  let start = 0;
  while (start < next.length && next[start].t < cutoff) start++;
  start = Math.max(start, next.length - TRAIL_MAX_POINTS);
  return start > 0 ? next.slice(start) : next;
}

// ---- Reading values ---------------------------------------------------------

/** A finite number, or null. JSON carries NaN as null, and a bad packet could carry anything. */
export function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** A plottable position, or null before a fix (NaN, or exactly 0,0). */
export function gpsPosition(
  packet: Partial<FastTelemetryPacket>,
): { lat: number; lon: number } | null {
  const lat = num(packet.latitude_deg);
  const lon = num(packet.longitude_deg);
  if (lat === null || lon === null) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  if (Math.abs(lat) < 1e-6 && Math.abs(lon) < 1e-6) return null;
  return { lat, lon };
}

/** The signal reading from whichever frame arrived last. */
export function latestSignal(latest: Latest): { rssi: number | null; snr: number | null } | null {
  let newest: LiveFrame | null = null;
  for (const frame of Object.values(latest)) {
    if (!frame) continue;
    if (!newest || (timeOf(frame.receivedAt) ?? 0) > (timeOf(newest.receivedAt) ?? 0)) newest = frame;
  }
  return newest ? { rssi: num(newest.rssi), snr: num(newest.snr) } : null;
}

/** 0-4 bars from LoRa RSSI, which runs from about -30 (next to it) to -120 dBm (lost). */
export function signalBars(rssi: number | null): number {
  if (rssi === null) return 0;
  if (rssi > -80) return 4;
  if (rssi > -95) return 3;
  if (rssi > -105) return 2;
  if (rssi > -115) return 1;
  return 0;
}

export type LiveStatus =
  /** Our socket is down, or not up yet. firstTime: nothing has failed yet either. */
  | { kind: "reconnecting"; firstTime: boolean }
  /** The publisher is connected and a frame arrived in the last LIVE_WINDOW_MS. */
  | { kind: "live" }
  /** Anything else. lastSeen is null if the car has never been heard from. */
  | { kind: "offline"; lastSeen: number | null };

export function liveStatus(state: LiveState, now: number): LiveStatus {
  if (state.socket !== "open" || !state.synced) {
    return { kind: "reconnecting", firstTime: !state.synced && !state.unreachable };
  }
  const lastSeen = latestOf(state.lastFrameAt, timeOf(state.publisher.lastSeenAt));
  if (state.publisher.connected && state.lastFrameAt !== null && now - state.lastFrameAt < LIVE_WINDOW_MS) {
    return { kind: "live" };
  }
  return { kind: "offline", lastSeen };
}

/** Whether any frame has ever reached the relay (the snapshot carries the last of each kind). */
export function hasTelemetry(state: LiveState): boolean {
  return Object.keys(state.latest).length > 0;
}

/** "just now", "42 s ago", "5 min ago", "3 h ago", "2 days ago". */
export function formatAgo(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds} s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} days ago`;
}

/**
 * Delay before reconnect attempt `attempt` (0-based): doubling from 500 ms to a
 * 15 s cap, with half of it random so a relay restart isn't met by every
 * viewer at the same instant.
 */
export function reconnectDelay(attempt: number, random: () => number = Math.random): number {
  const ceiling = Math.min(15_000, 500 * 2 ** attempt);
  return ceiling / 2 + random() * (ceiling / 2);
}

/**
 * Parses one relay message, or returns null. Frames that aren't objects of a
 * known kind are dropped; field values are left for num() at render time.
 */
export function parseViewerMessage(raw: unknown): ViewerMessage | null {
  if (typeof raw !== "string" || raw === PONG) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value)) return null;

  if (value.t === "frames" && Array.isArray(value.frames)) {
    return { t: "frames", frames: value.frames.filter(isFrame) };
  }
  if (value.t === "publisher") {
    return { t: "publisher", ...publisherStatus(value) };
  }
  if (value.t === "snapshot" && isRecord(value.latest)) {
    const latest: Latest = {};
    for (const kind of ["fast", "medium", "slow"] as const) {
      const frame = value.latest[kind];
      if (isFrame(frame) && frame.kind === kind) latest[kind] = frame;
    }
    return { t: "snapshot", latest, publisher: publisherStatus(isRecord(value.publisher) ? value.publisher : {}) };
  }
  return null;
}

function publisherStatus(value: Record<string, unknown>): PublisherStatus {
  return {
    connected: value.connected === true,
    lastSeenAt: typeof value.lastSeenAt === "string" ? value.lastSeenAt : null,
  };
}

function isFrame(value: unknown): value is LiveFrame {
  return (
    isRecord(value) &&
    (value.kind === "fast" || value.kind === "medium" || value.kind === "slow") &&
    typeof value.receivedAt === "string" &&
    isRecord(value.packet) &&
    value.packet.type === value.kind
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function timeOf(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

function latestOf(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.max(a, b);
}
