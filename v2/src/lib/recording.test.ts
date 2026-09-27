import { describe, expect, it } from "vitest";

import { chunkLine, fromHex, readRecording, startLine, stopLine, toHex } from "./recording";

const T0 = Date.parse("2026-09-26T16:00:00.000Z");

describe("recording", () => {
  it("round-trips the raw bytes of every chunk", () => {
    const a = new Uint8Array([0x0e, 0x01, 0xff, 0x00]);
    const b = new Uint8Array([0x7f]);
    const text =
      startLine(T0, 115200) +
      chunkLine({ receivedAt: T0 + 10, bytes: a, frames: [], skipped: 0, errors: [] }) +
      chunkLine({ receivedAt: T0 + 250, bytes: b, frames: [], skipped: 1, errors: ["x"] }) +
      stopLine(T0 + 300, 2, 5);
    expect(readRecording(text)).toEqual([
      { at: T0 + 10, bytes: a },
      { at: T0 + 250, bytes: b },
    ]);
  });

  it("reads lora-dashboard's v1 recordings too", () => {
    const v1 = [
      JSON.stringify({ kind: "recording-start", format: "baja-telemetry-jsonl-v1", startedAt: "2026-05-01T12:00:00.000Z", baudRate: "115200" }),
      JSON.stringify({ kind: "serial-chunk", receivedAt: "2026-05-01T12:00:01.000Z", byteLength: 2, rawHex: "0e01", frames: [], errors: [] }),
    ].join("\n");
    expect(readRecording(v1)).toEqual([{ at: Date.parse("2026-05-01T12:00:01.000Z"), bytes: new Uint8Array([0x0e, 0x01]) }]);
  });

  it("replays up to a line cut off by a crash", () => {
    const good = chunkLine({ receivedAt: T0, bytes: new Uint8Array([1, 2]), frames: [], skipped: 0, errors: [] });
    expect(readRecording(good + good.slice(0, 20))).toHaveLength(1);
  });

  it("writes NaN GPS as null", () => {
    const line = chunkLine({
      receivedAt: T0,
      bytes: new Uint8Array(),
      frames: [{ kind: "fast", receivedAt: "x", rssi: NaN, snr: 1, packet: { type: "fast", primary_rpm: 0, output_rpm: 0, speed_mph: 0, latitude_deg: NaN, longitude_deg: NaN } }],
      skipped: 0,
      errors: [],
    });
    expect(line).toContain('"latitude_deg":null');
  });

  it("hex round-trips and rejects junk", () => {
    const bytes = new Uint8Array([0, 1, 127, 128, 255]);
    expect(fromHex(toHex(bytes))).toEqual(bytes);
    expect(fromHex("abc")).toBeNull();
    expect(fromHex("zz")).toBeNull();
  });
});
