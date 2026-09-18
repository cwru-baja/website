"use client";

import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  isPodium,
  ordinal,
  scoreLabel,
  type Award,
  type CompetitionResult,
  type SeasonResult,
} from "@/lib/results";
import { useScrollFade } from "./useScrollFade";

function FinishDisplay({ finish, fontSize }: { finish: string; fontSize: string }) {
  const match = finish.match(/^(\d+)(st|nd|rd|th)$/i);
  if (!match)
    return (
      <span className="font-clash font-bold" style={{ fontSize }}>
        {finish}
      </span>
    );
  return (
    <span
      className="font-clash font-bold inline-flex items-start"
      style={{ fontSize, lineHeight: 1 }}
    >
      {match[1]}
      <span
        className="font-clash font-bold uppercase"
        style={{ fontSize: "0.45em", lineHeight: 1.4 }}
      >
        {match[2].toUpperCase()}
      </span>
    </span>
  );
}

// Below sm the columns shrink to what they hold at 320px (year 62px, rank 63px,
// the "Podiums" label 56px), with a few px to spare for other fonts' metrics.
const COLS_YEAR = "grid-cols-[2.5rem_1fr_4.75rem_3.75rem] sm:grid-cols-[5rem_1fr_8rem_7rem]";
const FINISH_YEAR = "clamp(1.8rem,3vw,3rem)";
const FINISH_EVENT = "clamp(1.25rem,2vw,1.75rem)";
const FINISH_PODIUM = "clamp(1.5rem,2.4vw,2.125rem)";
const EVENT_NAME = "clamp(1rem,1.9vw,1.625rem)";

const placeLabel = (award?: Award) =>
  award?.place === undefined ? "—" : ordinal(award.place);

const venue = (competition: CompetitionResult) =>
  competition.name.replace(/^Baja SAE\s*/i, "").toUpperCase();

