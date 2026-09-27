"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

import {
  BOARD_STATUS_FLAGS,
  LIVE_WS_URL,
  formatAgo,
  hasTelemetry,
  latestSignal,
  liveStatus,
  num,
  signalBars,
  type BoardStatusFlag,
  type FastTelemetryPacket,
  type LiveStatus,
  type SlowTelemetryPacket,
} from "@/lib/liveTelemetry";
import { MapFrame } from "./MapFrame";
import { useLiveTelemetry, useNow } from "./useLiveTelemetry";

// Leaflet touches window as it loads, and only this page needs it, so it is
// fetched in the browser once the page is up and never reaches other bundles.
const LiveMap = dynamic(() => import("./LiveMap"), {
  ssr: false,
  loading: () => <MapFrame message="Loading map" />,
});

// Where the bars top out. A Baja car is governed to about 3,800 rpm and rarely
// passes 40 mph; readings past either still show, the bar just stays full.
const SPEED_SCALE_MPH = 40;
const RPM_SCALE = 4_000;
const LOW_FUEL_PERCENT = 20;

const BOARD_LABELS: Record<BoardStatusFlag, string> = {
  wheel: "Wheel",
  f_HFU: "F HFU",
  r_HFU: "R HFU",
  fl_vcmom: "FL VCMOM",
  fr_vcmom: "FR VCMOM",
  rl_vcmom: "RL VCMOM",
  rr_vcmom: "RR VCMOM",
  pi: "Pi",
  pmu: "PMU",
  gofobomo: "GOFOBOMO",
};

const label = "text-[0.7rem] font-medium uppercase tracking-[0.18em] text-white/35";

