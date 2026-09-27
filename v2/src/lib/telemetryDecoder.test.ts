import { describe, expect, it } from "vitest";

import type { FastTelemetryPacket, MediumTelemetryPacket, SlowTelemetryPacket } from "./liveTelemetry";
import { FrameReader, decodePayload, decompressFloats } from "./telemetryDecoder";
import { compressFloats, encodeFrame } from "./telemetryEncoder";

const FAST: FastTelemetryPacket = {
  type: "fast",
  primary_rpm: 3120,
  output_rpm: 1044,
  speed_mph: 27,
  latitude_deg: 41.5,
  longitude_deg: -81.609375, // exactly representable in float32
};

const MEDIUM: MediumTelemetryPacket = {
  type: "medium",
  mPs: [12.5, 0, -0.25],
  mPs2: [0.5, 3, 9.8125],
  degPs: [0, -6, 1.5],
};

const SLOW: SlowTelemetryPacket = {
  type: "slow",
  board_statuses: {
    wheel: true, f_HFU: false, r_HFU: true, fl_vcmom: true, fr_vcmom: false,
    rl_vcmom: true, rr_vcmom: true, pi: true, pmu: false, gofobomo: true,
  },
  setpoints: [0.5, 0.75, -1, 0],
  fuel_percent: 63,
  deg: [2.5, -0.5],
  altitude_deg: 212.5,
};

const join = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};

describe("FrameReader", () => {
  it("round-trips every packet type with its signal reading", () => {
    const reader = new FrameReader();
    const result = reader.push(join(encodeFrame(FAST, -71.5, 8.25), encodeFrame(MEDIUM, -90, -3), encodeFrame(SLOW, -110.5, -12)));
    expect(result.skipped).toBe(0);
    expect(result.errors).toEqual([]);
    expect(result.frames).toEqual([
      { packet: FAST, rssi: -71.5, snr: 8.25 },
      { packet: MEDIUM, rssi: -90, snr: -3 },
      { packet: SLOW, rssi: -110.5, snr: -12 },
    ]);
  });

  it("holds a frame split across chunks, however it is cut", () => {
    const bytes = join(encodeFrame(FAST, -70, 5), encodeFrame(SLOW, -80, 4));
    for (let cut = 1; cut < bytes.length; cut++) {
      const reader = new FrameReader();
      const first = reader.push(bytes.subarray(0, cut));
      const second = reader.push(bytes.subarray(cut));
      expect([...first.frames, ...second.frames].map((f) => f.packet.type)).toEqual(["fast", "slow"]);
      expect(first.skipped + second.skipped).toBe(0);
    }
  });

  it("finds its footing after garbage, and counts what it skipped", () => {
    const reader = new FrameReader();
    const junk = new Uint8Array([0xff, 0x00, 0x42, 0x0e, 0x07]); // 0x0e looks like a length; 0x07 isn't its type
    const result = reader.push(join(junk, encodeFrame(FAST, -70, 5)));
    expect(result.frames.map((f) => f.packet)).toEqual([FAST]);
    expect(result.skipped).toBe(junk.length);
  });

  it("resyncs one byte at a time, so a false start costs no real frame", () => {
    // A lone length+type pair, then a real frame straight after: the fake
    // "frame" swallows the real one's bytes, fails to decode (its compressed
    // block count is wrong), and the reader must still find the real frame.
    const fake = new Uint8Array([0x19, 0x02, 0x09]);
    const real = encodeFrame(SLOW, -80, 4);
    const result = new FrameReader().push(join(fake, real));
    expect(result.frames.map((f) => f.packet)).toEqual([SLOW]);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("keeps GPS NaN before a fix", () => {
    const frame = encodeFrame({ ...FAST, latitude_deg: NaN, longitude_deg: NaN }, -70, 5);
    const [decoded] = new FrameReader().push(frame).frames;
    expect((decoded.packet as FastTelemetryPacket).latitude_deg).toBeNaN();
  });

  it("scales fixed-point GPS (degrees x 1e7) back to degrees", () => {
    const frame = encodeFrame({ ...FAST, latitude_deg: 415_000_000, longitude_deg: -816_100_000 }, -70, 5);
    const packet = new FrameReader().push(frame).frames[0].packet as FastTelemetryPacket;
    expect(packet.latitude_deg).toBeCloseTo(41.5, 5);
    expect(packet.longitude_deg).toBeCloseTo(-81.61, 5);
  });

  it("forgets a partial frame on reset", () => {
    const reader = new FrameReader();
    const frame = encodeFrame(FAST, -70, 5);
    reader.push(frame.subarray(0, 6));
    reader.reset();
    const result = reader.push(frame.subarray(6));
    expect(result.frames).toEqual([]);
  });
});

describe("decodePayload", () => {
  it("rejects an unknown type", () => {
    expect(() => decodePayload(new Uint8Array([0x09, 1, 2]))).toThrow(/Unknown packet type 0x09/);
  });
});

describe("compressed floats", () => {
  it("keeps 11 significant bits relative to the largest value", () => {
    const values = [100.3, -0.7, 0];
    const decoded = decompressFloats(compressFloats(values), 0, 3);
    expect(decoded[0]).toBeCloseTo(100.3, 1);
    expect(decoded[1]).toBeCloseTo(-0.7, 1);
    expect(decoded[2]).toBe(0);
  });

  it("rejects a block with the wrong count", () => {
    expect(() => decompressFloats(compressFloats([1, 2]), 0, 3)).toThrow(/2 values, expected 3/);
  });
});
