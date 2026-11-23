"use client";

import type { CSSProperties } from "react";
import Link from "next/link";

import { formatUsd } from "@/lib/money";
import { DARES_END_LABEL, DARES_ENDS_AT } from "@/lib/daresEvent";
import { useDaresRaised } from "@/lib/daresRaised";
import { CARS, CURRENT_CAR } from "@/lib/livery";
import { pad2, splitSeconds, useCountdown } from "@/lib/useCountdown";

// The "Dare us!" bar above the nav while the event runs: caution tape in the
// livery's raw pink (SR26 #AB0472 takes white text at 7.0:1), black stripes at
// both ends, the amount raised and a live countdown to the close.
// The stripe ends crawl sideways (dares-tape-crawl in globals.css): each end is
// a window onto a layer one stripe period wider, slid by exactly that period so
// the loop is seamless. Transform only, so the nav's backdrop blur never repaints.
const PINK = CARS[CURRENT_CAR].livery.pop;
const INK = "#0a0a0a";
// 14px stripes at -45deg repeat every 28px across, 28 / cos 45° along the bar.
const PERIOD = 28 / Math.SQRT1_2;
const tape: CSSProperties = {
  backgroundImage: `repeating-linear-gradient(-45deg, ${INK} 0 14px, ${PINK} 14px 28px)`,
  left: -PERIOD,
  right: 0,
  ["--tape-period" as string]: `${PERIOD}px`,
};

function TapeEnd({ side }: { side: "left" | "right" }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute inset-y-0 w-10 overflow-hidden sm:w-32 lg:w-48 ${side === "left" ? "left-0" : "right-0"}`}
    >
      <span className="dares-tape-crawl absolute inset-y-0" style={tape} />
    </span>
  );
}

export default function DaresBar() {
  const s = useCountdown(DARES_ENDS_AT);
  const t = s === null ? null : splitSeconds(s);
  const raised = useDaresRaised()?.raised ?? null;
  // Dashes until the browser knows the time, so the static HTML never bakes one in.
  const parts: [string, string][] = [
    [t ? String(t.days) : "--", "d"],
    [t ? pad2(t.hours) : "--", "h"],
    [t ? pad2(t.minutes) : "--", "m"],
    [t ? pad2(t.seconds) : "--", "s"],
  ];

  return (
    <Link
      href="/dares"
      data-dares-bar
      // A fixed name, so screen readers don't hear the clock tick.
      aria-label={`Giving Tuesday: dare us.${
        raised === null ? "" : ` ${formatUsd(raised)} raised.`
      } Open until ${DARES_END_LABEL}.`}
      className="group relative flex h-10 items-center overflow-hidden text-white hover:brightness-110 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-white"
      style={{ background: PINK }}
    >
      <TapeEnd side="left" />
      <TapeEnd side="right" />
      {/* "Dare us →" hugs the left tape and the numbers the right (picked
          from eight layouts), at every width. Phones show only the countdown
          and leave the amount to /dares. The amount appears once loaded; the
          bar's height never changes. */}
      <span
        aria-hidden="true"
        className="relative flex w-full items-center justify-between gap-3 px-12 sm:gap-4 sm:px-36 lg:px-52"
      >
        {/* "Giving Tuesday" names the event: stacked over "Dare us" on phones,
            where the countdown leaves no room for it alongside; one line,
            split by a slash, from sm. */}
        <span className="flex flex-col gap-1 font-satoshi text-sm leading-none font-bold whitespace-nowrap sm:flex-row sm:items-center sm:gap-2.5">
          <span>Giving Tuesday</span>
          <span aria-hidden="true" className="hidden sm:inline">
            /
          </span>
          <span className="flex items-center gap-2">
            Dare us
            <span className="transition-transform group-hover:translate-x-0.5">&rarr;</span>
          </span>
        </span>
        <span className="flex items-center gap-4 font-satoshi text-sm font-bold whitespace-nowrap tabular-nums sm:gap-6">
          {raised !== null && (
            <span className="hidden sm:inline">
              {formatUsd(raised)}
              <span className="ml-1 text-[0.85em] font-medium text-white/55">raised</span>
            </span>
          )}
          {/* Satoshi with tabular figures: Clash and Coolvetica digits jitter as they tick. */}
          <span>
            {parts.map(([v, u], i) => (
              <span key={u}>
                {i > 0 && " "}
                {v}
                <span className="text-[0.85em] font-medium text-white/55">{u}</span>
              </span>
            ))}
          </span>
        </span>
      </span>
    </Link>
  );
}
