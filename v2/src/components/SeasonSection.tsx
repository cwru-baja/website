"use client";

import { EVENTS } from "@/lib/events";

interface Props {
  selectedIndex: number;
  onSelect: (i: number) => void;
}

export default function SeasonSection({ selectedIndex, onSelect }: Props) {

  return (
    <>
      {/* THIS SEASON */}
      <div className="mt-36 leading-none">
        <div className="font-coolvetica font-bold text-[clamp(2rem,4.5vw,5rem)] tracking-wide text-white leading-none">
          THIS
        </div>
        <div className="font-brier font-semibold text-[clamp(2rem,4.5vw,5rem)] tracking-wide text-red leading-none -mt-2">
          SEASON
        </div>
      </div>

      {/* Events grid */}
      <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-white/8">
        {EVENTS.map((ev, i) => (
          <button
            type="button"
            key={ev.name}
            onClick={() => onSelect(i)}
            aria-pressed={selectedIndex === i}
            className="relative py-8 lg:py-0 lg:px-12 first:lg:pl-0 last:lg:pr-0 cursor-pointer group flex flex-col items-start text-left"
          >
            {/* Name */}
            <h3
              className="font-coolvetica font-bold leading-tight text-white"
              style={{ fontSize: "clamp(1.5rem, 2.2vw, 2.2rem)" }}
            >
              <span className="font-coolvetica font-semibold">Baja SAE </span>
              <span
                className={`font-brier transition-colors duration-200 ${
                  selectedIndex === i ? "text-red" : "group-hover:text-red"
                }`}
              >
                {ev.name.replace(/^Baja SAE /, "")}
              </span>
            </h3>
            {/* Date */}
            <p className="mt-2 text-[0.8rem] tracking-[0.16em] uppercase text-red">
              {ev.displayDate}
            </p>
            {/* Location */}
            <p className="mt-1 text-[0.78rem] tracking-[0.16em] uppercase text-white/25">
              {ev.location}
            </p>
          </button>
        ))}
      </div>

    </>
  );
}