export default function LiveTelemetry() {
  const state = useLiveTelemetry(LIVE_WS_URL);
  const now = useNow();
  const status = liveStatus(state, now);
  const fast = state.latest.fast?.packet as Partial<FastTelemetryPacket> | undefined;
  const slow = state.latest.slow?.packet as Partial<SlowTelemetryPacket> | undefined;
  const signal = latestSignal(state.latest);

  return (
    <div className="mt-8 border-t border-white/8">
      <div className="flex min-h-16 flex-wrap items-center justify-between gap-x-8 gap-y-3 py-5">
        <StatusBanner status={status} now={now} />
        {signal && <Signal rssi={signal.rssi} snr={signal.snr} />}
      </div>

      {hasTelemetry(state) ? (
        <div
          // Last known values stay up while the car is away, dimmed so nobody
          // mistakes them for live ones.
          className={`grid border-t border-white/8 transition-opacity duration-500 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] ${
            status.kind === "live" ? "" : "opacity-55"
          }`}
        >
          <div className="flex flex-col">
            <Speed mph={num(fast?.speed_mph)} />
            <div className="grid grid-cols-2 border-t border-white/8">
              <Reading title="Engine" value={num(fast?.primary_rpm)} unit="rpm" scale={RPM_SCALE} />
              <Reading title="Output" value={num(fast?.output_rpm)} unit="rpm" divided />
            </div>
            <Fuel percent={num(slow?.fuel_percent)} />
          </div>
          <div className="max-lg:border-t max-lg:border-white/8 lg:border-l lg:border-white/8 lg:pl-8">
            <div className="py-6 lg:h-full">
              <LiveMap trail={state.trail} />
            </div>
          </div>
          <Boards statuses={slow?.board_statuses} />
        </div>
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

function Signal({ rssi, snr }: { rssi: number | null; snr: number | null }) {
  const bars = signalBars(rssi);
  return (
    <div className="flex items-center gap-4" aria-label={`Radio signal ${bars} of 4`}>
      <span className={label}>Signal</span>
      <span aria-hidden className="flex h-3.5 items-end gap-[3px]">
        {[1, 2, 3, 4].map((bar) => (
          <span
            key={bar}
            className={`w-[3px] ${bar <= bars ? "bg-livery" : "bg-white/12"}`}
            style={{ height: `${bar * 25}%` }}
          />
        ))}
      </span>
      <span className="font-sans text-sm font-medium tabular-nums text-white">
        {rssi === null ? "—" : rssi.toFixed(0)}
        <span className="ml-1 text-white/35">dBm</span>
      </span>
      <span className="font-sans text-sm font-medium tabular-nums text-white">
        {snr === null ? "—" : snr.toFixed(1)}
        <span className="ml-1 text-white/35">dB SNR</span>
      </span>
    </div>
  );
}

function Speed({ mph }: { mph: number | null }) {
  return (
    <section aria-label="Speed" className="py-6 lg:pr-8">
      <h2 className={label}>Speed</h2>
      <p className="mt-3 flex items-baseline">
        {/* Coolvetica's digits aren't tabular, so the number is right-aligned
            in a box two digits wide and MPH never moves. */}
        <span
          className="inline-block w-[1.02em] text-right font-coolvetica font-bold leading-[0.85] text-white"
          style={{ fontSize: "clamp(6rem, 11vw, 10rem)" }}
        >
          {mph === null ? "—" : Math.max(0, Math.round(mph))}
        </span>
        <span className="ml-3 font-coolvetica text-3xl font-bold text-white/20">MPH</span>
      </p>
      <Bar value={mph} scale={SPEED_SCALE_MPH} className="mt-5" />
    </section>
  );
}

function Reading({
  title,
  value,
  unit,
  scale,
  divided = false,
}: {
  title: string;
  value: number | null;
  unit: string;
  scale?: number;
  divided?: boolean;
}) {
  return (
    <section aria-label={`${title} ${unit}`} className={`py-6 ${divided ? "border-l border-white/8 pl-4 sm:pl-6" : "pr-4 sm:pr-6"}`}>
      <h2 className={label}>
        {title} <span className="normal-case tracking-normal">{unit}</span>
      </h2>
      {/* Satoshi, not Clash, for every changing number: Clash has no tabular
          figures ("1111" is half the width of "0000"), so readings would
          jitter at the packet rate. Sized to the viewport on phones, so two
          four-digit readings fit side by side at 320px. */}
      <p className="mt-2 font-sans text-[clamp(1.75rem,9vw,2.25rem)] font-medium tabular-nums text-white">
        {value === null ? "—" : Math.max(0, Math.round(value)).toLocaleString("en-US")}
      </p>
      {scale && <Bar value={value} scale={scale} className="mt-4" />}
    </section>
  );
}

function Fuel({ percent }: { percent: number | null }) {
  const clamped = percent === null ? null : Math.min(100, Math.max(0, percent));
  const low = clamped !== null && clamped <= LOW_FUEL_PERCENT;
  const lit = clamped === null ? 0 : Math.round(clamped / 10);
  return (
    <section aria-label="Fuel" className="border-t border-white/8 py-6 lg:pr-8">
      <div className="flex items-baseline justify-between">
        <h2 className={label}>Fuel</h2>
        {low && <span className="text-[0.7rem] font-medium uppercase tracking-[0.18em] text-livery-pop">Low</span>}
      </div>
      <p className="mt-2 font-sans text-[clamp(1.75rem,9vw,2.25rem)] font-medium tabular-nums text-white">
        {clamped === null ? "—" : Math.round(clamped)}
        <span className="text-white/35">%</span>
      </p>
      <div aria-hidden className="mt-4 grid grid-cols-10 gap-1">
        {Array.from({ length: 10 }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 ${i < lit ? (low ? "bg-livery-pop" : "bg-livery") : "bg-white/8"}`}
          />
        ))}
      </div>
    </section>
  );
}

function Boards({ statuses }: { statuses: Partial<Record<BoardStatusFlag, unknown>> | undefined }) {
  const known = statuses && typeof statuses === "object";
  const ok = known ? BOARD_STATUS_FLAGS.filter((flag) => statuses[flag] === true).length : 0;
  return (
    <section aria-label="Electronics" className="border-t border-white/8 py-6 lg:col-span-2">
      <div className="flex items-baseline justify-between">
        <h2 className={label}>Electronics</h2>
        <span className={label}>{known ? `${ok} of ${BOARD_STATUS_FLAGS.length} OK` : "Waiting"}</span>
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-px bg-white/8 sm:grid-cols-5">
        {BOARD_STATUS_FLAGS.map((flag) => {
          const value = known ? statuses[flag] : undefined;
          const state = value === true ? "ok" : value === false ? "fault" : "unknown";
          return (
            // Phones stack the status under the name: side by side, two
            // columns at 320px cut FL VCMOM to "FL VCMO…".
            <li
              key={flag}
              className="flex flex-col items-start gap-1.5 bg-bg px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4"
            >
              <span className="truncate font-clash text-sm uppercase tracking-[0.12em] text-white">
                {BOARD_LABELS[flag]}
              </span>
              <span
                className={`flex shrink-0 items-center gap-2 text-[0.7rem] font-medium uppercase tracking-[0.18em] ${
                  state === "fault" ? "text-livery-pop" : "text-white/45"
                }`}
              >
                <span
                  aria-hidden
                  className={`size-2 rounded-full ${
                    state === "ok" ? "bg-livery" : state === "fault" ? "bg-livery-pop" : "bg-white/20"
                  }`}
                />
                {state === "ok" ? "OK" : state === "fault" ? "Fault" : "—"}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Bar({ value, scale, className = "" }: { value: number | null; scale: number; className?: string }) {
  const fraction = value === null ? 0 : Math.min(1, Math.max(0, value / scale));
  return (
    <div aria-hidden className={`h-1 overflow-hidden bg-white/8 ${className}`}>
      <div
        // Scaled, not resized, so an update never triggers layout. The short
        // linear ease smooths the steps between packets; reduced motion turns
        // it off with every other transition (globals.css).
        className="h-full origin-left bg-livery transition-transform duration-200 ease-linear"
        style={{ transform: `scaleX(${fraction})` }}
      />
    </div>
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
