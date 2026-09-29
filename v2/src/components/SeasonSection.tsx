"use client";

import { useState, useSyncExternalStore } from "react";
import RaceCountdown from "@/components/RaceCountdown";
import { EVENTS, eventStatus, type BajaEvent, type EventStatus } from "@/lib/events";

// A one-second clock. The server snapshot is null so a prerendered page never
// bakes in build-time statuses; the real time arrives right after hydration.
function subscribeClock(onTick: () => void) {
  const id = setInterval(onTick, 1000);
  return () => clearInterval(id);
}
const readClock = () => Math.floor(Date.now() / 1000) * 1000;
const readServerClock = () => null;

function EventName({
  event,
  className,
  placeClassName = "",
}: {
  event: BajaEvent;
  className: string;
  placeClassName?: string;
}) {
  return (
    <h3
      className={`font-coolvetica font-bold leading-tight ${className}`}
      style={{ fontSize: "clamp(1.4rem, 2vw, 2rem)" }}
    >
      <span className="font-coolvetica font-semibold">Baja SAE </span>
      <span className={`font-brier ${placeClassName}`}>{event.name.replace(/^Baja SAE /, "")}</span>
    </h3>
  );
}

function RacedCard({ event }: { event: BajaEvent }) {
  return (
    <div className="flex items-center justify-between gap-6 border border-white/8 bg-white/[0.02] px-6 py-6 lg:px-10 lg:py-8">
      <div className="min-w-0">
        <EventName event={event} className="text-white/45" />
        <p className="mt-2 text-[0.72rem] tracking-[0.16em] uppercase text-white/30">
          {event.displayDate} · {event.location}
        </p>
      </div>
      <span className="shrink-0 border border-white/20 px-3 py-1.5 text-[0.62rem] font-semibold tracking-[0.28em] uppercase text-white/45">
        Done
      </span>
    </div>
  );
}

// A later race. Hovering it swaps its countdown into the big card at once (no
// transition); a click holds it there, and a second click lets go.
function UpcomingCard({
  event,
  shown,
  pinned,
  onHover,
  onPick,
}: {
  event: BajaEvent;
  shown: boolean;
  pinned: boolean;
  onHover: () => void;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pinned}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") onHover();
      }}
      onClick={onPick}
      className={`block w-full cursor-pointer border px-6 py-6 text-left lg:px-10 lg:py-8 ${
        shown ? "border-livery" : "border-white/15"
      }`}
    >
      <EventName
        event={event}
        className="text-white"
        placeClassName={shown ? "text-livery-ink" : ""}
      />
      <p className={`mt-2 text-[0.72rem] tracking-[0.16em] uppercase ${shown ? "text-livery-ink" : "text-white/45"}`}>
        {event.displayDate} · {event.location}
      </p>
    </button>
  );
}

function NextCard({
  event,
  options,
  status,
  raceNumber,
  now,
}: {
  event: BajaEvent;
  /** Every race this card can be swapped to, including the one shown. */
  options: BajaEvent[];
  status: EventStatus;
  raceNumber: number;
  now: number;
}) {
  const live = status === "live";
  return (
    <div className="border border-livery">
      <div className="flex items-center justify-between gap-4 bg-livery px-6 py-3 lg:px-10 text-[0.62rem] sm:text-[0.7rem] font-semibold tracking-[0.3em] uppercase text-on-livery">
        <span>
          {live && "Live — "}Race {raceNumber} of {EVENTS.length}
        </span>
        <span className="hidden md:inline">{event.displayDate}</span>
        <span className="hidden md:inline">{event.location}</span>
      </div>

      <div className="px-6 py-8 lg:px-10 lg:py-10">
        {/* Every race the card can swap to is laid in the same cell and only the
            shown one is visible, so a longer name that wraps on a phone doesn't
            make the card grow when it swaps in. */}
        <h3
          className="grid font-coolvetica font-bold leading-tight text-white"
          style={{ fontSize: "clamp(1.9rem, 3.4vw, 3.5rem)" }}
        >
          {options.map((ev) => (
            <span
              key={ev.name}
              aria-hidden={ev !== event}
              style={{ gridArea: "1 / 1", visibility: ev === event ? "visible" : "hidden" }}
            >
              <span className="font-coolvetica font-semibold">Baja SAE </span>
              <span className="font-brier text-livery-ink">{ev.name.replace(/^Baja SAE /, "")}</span>
            </span>
          ))}
        </h3>
        {/* Below md the bar only fits the race label, so date and place drop in here */}
        <p className="mt-2 grid text-[0.8rem] tracking-[0.16em] uppercase text-livery-ink md:hidden">
          {options.map((ev) => (
            <span
              key={ev.name}
              aria-hidden={ev !== event}
              style={{ gridArea: "1 / 1", visibility: ev === event ? "visible" : "hidden" }}
            >
              {ev.displayDate} · {ev.location}
            </span>
          ))}
        </p>

        <div className="mt-8 lg:mt-10">
          {live ? (
            <p
              className="font-coolvetica font-bold leading-none text-livery-ink"
              style={{ fontSize: "clamp(3rem, 8.5vw, 9.5rem)" }}
            >
              RACING
            </p>
          ) : (
            <RaceCountdown target={event.startDate} now={now} />
          )}
        </div>
      </div>
    </div>
  );
}

