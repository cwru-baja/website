// The pit laptop's race recording: one JSON object per line.
//
//   {"kind":"recording-start","format":"baja-telemetry-jsonl-v2",...}
//   {"kind":"serial-chunk","receivedAt":...,"rawHex":"0e01...","frames":[LiveFrame...],...}
//   {"kind":"recording-stop",...}
//
// rawHex is every byte exactly as the board sent it, so a recording can be fed
// back through the decoder later (replay, or a better decoder). lora-dashboard's
// "baja-telemetry-jsonl-v1" files have the same serial-chunk lines and replay too.

import type { LiveFrame } from "./liveTelemetry";

export const RECORDING_FORMAT = "baja-telemetry-jsonl-v2";

export function startLine(startedAt: number, baudRate: number): string {
  return line({
    kind: "recording-start",
    format: RECORDING_FORMAT,
    startedAt: new Date(startedAt).toISOString(),
    source: "cwrumotorsports.com/host",
    baudRate,
  });
}

export function chunkLine(chunk: {
  receivedAt: number;
  bytes: Uint8Array;
  frames: LiveFrame[];
  skipped: number;
  errors: string[];
}): string {
  return line({
    kind: "serial-chunk",
    receivedAt: new Date(chunk.receivedAt).toISOString(),
    byteLength: chunk.bytes.length,
    rawHex: toHex(chunk.bytes),
    frames: chunk.frames,
    skipped: chunk.skipped,
    errors: chunk.errors,
  });
}

export function stopLine(endedAt: number, chunks: number, bytes: number): string {
  return line({ kind: "recording-stop", endedAt: new Date(endedAt).toISOString(), serialChunks: chunks, serialBytes: bytes });
}

export type RecordedChunk = { at: number; bytes: Uint8Array };

/**
 * The raw serial chunks of a recording, in order, from either format. Lines
 * that aren't serial chunks, or don't parse, are skipped: a recording cut off
 * mid-line by a crash still replays up to the cut.
 */
export function readRecording(text: string): RecordedChunk[] {
  const chunks: RecordedChunk[] = [];
  for (const raw of text.split("\n")) {
    if (!raw.trim()) continue;
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      continue;
    }
    if (typeof value !== "object" || value === null) continue;
    const { kind, receivedAt, rawHex } = value as Record<string, unknown>;
    if (kind !== "serial-chunk" || typeof rawHex !== "string" || typeof receivedAt !== "string") continue;
    const at = Date.parse(receivedAt);
    const bytes = fromHex(rawHex);
    if (!Number.isFinite(at) || !bytes) continue;
    chunks.push({ at, bytes });
  }
  return chunks;
}

export function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) out += byte.toString(16).padStart(2, "0");
  return out;
}

export function fromHex(hex: string): Uint8Array | null {
  const clean = hex.replace(/\s+/g, "");
  if (clean.length % 2 !== 0 || /[^0-9a-f]/i.test(clean)) return null;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function line(value: unknown): string {
  // NaN (no GPS fix yet) becomes null, as it does on the wire.
  return JSON.stringify(value) + "\n";
}
