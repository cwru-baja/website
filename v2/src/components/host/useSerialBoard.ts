"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { readRecording } from "@/lib/recording";
import { describePort, samePort, webSerial, type WebSerialPort } from "./browserApis";

export type BoardStatus =
  | { kind: "idle" }
  | { kind: "opening"; label: string }
  | { kind: "open"; label: string }
  /** The board went away mid-read; it reopens by itself when it comes back. */
  | { kind: "unplugged"; label: string }
  | { kind: "replaying"; name: string; done: number; total: number }
  | { kind: "error"; message: string };

// At 115200 baud the board sends at most ~11.5 KB/s, so 64 KB covers several
// seconds of the page being too busy to read.
const BUFFER_BYTES = 64 * 1024;
/** A recording's quiet gaps are shortened to this on replay. */
const MAX_REPLAY_GAP_MS = 2_000;

const noSubscribe = () => () => {};

/**
 * The receiver board over Web Serial, or a recording played back in its place.
 * Every chunk of bytes goes to `onChunk` with the time it was read; `onOpen`
 * runs whenever a new byte stream starts, so a half-read frame from before
 * isn't glued to the next one.
 */
export function useSerialBoard({
  onChunk,
  onOpen,
}: {
  onChunk: (bytes: Uint8Array, at: number) => void;
  onOpen: () => void;
}) {
  // null while prerendering: the page can't know until it's in a browser.
  const supported = useSyncExternalStore(noSubscribe, () => webSerial() !== null, () => null);
  const [status, setStatus] = useState<BoardStatus>({ kind: "idle" });
  const [knownPort, setKnownPort] = useState<string | null>(null);

  const handlers = useRef({ onChunk, onOpen });
  useEffect(() => {
    handlers.current = { onChunk, onOpen };
  }, [onChunk, onOpen]);

  const port = useRef<WebSerialPort | null>(null);
  const lastPort = useRef<WebSerialPort | null>(null);
  const reader = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const loop = useRef<Promise<void> | null>(null);
  const reading = useRef(false);
  const baud = useRef(115_200);
  const replayRun = useRef(0);

  const readLoop = useCallback(async (target: WebSerialPort, label: string) => {
    // The outer loop is how Web Serial recovers from a framing, parity or
    // overrun error: the stream errors, `readable` comes back as a new stream,
    // and reading carries on. When the board is unplugged it stays null.
    while (reading.current && target.readable) {
      const current = target.readable.getReader();
      reader.current = current;
      try {
        for (;;) {
          const { value, done } = await current.read();
          if (done) break;
          if (value && value.length > 0) handlers.current.onChunk(value, Date.now());
        }
      } catch {
        // Handled by the loop condition: a recoverable error leaves readable set.
      } finally {
        current.releaseLock();
        reader.current = null;
      }
    }
    if (!reading.current) return;
    // Not asked to stop, so the board went away.
    reading.current = false;
    port.current = null;
    await target.close().catch(() => {});
    setStatus({ kind: "unplugged", label });
  }, []);

  const openPort = useCallback(
    async (target: WebSerialPort) => {
      const label = describePort(target);
      setStatus({ kind: "opening", label });
      try {
        await target.open({
          baudRate: baud.current,
          dataBits: 8,
          stopBits: 1,
          parity: "none",
          flowControl: "none",
          bufferSize: BUFFER_BYTES,
        });
      } catch (error) {
        setStatus({ kind: "error", message: openErrorMessage(error) });
        return;
      }
      port.current = target;
      lastPort.current = target;
      reading.current = true;
      handlers.current.onOpen();
      setStatus({ kind: "open", label });
      setKnownPort(label);
      loop.current = readLoop(target, label);
    },
    [readLoop],
  );

  const stopReplay = useCallback(() => {
    replayRun.current += 1;
  }, []);

  const disconnect = useCallback(async () => {
    stopReplay();
    const target = port.current;
    reading.current = false;
    port.current = null;
    lastPort.current = null;
    await reader.current?.cancel().catch(() => {});
    await loop.current;
    await target?.close().catch(() => {});
    setStatus({ kind: "idle" });
  }, [stopReplay]);

  /** Opens Chrome's port picker. Must run from a click. */
  const connect = useCallback(
    async (baudRate: number) => {
      const serial = webSerial();
      if (!serial) return;
      baud.current = baudRate;
      let target: WebSerialPort;
      try {
        target = await serial.requestPort();
      } catch (error) {
        // Closing the picker without choosing is not an error.
        if (error instanceof DOMException && error.name === "NotFoundError") return;
        setStatus({ kind: "error", message: String(error instanceof Error ? error.message : error) });
        return;
      }
      await openPort(target);
    },
    [openPort],
  );

  /** Reopens a board this site was already allowed to use, without the picker. */
  const reconnectKnown = useCallback(
    async (baudRate: number) => {
      const serial = webSerial();
      if (!serial) return;
      baud.current = baudRate;
      const ports = await serial.getPorts();
      const target = ports.find((p) => lastPort.current && samePort(p, lastPort.current)) ?? ports[0];
      if (target) await openPort(target);
    },
    [openPort],
  );

  /** Plays a recording's raw bytes through the same path as the board, at the pace they were recorded. */
  const replay = useCallback(async (file: File) => {
    const run = ++replayRun.current;
    const chunks = readRecording(await file.text());
    if (chunks.length === 0) {
      setStatus({ kind: "error", message: `${file.name} has no serial data to replay.` });
      return;
    }
    handlers.current.onOpen();
    for (let i = 0; i < chunks.length; i++) {
      if (replayRun.current !== run) return;
      setStatus({ kind: "replaying", name: file.name, done: i, total: chunks.length });
      handlers.current.onChunk(chunks[i].bytes, Date.now());
      const gap = i + 1 < chunks.length ? chunks[i + 1].at - chunks[i].at : 0;
      await new Promise((resolve) => setTimeout(resolve, Math.min(Math.max(gap, 0), MAX_REPLAY_GAP_MS)));
    }
    if (replayRun.current === run) setStatus({ kind: "idle" });
  }, []);

  // Remember a board granted on an earlier visit, and follow unplug/replug.
  useEffect(() => {
    const serial = webSerial();
    if (!serial) return;
    let alive = true;
    serial
      .getPorts()
      .then((ports) => {
        if (alive && ports[0]) setKnownPort(describePort(ports[0]));
      })
      .catch(() => {});

    const onConnect = (event: Event) => {
      const target = event.target as WebSerialPort;
      // Only a board we were reading from comes back on its own. Chrome
      // remembers a board across a replug only if its USB chip reports a
      // serial number; others need Connect again.
      if (!port.current && lastPort.current && samePort(target, lastPort.current)) void openPort(target);
    };
    serial.addEventListener("connect", onConnect);
    return () => {
      alive = false;
      serial.removeEventListener("connect", onConnect);
    };
  }, [openPort]);

  // Leaving the page lets go of the port, so the next visit can open it.
  useEffect(() => {
    return () => {
      replayRun.current += 1;
      reading.current = false;
      void reader.current?.cancel().catch(() => {});
      void loop.current?.then(() => port.current?.close().catch(() => {}));
    };
  }, []);

  return { supported, status, knownPort, connect, reconnectKnown, disconnect, replay, stopReplay };
}

function openErrorMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  if (/already open/i.test(text)) return "That port is open in another tab or app. Close it there and try again.";
  if (/failed to open/i.test(text)) return "The port wouldn't open. Unplug the board, plug it back in and try again.";
  return text;
}
