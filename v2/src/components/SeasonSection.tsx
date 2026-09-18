"use client";

import { useSyncExternalStore } from "react";
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

function EventName({ event, className }: { event: BajaEvent; className: string }) {
  return (
    <h3
      className={`font-coolvetica font-bold leading-tight ${className}`}
      style={{ fontSize: "clamp(1.4rem, 2vw, 2rem)" }}
    >
      <span className="font-coolvetica font-semibold">Baja SAE </span>
      <span className="font-brier">{event.name.replace(/^Baja SAE /, "")}</span>
    </h3>
  );
}

function StatusCard({ event, status }: { event: BajaEvent; status: EventStatus }) {
  const raced = status === "raced";
  return (
    <div
      className={`flex items-center justify-between gap-6 border px-6 py-6 lg:px-10 lg:py-8 ${
        raced ? "border-white/8 bg-white/[0.02]" : "border-white/15"
      }`}
    >
      <div className="min-w-0">
        <EventName
          event={event}
          className={raced ? "text-white/45" : "text-white"}
        />
        <p
          className={`mt-2 text-[0.72rem] tracking-[0.16em] uppercase ${raced ? "text-white/30" : "text-white/45"}`}
        >
          {event.displayDate} · {event.location}
        </p>
      </div>
      <span
        className={`shrink-0 border px-3 py-1.5 text-[0.62rem] font-semibold tracking-[0.28em] uppercase ${
          raced ? "border-white/20 text-white/45" : "border-white/25 text-white/60"
        }`}
      >
        {raced ? "Done" : "Later"}
      </span>
    </div>
  );
}

function NextCard({
  event,
  status,
  raceNumber,
  now,
}: {
  event: BajaEvent;
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
        <h3
          className="font-coolvetica font-bold leading-tight text-white"
          style={{ fontSize: "clamp(1.9rem, 3.4vw, 3.5rem)" }}
        >
          <span className="font-coolvetica font-semibold">Baja SAE </span>
          <span className="font-brier text-livery-ink">{event.name.replace(/^Baja SAE /, "")}</span>
        </h3>
        {/* Below md the bar only fits the race label, so date and place drop in here */}
        <p className="mt-2 text-[0.8rem] tracking-[0.16em] uppercase text-livery-ink md:hidden">
          {event.displayDate} · {event.location}
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

  const statuses = now === null ? null : EVENTS.map((ev) => eventStatus(ev, now));
  // The first event that hasn't finished owns the clock.
  const nextIndex = statuses?.findIndex((s) => s !== "raced") ?? -1;

  const before = statuses ? EVENTS.slice(0, nextIndex === -1 ? EVENTS.length : nextIndex) : [];
  const after = statuses && nextIndex !== -1 ? EVENTS.slice(nextIndex + 1) : [];

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
                {before.map((ev, i) => (
                  <StatusCard key={ev.name} event={ev} status={statuses[i]} />
                ))}
              </div>
            )}

            {now !== null && nextIndex !== -1 ? (
              <NextCard
                event={EVENTS[nextIndex]}
                status={statuses[nextIndex]}
                raceNumber={nextIndex + 1}
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
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {after.map((ev, i) => (
                  <StatusCard
                    key={ev.name}
                    event={ev}
                    status={statuses[nextIndex + 1 + i]}
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
