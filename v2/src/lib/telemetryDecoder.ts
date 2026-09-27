// Turns the receiver board's serial bytes into telemetry packets.
//
// The board writes one frame per LoRa packet it hears:
//
//   [length u8] [payload, `length` bytes] [rssi f32 LE] [snr f32 LE]
//
// and the payload's first byte is its type. There is no start marker and no
// checksum, so the only way to find a frame boundary is a length byte that is
// followed by the matching type byte:
//
//   fast   0x01, 14 bytes   medium  0x02, 25 bytes   slow  0x03, 24 bytes
//
// When that check or the decode fails, the reader slides forward one byte and
// looks again, so after noise it is back in step at the next real frame rather
// than a whole frame's length later. The layouts below match the receiver
// sketch; lora-dashboard's telemetry-decoder.ts decodes the same bytes.

import type {
  BoardStatusFlag,
  FastTelemetryPacket,
  MediumTelemetryPacket,
  SlowTelemetryPacket,
  TelemetryPacket,
} from "./liveTelemetry";

export const PACKET_TYPE = { fast: 0x01, medium: 0x02, slow: 0x03 } as const;
export const PAYLOAD_LENGTH = { fast: 14, medium: 25, slow: 24 } as const;
const SIGNAL_BYTES = 8;

/** The payload type each valid length byte must be followed by. */
const TYPE_FOR_LENGTH = new Map<number, number>([
  [PAYLOAD_LENGTH.fast, PACKET_TYPE.fast],
  [PAYLOAD_LENGTH.medium, PACKET_TYPE.medium],
  [PAYLOAD_LENGTH.slow, PACKET_TYPE.slow],
]);

/** Status bits: byte 1 bits 0-7, then byte 2 bits 0-1. */
export const STATUS_BITS: ReadonlyArray<[BoardStatusFlag, number, number]> = [
  ["wheel", 1, 0],
  ["f_HFU", 1, 1],
  ["r_HFU", 1, 2],
  ["fl_vcmom", 1, 3],
  ["fr_vcmom", 1, 4],
  ["rl_vcmom", 1, 5],
  ["rr_vcmom", 1, 6],
  ["pi", 1, 7],
  ["pmu", 2, 0],
  ["gofobomo", 2, 1],
];

/** GPS can arrive as degrees or as degrees x 1e7 (fixed point). */
const GPS_FIXED_POINT = 10_000_000;

export type DecodedFrame = { packet: TelemetryPacket; rssi: number; snr: number };

export type ReadResult = {
  frames: DecodedFrame[];
  /** Bytes thrown away while looking for a frame boundary. */
  skipped: number;
  /** Frames whose boundary looked right but whose contents didn't decode. */
  errors: string[];
};

/**
 * Feeds serial chunks in, gets whole frames out. A chunk can end anywhere, so
 * a partial frame waits for the next chunk.
 */
export class FrameReader {
  private pending: Uint8Array = new Uint8Array(0);

  push(chunk: Uint8Array): ReadResult {
    const bytes = concat(this.pending, chunk);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const frames: DecodedFrame[] = [];
    const errors: string[] = [];
    let skipped = 0;
    let offset = 0;

    while (offset < bytes.length) {
      const length = bytes[offset];
      const type = TYPE_FOR_LENGTH.get(length);
      if (type === undefined) {
        offset += 1;
        skipped += 1;
        continue;
      }
      // Need the type byte to judge this candidate.
      if (offset + 1 >= bytes.length) break;
      if (bytes[offset + 1] !== type) {
        offset += 1;
        skipped += 1;
        continue;
      }
      const frameLength = 1 + length + SIGNAL_BYTES;
      if (bytes.length - offset < frameLength) break;

      const payloadStart = offset + 1;
      const signalStart = payloadStart + length;
      try {
        frames.push({
          packet: decodePayload(bytes.subarray(payloadStart, signalStart)),
          rssi: view.getFloat32(signalStart, true),
          snr: view.getFloat32(signalStart + 4, true),
        });
        offset += frameLength;
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
        offset += 1;
        skipped += 1;
      }
    }

    this.pending = bytes.slice(offset);
    return { frames, skipped, errors };
  }

  /** Forget a partial frame, e.g. when the port is reopened. */
  reset(): void {
    this.pending = new Uint8Array(0);
  }
}

export function decodePayload(payload: Uint8Array): TelemetryPacket {
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  switch (payload[0]) {
    case PACKET_TYPE.fast:
      expectLength(payload, PAYLOAD_LENGTH.fast, "Fast");
      return {
        type: "fast",
        primary_rpm: view.getUint16(1, false),
        output_rpm: view.getUint16(3, false),
        speed_mph: view.getUint8(5),
        latitude_deg: normalizeGps(view.getFloat32(6, true), 90),
        longitude_deg: normalizeGps(view.getFloat32(10, true), 180),
      } satisfies FastTelemetryPacket;
    case PACKET_TYPE.medium:
      expectLength(payload, PAYLOAD_LENGTH.medium, "Medium");
      return {
        type: "medium",
        mPs: decompressFloats(payload, 1, 3) as [number, number, number],
        mPs2: decompressFloats(payload, 9, 3) as [number, number, number],
        degPs: decompressFloats(payload, 17, 3) as [number, number, number],
      } satisfies MediumTelemetryPacket;
    case PACKET_TYPE.slow: {
      expectLength(payload, PAYLOAD_LENGTH.slow, "Slow");
      const statuses = Object.fromEntries(
        STATUS_BITS.map(([flag, byte, bit]) => [flag, ((payload[byte] >> bit) & 1) === 1]),
      ) as Record<BoardStatusFlag, boolean>;
      return {
        type: "slow",
        board_statuses: statuses,
        setpoints: decompressFloats(payload, 3, 4) as [number, number, number, number],
        fuel_percent: view.getUint8(13),
        deg: decompressFloats(payload, 14, 2) as [number, number],
        altitude_deg: view.getFloat32(20, true),
      } satisfies SlowTelemetryPacket;
    }
    default:
      throw new Error(`Unknown packet type 0x${(payload[0] ?? 0).toString(16).padStart(2, "0")}`);
  }
}

/**
 * The board's compressed floats: [count u8] [shared exponent + 127 u8], then
 * per value a big-endian u16 of sign (bit 15) and an 11-bit mantissa, so
 * value = sign * mantissa * 2^(exponent - 10).
 */
export function decompressFloats(payload: Uint8Array, offset: number, expected: number): number[] {
  const count = payload[offset];
  if (count !== expected) throw new Error(`Compressed block at ${offset} has ${count} values, expected ${expected}`);
  if (offset + 2 + count * 2 > payload.length) throw new Error(`Compressed block at ${offset} is truncated`);
  const exponent = payload[offset + 1] - 127;
  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    const word = (payload[offset + 2 + i * 2] << 8) | payload[offset + 3 + i * 2];
    const mantissa = word & 0x7ff;
    const sign = word & 0x8000 ? -1 : 1;
    values.push(mantissa === 0 ? 0 : sign * mantissa * 2 ** (exponent - 10));
  }
  return values;
}

function normalizeGps(value: number, limit: number): number {
  if (!Number.isFinite(value) || Math.abs(value) <= limit) return value;
  const scaled = value / GPS_FIXED_POINT;
  return Math.abs(scaled) <= limit ? scaled : value;
}

function expectLength(payload: Uint8Array, length: number, name: string): void {
  if (payload.length !== length) throw new Error(`${name} packet is ${payload.length} bytes, expected ${length}`);
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  if (a.length === 0) return b;
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}
