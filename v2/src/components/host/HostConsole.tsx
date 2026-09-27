"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

import { Signal, TelemetryDashboard, label } from "@/components/live/TelemetryDashboard";
import { Outbox, createStamper, type OutboxStats } from "@/lib/hostOutbox";
import {
  INITIAL_STATE,
  LIVE_WINDOW_MS,
  formatAgo,
  hasTelemetry,
  latestSignal,
  reduceLive,
  type FrameKind,
  type LiveFrame,
  type LiveState,
} from "@/lib/liveTelemetry";
import { chunkLine } from "@/lib/recording";
import { FrameReader } from "@/lib/telemetryDecoder";
import { setSessionValue, useSessionValue } from "@/components/sessionPasswords";
import { useRecorder, type RecorderStatus } from "./useRecorder";
import { useRelayPublisher, type StreamStatus } from "./useRelayPublisher";
import { useSerialBoard, type BoardStatus } from "./useSerialBoard";
import { useWakeLock } from "./useWakeLock";

const DEFAULT_BAUD = 115_200;
/** Stream states that need someone to act before anything is sent again. */
const STOPPED = new Set<StreamStatus["kind"]>(["rejected", "locked", "replaced", "forbidden"]);
/** The stream counts as behind once its oldest unsent frame is this old. */
const BEHIND_AFTER_MS = 2_000;
/** Packet rates are averaged over this window. */
const RATE_WINDOW_MS = 10_000;

const button =
  "inline-flex min-h-11 items-center justify-center px-5 font-clash text-xs font-medium uppercase tracking-[0.16em] disabled:opacity-40";
const primary = `${button} bg-livery text-on-livery hover:bg-livery-hover`;
const secondary = `${button} border border-white/15 text-white hover:border-white/40`;

type Stats = {
  bytes: number;
  skipped: number;
  errors: number;
  lastError: string | null;
  counts: Record<FrameKind, number>;
  /** Arrival times inside RATE_WINDOW_MS, per kind. */
  recent: Record<FrameKind, number[]>;
  lastFrameAt: number | null;
};

/** What the counters show, taken from Stats once a second. */
type Snapshot = {
  now: number;
  rates: Record<FrameKind, number>;
  bytes: number;
  skipped: number;
  errors: number;
  lastError: string | null;
  lastFrameAt: number | null;
  outbox: OutboxStats;
};

const HOST_INITIAL: LiveState = { ...INITIAL_STATE, socket: "open", synced: true };

const emptyStats = (): Stats => ({
  bytes: 0,
  skipped: 0,
  errors: 0,
  lastError: null,
  counts: { fast: 0, medium: 0, slow: 0 },
  recent: { fast: [], medium: [], slow: [] },
  lastFrameAt: null,
});

/**
 * The pit laptop's page: reads the receiver board, shows everything it hears,
 * streams it to /live and records it to disk. Every part works on its own, so
 * with no internet the crew still has the dashboard and the recording.
 */
