"use client";

import Link from "next/link";

import {
  LIVE_WS_URL,
  formatAgo,
  hasTelemetry,
  latestSignal,
  liveStatus,
  type LiveStatus,
} from "@/lib/liveTelemetry";
import { Signal, TelemetryDashboard } from "./TelemetryDashboard";
import { useLiveTelemetry, useNow } from "./useLiveTelemetry";

export default function LiveTelemetry() {
  const state = useLiveTelemetry(LIVE_WS_URL);
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