export default function SeasonSection() {
  const now = useSyncExternalStore(subscribeClock, readClock, readServerClock);
  const [hovered, setHovered] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);

  const statuses = now === null ? null : EVENTS.map((ev) => eventStatus(ev, now));
  // The first event that hasn't finished owns the clock.
  const nextIndex = statuses?.findIndex((s) => s !== "raced") ?? -1;

  const before = statuses ? EVENTS.slice(0, nextIndex === -1 ? EVENTS.length : nextIndex) : [];
  const after = statuses && nextIndex !== -1 ? EVENTS.slice(nextIndex + 1) : [];

  // The big card shows a hovered race, else a clicked one, else the next one.
  const pick = hovered ?? pinned;
  const pickIndex = pick === null ? -1 : EVENTS.findIndex((ev) => ev.name === pick);
  const shownIndex = pickIndex > nextIndex ? pickIndex : nextIndex;

  return (
    <>
      {/* THIS SEASON */}
      <div className="mt-20 leading-none sm:mt-36">
        <div className="font-coolvetica font-bold text-[clamp(2rem,4.5vw,5rem)] tracking-wide text-white leading-none">
          THIS
        </div>
        <div className="font-brier font-semibold text-[clamp(2rem,4.5vw,5rem)] tracking-wide text-livery-pop leading-none -mt-2">
          SEASON
        </div>
      </div>

      {/* Reserve the space until the client clock is known, so nothing jumps */}
      <div
        className={`mt-12 flex flex-col gap-6 transition-opacity duration-500 ${
          statuses ? "opacity-100" : "opacity-0 min-h-[36rem]"
        }`}
      >
        {statuses && (
          <>
            {before.length > 0 && (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {before.map((ev) => (
                  <RacedCard key={ev.name} event={ev} />
                ))}
              </div>
            )}

            {now !== null && nextIndex !== -1 ? (
              <NextCard
                event={EVENTS[shownIndex]}
                options={EVENTS.slice(nextIndex)}
                status={statuses[shownIndex]}
                raceNumber={shownIndex + 1}
                now={now}
              />
            ) : (
              <div className="border border-white/15 px-6 py-8 lg:px-10">
                <p className="text-[0.7rem] font-semibold tracking-[0.3em] uppercase text-livery-ink">
                  Season complete
                </p>
                <p className="mt-3 text-sm text-white/40">
                  All competitions for this season have concluded.
                </p>
              </div>
            )}

            {after.length > 0 && (
              // Leaving is watched on the whole row, so crossing the gap between
              // two cards doesn't flash the next race back in.
              <div
                className="grid grid-cols-1 gap-6 md:grid-cols-2"
                onPointerLeave={() => setHovered(null)}
              >
                {after.map((ev, i) => (
                  <UpcomingCard
                    key={ev.name}
                    event={ev}
                    shown={nextIndex + 1 + i === shownIndex}
                    pinned={pinned === ev.name}
                    onHover={() => setHovered(ev.name)}
                    onPick={() => {
                      setPinned((p) => (p === ev.name ? null : ev.name));
                      setHovered(null);
                    }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