export default function HostConsole() {
  const password = useSessionValue("password");
  const streaming = useSessionValue("streaming") === "1";
  const [baud, setBaud] = useState(DEFAULT_BAUD);

  const [outbox] = useState(() => new Outbox(crypto.randomUUID()));
  const [reader] = useState(() => new FrameReader());
  const [stamp] = useState(() => createStamper());
  const recorder = useRecorder();
  const stream = useRelayPublisher(outbox, password, streaming);

  // Decoded state lives outside React and is shown at most once per frame,
  // like /live, however fast the board talks.
  const stateRef = useRef<LiveState>(HOST_INITIAL);
  const statsRef = useRef<Stats>(emptyStats());
  const [view, setView] = useState<LiveState>(HOST_INITIAL);
  const frameRef = useRef(0);
  // Frames queue only while a stream is wanted and could still resume: not
  // after a wrong password, a lockout or another laptop taking over.
  const queueing = useRef(false);
  const streamStopped = STOPPED.has(stream.status.kind);
  useEffect(() => {
    queueing.current = streaming && !!password && !streamStopped;
  }, [streaming, password, streamStopped]);

  const onChunk = useCallback(
    (bytes: Uint8Array, at: number) => {
      const result = reader.push(bytes);
      const frames: LiveFrame[] = result.frames.map(({ packet, rssi, snr }) => ({
        kind: packet.type,
        receivedAt: stamp(at),
        rssi,
        snr,
        packet,
      }));

      const stats = statsRef.current;
      stats.bytes += bytes.length;
      stats.skipped += result.skipped;
      stats.errors += result.errors.length;
      if (result.errors.length) stats.lastError = result.errors[result.errors.length - 1];
      for (const frame of frames) {
        stats.counts[frame.kind] += 1;
        stats.recent[frame.kind].push(at);
      }

      recorder.write(chunkLine({ receivedAt: at, bytes, frames, skipped: result.skipped, errors: result.errors }), bytes.length);
      if (frames.length === 0) return;
      stats.lastFrameAt = at;
      if (queueing.current) outbox.push(frames);
      stateRef.current = reduceLive(stateRef.current, { type: "message", message: { t: "frames", frames }, now: at });
      if (!frameRef.current) {
        frameRef.current = requestAnimationFrame(() => {
          frameRef.current = 0;
          setView(stateRef.current);
        });
      }
    },
    [outbox, reader, recorder, stamp],
  );
  const onOpen = useCallback(() => reader.reset(), [reader]);
  const board = useSerialBoard({ onChunk, onOpen });

  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  const boardActive = board.status.kind === "open" || board.status.kind === "replaying" || board.status.kind === "unplugged";
  useWakeLock(boardActive || streaming);

  // Closing the tab mid-race would drop the board, the stream and the file.
  const guard = boardActive || recorder.status.kind === "recording";
  useEffect(() => {
    if (!guard) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [guard]);

  // A wrong password is forgotten, so the form asks again.
  useEffect(() => {
    if (stream.status.kind === "rejected") setSessionValue("password", null);
  }, [stream.status.kind]);

  // The counters, rates and queue refresh once a second, not per packet.
  const [snap, setSnap] = useState<Snapshot>(() => ({
    now: Date.now(),
    rates: { fast: 0, medium: 0, slow: 0 },
    bytes: 0,
    skipped: 0,
    errors: 0,
    lastError: null,
    lastFrameAt: null,
    outbox: outbox.stats(),
  }));
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      const stats = statsRef.current;
      const rates = { fast: 0, medium: 0, slow: 0 };
      for (const kind of ["fast", "medium", "slow"] as const) {
        const recent = stats.recent[kind];
        while (recent.length && recent[0] < now - RATE_WINDOW_MS) recent.shift();
        rates[kind] = recent.length / (RATE_WINDOW_MS / 1000);
      }
      setSnap({
        now,
        rates,
        bytes: stats.bytes,
        skipped: stats.skipped,
        errors: stats.errors,
        lastError: stats.lastError,
        lastFrameAt: stats.lastFrameAt,
        outbox: outbox.stats(),
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [outbox]);
  const now = snap.now;
  const fresh = snap.lastFrameAt !== null && now - snap.lastFrameAt < LIVE_WINDOW_MS;
  const signal = latestSignal(view.latest);

  return (
    <div className="mt-4 border-t border-white/8">
      {board.supported === false && (
        <p className="border-b border-white/8 py-5 text-base leading-relaxed text-livery-pop">
          This browser can&rsquo;t talk to the receiver board. Open this page in Chrome or Edge on a laptop. You can
          still replay a recording here.
        </p>
      )}

      <div className="grid border-b border-white/8 lg:grid-cols-3">
        <BoardPanel board={board} baud={baud} setBaud={setBaud} />
        <StreamPanel status={stream.status} viewers={stream.viewers} password={password} streaming={streaming} now={now} queue={snap.outbox} />
        <RecordPanel status={recorder.status} onStart={() => recorder.start(baud)} onStop={recorder.stop} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-10 gap-y-4 py-5">
        <dl className="flex flex-wrap gap-x-8 gap-y-3">
          {(["fast", "medium", "slow"] as const).map((kind) => (
            <Figure key={kind} term={`${kind} /s`} value={snap.rates[kind].toFixed(1)} />
          ))}
          <Figure term="Received" value={formatBytes(snap.bytes)} />
          <Figure term="Skipped" value={`${snap.skipped} B`} warn={snap.skipped > 0} />
          <Figure term="Bad frames" value={String(snap.errors)} warn={snap.errors > 0} title={snap.lastError ?? undefined} />
          <Figure
            term="Last packet"
            value={snap.lastFrameAt === null ? "—" : formatAgo(now - snap.lastFrameAt)}
            warn={snap.lastFrameAt !== null && !fresh}
          />
        </dl>
        {signal && <Signal rssi={signal.rssi} snr={signal.snr} />}
      </div>

      {hasTelemetry(view) ? (
        <TelemetryDashboard latest={view.latest} trail={view.trail} stale={!fresh} />
      ) : (
        <div className="flex min-h-[16rem] items-center border-t border-white/8 py-12">
          <p className="font-clash text-2xl font-medium text-white/45">
            {boardActive ? "Listening for the car…" : "Connect the receiver board to start."}
          </p>
        </div>
      )}

      <Checklist />
    </div>
  );
}

function Panel({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={`flex flex-col gap-4 py-6 lg:px-6 lg:first:pl-0 lg:last:pr-0 ${className}`}>
      <h2 className={label}>{title}</h2>
      {children}
    </section>
  );
}

function StatusLine({ tone, children }: { tone: "good" | "wait" | "bad" | "off"; children: ReactNode }) {
  const dot = { good: "bg-livery", wait: "border border-white/40", bad: "bg-livery-pop", off: "bg-white/25" }[tone];
  return (
    <p role="status" className="flex min-h-7 items-center gap-3 text-base text-white">
      <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${dot}`} />
      <span>{children}</span>
    </p>
  );
}

function BoardPanel({
  board,
  baud,
  setBaud,
}: {
  board: ReturnType<typeof useSerialBoard>;
  baud: number;
  setBaud: (baud: number) => void;
}) {
  const { status } = board;
  const fileInput = useRef<HTMLInputElement>(null);
  const busy = status.kind === "open" || status.kind === "opening" || status.kind === "replaying" || status.kind === "unplugged";
  return (
    <Panel title="Receiver board">
      <StatusLine tone={boardTone(status)}>{boardText(status)}</StatusLine>
      <div className="flex flex-wrap items-center gap-3">
        {busy ? (
          <button type="button" className={secondary} onClick={() => void board.disconnect()}>
            {status.kind === "replaying" ? "Stop replay" : "Disconnect"}
          </button>
        ) : (
          <>
            <button type="button" className={primary} disabled={!board.supported} onClick={() => void board.connect(baud)}>
              Connect board
            </button>
            {board.knownPort && board.supported && (
              <button type="button" className={secondary} onClick={() => void board.reconnectKnown(baud)}>
                Reopen {board.knownPort}
              </button>
            )}
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-white/60">
        <label className="flex items-center gap-2">
          Baud
          <input
            type="number"
            inputMode="numeric"
            min={1200}
            step={1}
            value={baud}
            disabled={busy}
            onChange={(event) => setBaud(Number(event.target.value) || DEFAULT_BAUD)}
            className="min-h-11 w-28 border border-white/15 bg-transparent px-3 font-sans tabular-nums text-white disabled:opacity-40"
          />
        </label>
        {!busy && (
          <>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="-my-3 inline-flex min-h-11 items-center underline decoration-white/25 underline-offset-4 hover:text-white"
            >
              Replay a recording
            </button>
            <input
              ref={fileInput}
              type="file"
              hidden
              accept=".jsonl,application/jsonl,application/json,text/plain"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void board.replay(file);
              }}
            />
          </>
        )}
      </div>
    </Panel>
  );
}

function StreamPanel({
  status,
  viewers,
  password,
  streaming,
  now,
  queue,
}: {
  status: StreamStatus;
  viewers: number | null;
  password: string | null;
  streaming: boolean;
  now: number;
  queue: OutboxStats;
}) {
  const [draft, setDraft] = useState("");
  // "Behind" is the age of the oldest unsent frame. A count alone would never
  // read zero: a frame or two always waits for the next quarter-second flush.
  // Sent-but-unconfirmed frames are left out; after a drop they rejoin the queue.
  const { queued, dropped, oldestQueued } = queue;
  const behind = oldestQueued === null ? 0 : now - oldestQueued;
  const needsPassword = !password || status.kind === "rejected";

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = draft.trim();
    if (!value) return;
    setSessionValue("password", value);
    setSessionValue("streaming", "1");
    setDraft("");
  };

  return (
    <Panel title="Stream to /live" className="lg:border-x lg:border-white/8">
      <StatusLine tone={streamTone(status)}>{streamText(status, viewers, now)}</StatusLine>
      {needsPassword ? (
        <form onSubmit={submit} className="flex flex-wrap items-center gap-3">
          <label className="sr-only" htmlFor="host-password">
            Team password
          </label>
          <input
            id="host-password"
            type="password"
            autoComplete="current-password"
            placeholder="Team password"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="min-h-11 min-w-48 flex-1 border border-white/15 bg-transparent px-3 text-white placeholder:text-white/30"
          />
          <button type="submit" className={primary} disabled={!draft.trim()}>
            Start streaming
          </button>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          {streaming && status.kind !== "replaced" && status.kind !== "locked" ? (
            <button type="button" className={secondary} onClick={() => setSessionValue("streaming", null)}>
              Stop streaming
            </button>
          ) : (
            <button
              type="button"
              className={primary}
              onClick={() => {
                // Toggled off and on, so a stopped stream (taken over, locked out) starts afresh.
                setSessionValue("streaming", null);
                setTimeout(() => setSessionValue("streaming", "1"), 0);
              }}
            >
              {status.kind === "replaced" ? "Take over" : "Start streaming"}
            </button>
          )}
          <button
            type="button"
            className={`${button} text-white/45 hover:text-white`}
            onClick={() => {
              setSessionValue("streaming", null);
              setSessionValue("password", null);
            }}
          >
            Forget password
          </button>
        </div>
      )}
      <p className="text-sm text-white/45">
        {status.kind === "off" || STOPPED.has(status.kind)
          ? "Nothing is sent until streaming starts."
          : behind < BEHIND_AFTER_MS
          ? "Up to date"
          : `${queued} packets waiting to send · ${Math.round(behind / 1000)} s behind`}
        {dropped > 0 && <span className="text-livery-pop"> · {dropped} dropped (queue full; still recorded)</span>}
      </p>
    </Panel>
  );
}

function RecordPanel({ status, onStart, onStop }: { status: RecorderStatus; onStart: () => void; onStop: () => void }) {
  return (
    <Panel title="Record to this laptop">
      <StatusLine tone={status.kind === "recording" ? "good" : status.kind === "error" ? "bad" : "off"}>
        {status.kind === "recording"
          ? `Recording · ${formatBytes(status.bytes)}`
          : status.kind === "error"
            ? status.message
            : "Not recording"}
      </StatusLine>
      <div className="flex flex-wrap items-center gap-3">
        {status.kind === "recording" ? (
          <button type="button" className={secondary} onClick={onStop}>
            {status.toMemory ? "Stop and download" : "Stop recording"}
          </button>
        ) : (
          <button type="button" className={primary} onClick={onStart}>
            Record to file
          </button>
        )}
      </div>
      <p className="text-sm text-white/45 [overflow-wrap:anywhere]">
        {status.kind === "recording"
          ? status.toMemory
            ? `Held in memory until you stop, then downloaded as ${status.name}.`
            : `Writing ${status.name} as it goes.`
          : "Every byte from the board, so the race can be replayed or decoded again later."}
      </p>
    </Panel>
  );
}

function Figure({ term, value, warn = false, title }: { term: string; value: string; warn?: boolean; title?: string }) {
  return (
    <div className="flex items-baseline gap-2" title={title}>
      <dt className={label}>{term}</dt>
      <dd className={`font-sans text-sm font-medium tabular-nums ${warn ? "text-livery-pop" : "text-white"}`}>{value}</dd>
    </div>
  );
}

function Checklist() {
  return (
    <details className="group border-t border-white/8 py-6">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between font-clash text-sm font-medium uppercase tracking-[0.16em] text-white">
        Race-day checklist
        <span aria-hidden className="text-white/35 group-open:rotate-45">
          +
        </span>
      </summary>
      <ol className="mt-4 grid max-w-3xl list-decimal gap-3 pl-5 text-base leading-relaxed text-white/60">
        <li>Use Chrome or Edge on the laptop, plugged into power.</li>
        <li>
          Stop the laptop sleeping with the lid closed or on a timer (macOS: System Settings, Battery, Options; Windows:
          Power &amp; sleep). This page keeps the screen on, but it can&rsquo;t stop the laptop itself sleeping.
        </li>
        <li>
          Keep this tab open and pinned, and add cwrumotorsports.com under Chrome Settings, Performance, &ldquo;Always
          keep these sites active&rdquo;, so Memory Saver never unloads it.
        </li>
        <li>Connect the phone hotspot, then Connect board, Start streaming and Record to file.</li>
        <li>
          If the board is unplugged it reconnects by itself when plugged back in, if Chrome remembers it. If the status
          stays on &ldquo;Unplugged&rdquo;, press Connect board again.
        </li>
        <li>After the race: Stop recording, then Disconnect. The recording can be replayed here later.</li>
      </ol>
    </details>
  );
}

function boardTone(status: BoardStatus): "good" | "wait" | "bad" | "off" {
  if (status.kind === "open" || status.kind === "replaying") return "good";
  if (status.kind === "opening") return "wait";
  if (status.kind === "unplugged" || status.kind === "error") return "bad";
  return "off";
}

function boardText(status: BoardStatus): string {
  switch (status.kind) {
    case "idle":
      return "Not connected";
    case "opening":
      return `Opening ${status.label}…`;
    case "open":
      return `Connected · ${status.label}`;
    case "unplugged":
      return `Unplugged · waiting for ${status.label}`;
    case "replaying":
      return `Replaying ${status.name} · ${Math.round((status.done / status.total) * 100)}%`;
    case "error":
      return status.message;
  }
}

function streamTone(status: StreamStatus): "good" | "wait" | "bad" | "off" {
  if (status.kind === "live") return "good";
  if (status.kind === "connecting" || status.kind === "retrying") return "wait";
  if (status.kind === "off") return "off";
  return "bad";
}

function streamText(status: StreamStatus, viewers: number | null, now: number): string {
  switch (status.kind) {
    case "off":
      return "Not streaming";
    case "connecting":
      return "Connecting to the relay…";
    case "live":
      return viewers === null ? "Live on /live" : `Live on /live · ${viewers} watching`;
    case "retrying":
      return `No connection · retrying in ${Math.max(1, Math.ceil((status.at - now) / 1000))} s`;
    case "rejected":
      return "Wrong password";
    case "locked":
      return "Too many wrong passwords from this network. Wait 10 minutes.";
    case "replaced":
      return "Another laptop took over the stream";
    case "forbidden":
      return "The relay doesn't accept streams from this address";
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