// One competition at a time: venue names as tabs over a ledger of its events.
function Ledger({ result }: { result: SeasonResult }) {
  const [picked, setPicked] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const tabList = useScrollFade<HTMLDivElement>();
  const id = (part: string, i: number) => `results-${result.year}-${part}-${i}`;

  function onTabKey(event: KeyboardEvent) {
    const last = result.competitions.length - 1;
    const next = {
      ArrowRight: picked === last ? 0 : picked + 1,
      ArrowLeft: picked === 0 ? last : picked - 1,
      Home: 0,
      End: last,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setPicked(next);
    tabs.current[next]?.focus();
  }

  return (
    <div className="pt-7 pb-4 sm:ml-20">
      {/* The rule is an inset shadow so the active underline can cover it
          without a negative margin, which the scroll container would clip. */}
      <div
        ref={tabList}
        role="tablist"
        aria-label={`${result.year} competitions`}
        className="scroll-fade-x flex items-baseline gap-x-6 sm:gap-x-8 overflow-x-auto whitespace-nowrap shadow-[inset_0_-1px_0_rgb(255_255_255/0.08)]"
        onKeyDown={onTabKey}
      >
        {result.competitions.map((competition, i) => {
          const active = i === picked;
          return (
            <button
              key={competition.name}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={id("tab", i)}
              aria-selected={active}
              aria-controls={id("panel", i)}
              tabIndex={active ? 0 : -1}
              onClick={() => setPicked(i)}
              className={`shrink-0 cursor-pointer border-b-[3px] pb-3 font-coolvetica font-bold leading-none ${
                active
                  ? "border-livery-ink text-livery-ink"
                  : "border-transparent text-white/42 hover:text-white"
              }`}
              style={{ fontSize: "clamp(1.25rem,2.2vw,1.875rem)" }}
            >
              {venue(competition)}
            </button>
          );
        })}
      </div>

      {/* Every competition's panel shares one grid cell, so the ledger is as
          tall as the season's longest and switching tabs never moves the
          seasons below it. */}
      <div className="mt-3.5 grid">
        {result.competitions.map((competition, i) => (
          <div
            key={competition.name}
            role="tabpanel"
            id={id("panel", i)}
            aria-labelledby={id("tab", i)}
            style={{ gridArea: "1 / 1", visibility: i === picked ? "visible" : "hidden" }}
          >
            <CompetitionLedger competition={competition} />
          </div>
        ))}
      </div>
    </div>
  );
}

function CompetitionLedger({ competition }: { competition: CompetitionResult }) {
  const overall = competition.awards.find((award) => award.event === "Overall");
  const events = competition.awards.filter((award) => award.event !== "Overall");
  return (
    <>
      <LedgerRow
        name={
          <span className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
            <span>OVERALL</span>
            <span className="font-satoshi font-normal text-[0.6rem] tracking-[0.2em] uppercase text-white/40">
              of {competition.teams} teams
            </span>
          </span>
        }
        score={scoreLabel(overall ?? {})}
        finish={placeLabel(overall)}
        podium={false}
      />
      {events.map((award) => (
        <LedgerRow
          key={award.event}
          name={award.event.toUpperCase()}
          score={scoreLabel(award)}
          finish={placeLabel(award)}
          podium={isPodium(award)}
        />
      ))}
    </>
  );
}

function LedgerRow({
  name,
  score,
  finish,
  podium,
}: {
  name: React.ReactNode;
  score: string;
  finish: string;
  podium: boolean;
}) {
  const scoreStyle = `font-clash font-medium whitespace-nowrap leading-none text-[0.8rem] sm:text-[0.9375rem] tracking-[0.02em] ${
    podium ? "text-livery-pop/90" : "text-white/55"
  }`;
  return (
    <div
      className={`grid grid-cols-[1fr_auto] items-center gap-3 sm:gap-4 border-b border-white/6 py-3 sm:py-[13px] ${
        podium ? "text-livery-pop" : "text-white/62"
      }`}
    >
      <span
        className="font-coolvetica font-bold leading-[1.1]"
        style={{ fontSize: EVENT_NAME }}
      >
        {name}
        {/* On a phone the score drops under the name: beside it, the score and
            place columns left 88px for names like MANEUVERABILITY (129px). */}
        <span className={`mt-1.5 block sm:hidden ${scoreStyle}`}>{score}</span>
      </span>
      {/* Held to the event name's line height so a podium's larger numeral
          overflows into the padding instead of making its row taller. */}
      <div
        className="flex items-center justify-end"
        style={{ fontSize: EVENT_NAME, height: "1.1em" }}
      >
        {/* Score and place share a baseline, so the score sits level with the
            bottom of the place digits. */}
        <div className="flex items-baseline gap-3 sm:gap-4">
          <span className={`w-[5.5rem] sm:w-[7rem] text-right max-sm:hidden ${scoreStyle}`}>
            {score}
          </span>
          <div className="flex w-14 sm:w-[5.5rem] justify-end">
            <FinishDisplay finish={finish} fontSize={podium ? FINISH_PODIUM : FINISH_EVENT} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AllResultsSection({ results }: { results: SeasonResult[] }) {
  const [openYear, setOpenYear] = useState<string | null>(null);
  // Only one season is open at a time, so opening a year can close a ledger
  // above it and pull the clicked row hundreds of pixels up the page, out of
  // view. Hold the clicked row where it was on screen instead.
  const pinned = useRef<{ row: HTMLElement; top: number } | null>(null);

  useLayoutEffect(() => {
    const pin = pinned.current;
    pinned.current = null;
    if (!pin) return;
    const shift = pin.row.getBoundingClientRect().top - pin.top;
    if (shift !== 0) window.scrollBy({ top: shift, behavior: "instant" });
  }, [openYear]);

  return (
    <div className="pb-4">
      {/* Section header */}
      <div className="text-left">
        <div
          className="font-coolvetica font-bold leading-none text-white"
          style={{ fontSize: "clamp(2rem,4.5vw,5rem)" }}
        >
          ALL
        </div>
        <div
          className="font-brier font-semibold leading-none text-livery-pop -mt-2"
          style={{ fontSize: "clamp(2rem,4.5vw,5rem)" }}
        >
          RESULTS
        </div>
      </div>

      {/* Table */}
      {/* Scroll anchoring is off here because the effect above does the anchoring. */}
      <div className="mt-8" style={{ overflowAnchor: "none" }}>
        {/* Column headers */}
        <div
          className={`grid items-center border-b border-white/8 py-3 ${COLS_YEAR}`}
        >
          {/* The chevron column is too narrow for its label on a phone. */}
          <span className="text-[0.6rem] tracking-[0.2em] uppercase text-white/30">
            <span className="max-sm:sr-only">Results</span>
          </span>
          <span className="text-[0.6rem] tracking-[0.2em] uppercase text-white/30">
            Year
          </span>
          <span className="text-[0.6rem] tracking-[0.2em] uppercase text-white/30 text-right pr-2 sm:pr-6">
            Season Rank
          </span>
          <span className="text-[0.6rem] tracking-[0.2em] uppercase text-white/30 text-right">
            Podiums
          </span>
        </div>

        {results.map((result) => {
          const isOpen = openYear === result.year;
          const tone = isOpen ? "text-on-livery" : "text-white group-hover:text-on-livery";
          return (
            <div key={result.year}>
              {/* Year row */}
              <button
                type="button"
                onClick={(event) => {
                  const row = event.currentTarget;
                  pinned.current = { row, top: row.getBoundingClientRect().top };
                  setOpenYear(isOpen ? null : result.year);
                }}
                aria-expanded={isOpen}
                className={`w-full grid items-center border-b border-white/8 py-4 transition-none group cursor-pointer ${COLS_YEAR} ${
                  isOpen ? "bg-livery" : "hover:bg-livery"
                }`}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 36 36"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                  style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                  className={`ml-4 ${isOpen ? "text-on-livery" : "text-livery-ink group-hover:text-on-livery"}`}
                >
                  <path d="M6 12L18 24L30 12" stroke="currentColor" strokeWidth="6" strokeLinecap="square" strokeLinejoin="miter" />
                </svg>

                <span
                  className={`font-coolvetica font-bold text-left leading-none transition-none ${tone}`}
                  style={{ fontSize: "clamp(2rem,4vw,4.5rem)" }}
                >
                  {result.year}
                </span>

                <div className={`text-right pr-2 sm:pr-6 transition-none ${tone}`}>
                  <FinishDisplay finish={ordinal(result.seasonRank)} fontSize={FINISH_YEAR} />
                </div>

                <div className="text-right pr-4">
                  <span
                    className={`font-clash font-bold transition-none ${tone}`}
                    style={{ fontSize: FINISH_YEAR, lineHeight: 1 }}
                  >
                    {result.podiums}
                  </span>
                </div>
              </button>

              {/* Keyed by year so reopening a season starts on its first competition. */}
              {isOpen && <Ledger key={result.year} result={result} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
