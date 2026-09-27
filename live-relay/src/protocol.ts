// The wire contract between the pit laptop (publisher), this relay and the
// /live page (viewers).
//
// Mirrored in v2/src/lib/liveTelemetry.ts, and the publisher in lora-dashboard
// is built against the same shapes. Change all three together.

// ---- Decoded packets --------------------------------------------------------
// Copied from lora-dashboard/src/lib/telemetry-decoder.ts.

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

export const FRAME_KINDS = ["fast", "medium", "slow"] as const;

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

/** The newest frame of each kind. */
export type Latest = Partial<Record<FrameKind, LiveFrame>>;

// ---- publisher -> relay -----------------------------------------------------

export type PublisherMessage =
  | { t: "hello"; token: string; v: 1 }
  // session: random id per publisher page load; seq: increments per message.
  // After a reconnect the publisher may backfill older batches, in order.
  | { t: "frames"; session: string; seq: number; frames: LiveFrame[] };

// ---- relay -> viewer --------------------------------------------------------

export type PublisherStatus = { connected: boolean; lastSeenAt: string | null };

export type ViewerMessage =
  // Sent once, as soon as a viewer connects.
  | { t: "snapshot"; latest: Latest; publisher: PublisherStatus }
  | { t: "frames"; frames: LiveFrame[] }
  | { t: "publisher"; connected: boolean; lastSeenAt: string | null };

// ---- Limits and close codes -------------------------------------------------

/** Messages larger than this (UTF-8 bytes) are dropped. Publishers batch under it. */
export const MAX_MESSAGE_BYTES = 16 * 1024;

/** A publisher has this long after connecting to send its hello. */
export const HELLO_TIMEOUT_MS = 5_000;

/** Wrong or missing token, or no hello in time. */
export const CLOSE_UNAUTHORIZED = 4001;
/** A newer publisher authenticated and took over. */
export const CLOSE_REPLACED = 4002;

/** Any socket may send this text and gets "pong" back without waking the relay. */
export const PING = "ping";
export const PONG = "pong";
