"use client";

import Link from "next/link";
import { useCallback, useState, type FormEvent } from "react";

import { setSessionValue, useSessionValue } from "@/components/sessionPasswords";
import {
  LIVE_WS_URL,
  formatAgo,
  hasTelemetry,
  latestSignal,
  liveStatus,
  type LiveStatus,
} from "@/lib/liveTelemetry";
import { Signal, TelemetryDashboard, label } from "./TelemetryDashboard";
import { useLiveTelemetry, useNow, type Denied } from "./useLiveTelemetry";

/**
 * The team's live view. Nothing is fetched until someone gives the watch
 * password (or the team password); the relay checks it and sends no data
 * without it. A wrong one is forgotten and asked for again.
 */
export default function LiveTelemetry() {
  const password = useSessionValue("watchPassword");
  const [denied, setDenied] = useState<Denied | null>(null);
  const onDenied = useCallback((reason: Denied) => {
    setDenied(reason);
    setSessionValue("watchPassword", null);
  }, []);

  if (!password) {
    return (
      <PasswordGate
        denied={denied}
        onSubmit={(value) => {
          setDenied(null);
          setSessionValue("watchPassword", value);
        }}
      />
    );
  }
  // Keyed by password, so a new one starts a fresh connection and fresh state.
  return <LiveFeed key={password} password={password} onDenied={onDenied} />;
}

function LiveFeed({ password, onDenied }: { password: string; onDenied: (reason: Denied) => void }) {
  const state = useLiveTelemetry(LIVE_WS_URL, password, onDenied);
  const now = useNow();
  const status = liveStatus(state, now);
  const signal = latestSignal(state.latest);

  return (
    <div className="mt-8 border-t border-white/8">
      <div className="flex min-h-16 flex-wrap items-center justify-between gap-x-8 gap-y-3 py-5">
        <StatusBanner status={status} now={now} />
        {signal && <Signal rssi={signal.rssi} snr={signal.snr} />}
      </div>

      {hasTelemetry(state) ? (
        // Last known values stay up while the car is away, dimmed.
        <TelemetryDashboard latest={state.latest} trail={state.trail} stale={status.kind !== "live"} />
      ) : (
        <Waiting status={status} unreachable={state.unreachable} />
      )}
    </div>
  );
}

const DENIED_TEXT: Record<Denied, string> = {
  rejected: "That password didn\u2019t work.",
  locked: "Too many wrong passwords from this network. Try again in 10 minutes.",
  forbidden: "The live feed doesn\u2019t accept connections from this address.",
};

function PasswordGate({ denied, onSubmit }: { denied: Denied | null; onSubmit: (password: string) => void }) {
  const [draft, setDraft] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = draft.trim();
    if (value) onSubmit(value);
  };
  return (
    <form
      onSubmit={submit}
      className="mt-8 flex min-h-[22rem] flex-col items-start justify-center gap-5 border-t border-white/8 py-16"
    >
      <h2 className={label}>Team only</h2>
      <p className="max-w-xl text-base leading-relaxed text-white/60">
        The live view is for the team. Enter the watch password to see the car.
      </p>
      <div className="flex w-full max-w-md flex-wrap gap-3">
        <label className="sr-only" htmlFor="watch-password">
          Watch password
        </label>
        <input
          id="watch-password"
          type="password"
          autoComplete="current-password"
          placeholder="Watch password"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          className="min-h-11 min-w-48 flex-1 border border-white/15 bg-transparent px-3 text-white placeholder:text-white/30"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="inline-flex min-h-11 items-center justify-center bg-livery px-5 font-clash text-xs font-medium uppercase tracking-[0.16em] text-on-livery hover:bg-livery-hover disabled:opacity-40"
        >
          Watch
        </button>
      </div>
      {denied && (
        <p role="alert" className="text-sm text-livery-pop">
          {DENIED_TEXT[denied]}
        </p>
      )}
    </form>
  );
}

function StatusBanner({ status, now }: { status: LiveStatus; now: number }) {
  let dot: React.ReactNode;
  let title: string;
  let detail: string | null = null;

  if (status.kind === "live") {
    dot = (
      <span className="relative flex size-2.5">
        <span className="absolute inset-0 animate-ping rounded-full bg-livery opacity-60" />
        <span className="relative size-2.5 rounded-full bg-livery" />
      </span>
    );
    title = "Live";
  } else if (status.kind === "offline") {
    dot = <span className="size-2.5 rounded-full bg-white/25" />;
    title = "Car offline";
    detail = status.lastSeen === null ? null : `Last seen ${formatAgo(now - status.lastSeen)}`;
  } else {
    dot = <span className="size-2.5 rounded-full border border-white/40" />;
    title = status.firstTime ? "Connecting…" : "Reconnecting…";
  }

  return (
    // polite: a screen reader hears the car go live or drop out, without the
    // "last seen" clock interrupting it every second.
    <p role="status" aria-live="polite" className="flex items-center gap-3">
      {dot}
      <span className="font-clash text-sm font-medium uppercase tracking-[0.18em] text-white">
        {title}
      </span>
      {detail && (
        <span aria-live="off" className="text-sm text-white/45">
          {detail}
        </span>
      )}
    </p>
  );
}

function Waiting({ status, unreachable }: { status: LiveStatus; unreachable: boolean }) {
  return (
    <div className="flex min-h-[22rem] flex-col items-start justify-center gap-5 border-t border-white/8 py-16">
      {unreachable ? (
        <>
          <p className="font-clash text-2xl font-medium text-white">Can&rsquo;t reach the live feed.</p>
          <p className="max-w-xl text-base leading-relaxed text-white/60">
            This page keeps trying on its own and will pick up the car as soon as it gets through.
          </p>
        </>
      ) : status.kind === "reconnecting" ? (
        <p className="font-clash text-2xl font-medium text-white/45">Connecting to the live feed…</p>
      ) : (
        <>
          <p className="font-clash text-3xl font-medium text-white sm:text-4xl">No race in progress.</p>
          <p className="max-w-xl text-base leading-relaxed text-white/60">
            Check back on race day. While the car is on track, its speed, position and health stream
            here live, straight from the pit.
          </p>
          <Link
            href="/competition"
            className="-my-3 inline-flex min-h-11 items-center gap-2 font-clash text-sm font-medium uppercase tracking-[0.16em] text-livery-ink hover:text-white"
          >
            See the season
            <svg viewBox="5 5 14 14" fill="none" aria-hidden="true" className="size-3">
              <path d="M6 18 18 6M8 6h10v10" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </Link>
        </>
      )}
    </div>
  );
}
