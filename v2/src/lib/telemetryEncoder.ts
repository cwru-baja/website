// The inverse of telemetryDecoder.ts: builds the bytes the receiver board
// would send. Used by the tests and to make practice recordings, never on the
// live path.

import type { FastTelemetryPacket, MediumTelemetryPacket, SlowTelemetryPacket, TelemetryPacket } from "./liveTelemetry";
import { PACKET_TYPE, PAYLOAD_LENGTH, STATUS_BITS } from "./telemetryDecoder";

export function encodeFrame(packet: TelemetryPacket, rssi: number, snr: number): Uint8Array {
  const payload = encodePayload(packet);
  const frame = new Uint8Array(1 + payload.length + 8);
  const view = new DataView(frame.buffer);
  frame[0] = payload.length;
  frame.set(payload, 1);
  view.setFloat32(1 + payload.length, rssi, true);
  view.setFloat32(5 + payload.length, snr, true);
  return frame;
}

export function encodePayload(packet: TelemetryPacket): Uint8Array {
  switch (packet.type) {
    case "fast":
      return encodeFast(packet);
    case "medium":
      return encodeMedium(packet);
    case "slow":
      return encodeSlow(packet);
  }
}

function encodeFast(packet: FastTelemetryPacket): Uint8Array {
  const out = new Uint8Array(PAYLOAD_LENGTH.fast);
  const view = new DataView(out.buffer);
  out[0] = PACKET_TYPE.fast;
  view.setUint16(1, packet.primary_rpm, false);
  view.setUint16(3, packet.output_rpm, false);
  view.setUint8(5, packet.speed_mph);
  view.setFloat32(6, packet.latitude_deg, true);
  view.setFloat32(10, packet.longitude_deg, true);
  return out;
}

function encodeMedium(packet: MediumTelemetryPacket): Uint8Array {
  const out = new Uint8Array(PAYLOAD_LENGTH.medium);
  out[0] = PACKET_TYPE.medium;
  out.set(compressFloats(packet.mPs), 1);
  out.set(compressFloats(packet.mPs2), 9);
  out.set(compressFloats(packet.degPs), 17);
  return out;
}

function encodeSlow(packet: SlowTelemetryPacket): Uint8Array {
  const out = new Uint8Array(PAYLOAD_LENGTH.slow);
  const view = new DataView(out.buffer);
  out[0] = PACKET_TYPE.slow;
  for (const [flag, byte, bit] of STATUS_BITS) {
    if (packet.board_statuses[flag]) out[byte] |= 1 << bit;
  }
  out.set(compressFloats(packet.setpoints), 3);
  out[13] = packet.fuel_percent;
  out.set(compressFloats(packet.deg), 14);
  view.setFloat32(20, packet.altitude_deg, true);
  return out;
}

/** [count] [exponent + 127] then sign + 11-bit mantissa per value, sharing the largest exponent. */
export function compressFloats(values: readonly number[]): Uint8Array {
  const out = new Uint8Array(2 + values.length * 2);
  const nonzero = values.filter((v) => v !== 0 && Number.isFinite(v));
  const exponent = nonzero.length ? Math.max(...nonzero.map((v) => Math.floor(Math.log2(Math.abs(v))))) : 0;
  out[0] = values.length;
  out[1] = exponent + 127;
  values.forEach((value, i) => {
    const mantissa = Math.min(0x7ff, Math.round(Math.abs(value) / 2 ** (exponent - 10)));
    const word = (value < 0 ? 0x8000 : 0) | mantissa;
    out[2 + i * 2] = word >> 8;
    out[3 + i * 2] = word & 0xff;
  });
  return out;
}
