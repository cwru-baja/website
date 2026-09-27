"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { startLine, stopLine } from "@/lib/recording";
import { saveFilePicker } from "./browserApis";

export type RecorderStatus =
  | { kind: "off" }
  | { kind: "recording"; name: string; bytes: number; toMemory: boolean }
  | { kind: "error"; message: string };

type Sink = {
  write(text: string): Promise<void>;
  close(): Promise<void>;
};

/**
 * Writes the race to a .jsonl file on the laptop as it happens. In Chrome and
 * Edge the file is chosen up front and written line by line, so a crash loses
 * almost nothing. Elsewhere the lines are held in memory and downloaded on
 * Stop.
 */
export function useRecorder() {
  const [status, setStatus] = useState<RecorderStatus>({ kind: "off" });
  const sink = useRef<Sink | null>(null);
  // Writes run one after another, so lines never interleave or reorder.
  const queue = useRef<Promise<void>>(Promise.resolve());
  const counts = useRef({ chunks: 0, bytes: 0, written: 0 });
  const name = useRef("");

  const fail = useCallback((error: unknown) => {
    sink.current = null;
    setStatus({ kind: "error", message: `Recording stopped: ${error instanceof Error ? error.message : String(error)}` });
  }, []);

  const write = useCallback(
    (text: string, serialBytes = 0) => {
      const target = sink.current;
      if (!target) return;
      counts.current.chunks += serialBytes > 0 ? 1 : 0;
      counts.current.bytes += serialBytes;
      counts.current.written += text.length;
      queue.current = queue.current.then(() => target.write(text)).catch(fail);
    },
    [fail],
  );

  /** Must run from a click: it may open the save dialog. */
  const start = useCallback(
    async (baudRate: number) => {
      const startedAt = Date.now();
      const fileName = `baja-race-${new Date(startedAt).toISOString().replace(/[:.]/g, "-")}.jsonl`;
      const picker = saveFilePicker();
      let next: Sink;
      let toMemory = false;
      if (picker) {
        try {
          const handle = await picker({
            suggestedName: fileName,
            types: [{ description: "Telemetry recording", accept: { "application/jsonl": [".jsonl"] } }],
          });
          const stream = await handle.createWritable();
          next = { write: (text) => stream.write(text), close: () => stream.close() };
          name.current = handle.name;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return; // dialog closed
          fail(error);
          return;
        }
      } else {
        const parts: string[] = [];
        toMemory = true;
        name.current = fileName;
        next = {
          write: async (text) => {
            parts.push(text);
          },
          close: async () => download(new Blob(parts, { type: "application/jsonl" }), fileName),
        };
      }
      sink.current = next;
      queue.current = Promise.resolve();
      counts.current = { chunks: 0, bytes: 0, written: 0 };
      write(startLine(startedAt, baudRate));
      setStatus({ kind: "recording", name: name.current, bytes: 0, toMemory });
    },
    [fail, write],
  );

  const stop = useCallback(async () => {
    const target = sink.current;
    if (!target) return;
    write(stopLine(Date.now(), counts.current.chunks, counts.current.bytes));
    sink.current = null;
    await queue.current;
    await target.close().catch(fail);
    setStatus((current) => (current.kind === "error" ? current : { kind: "off" }));
  }, [fail, write]);

  // The size shown next to the file name, refreshed once a second.
  const recording = status.kind === "recording";
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => {
      setStatus((current) => (current.kind === "recording" ? { ...current, bytes: counts.current.written } : current));
    }, 1000);
    return () => clearInterval(timer);
  }, [recording]);

  // Leaving the page closes the file, so what was written so far is kept.
  useEffect(() => {
    return () => {
      const target = sink.current;
      sink.current = null;
      if (target) void queue.current.then(() => target.close()).catch(() => {});
    };
  }, []);

  return { status, start, stop, write };
}

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
