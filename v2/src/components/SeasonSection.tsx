"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";

gsap.registerPlugin(ScrollTrigger, DrawSVGPlugin);

// Dates must match RaceCountdown.tsx
const EVENTS = [
  {
    name: "Baja SAE Tennessee",
    location: "Cookeville, TN",
    displayDate: "March 19–22, 2026",
    startDate: new Date("2026-03-19T08:00:00"),
    desc: "Timed hill climbs, rock crawls, and a four-hour endurance race across punishing Appalachian terrain.",
  },
  {
    name: "Baja SAE Kansas",
    location: "Pittsburg, KS",
    displayDate: "May 28–31, 2026",
    startDate: new Date("2026-05-28T08:00:00"),
    desc: "Open plains and deep mud test raw suspension design, powertrain durability, and static engineering reviews.",
  },
  {
    name: "Baja SAE Oregon",
    location: "Corvallis, OR",
    displayDate: "September 17–20, 2026",
    startDate: new Date("2026-09-17T08:00:00"),
    desc: "Technical off-camber trails and steep grades at the Northwest's most demanding off-road proving ground.",
  },
];

interface Props {
  selectedIndex: number;
  onSelect: (i: number) => void;
}

const PATHS = [
  "M181 0V56.8496C181 72.6728 193.827 85.5 209.65 85.5H496C523.614 85.5 546 107.886 546 135.5V171",
  "M546 0V171",
  "M911 0V56.8496C911 72.6728 898.173 85.5 882.35 85.5H596C568.386 85.5 546 107.886 546 135.5V171",
];

export default function SeasonSection({ selectedIndex, onSelect }: Props) {
  const svg0 = useRef<SVGSVGElement>(null);
  const svg1 = useRef<SVGSVGElement>(null);
  const svg2 = useRef<SVGSVGElement>(null);
  const svgRefs = [svg0, svg1, svg2];

  useGSAP(() => {
    const svg = svgRefs[selectedIndex]?.current;
    if (!svg) return;
    const path = svg.querySelector("path");
    if (!path) return;

    const rect = svg.getBoundingClientRect();
    const isVisible = rect.top < window.innerHeight * 0.85;

    gsap.fromTo(
      path,
      { drawSVG: "0%" },
      {
        drawSVG: "100%",
        duration: isVisible ? 0.6 : 1.6,
        ease: "power2.inOut",
        ...(isVisible
          ? {}
          : {
              scrollTrigger: {
                trigger: svg,
                start: "top 85%",
              },
            }),
      }
    );
  }, { dependencies: [selectedIndex], revertOnUpdate: true });

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
          <div
            key={ev.name}
            onClick={() => onSelect(i)}
            className="relative py-8 lg:py-0 lg:px-8 first:lg:pl-0 last:lg:pr-0 cursor-pointer group"
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
          </div>
        ))}
      </div>

      {/* 3 stacked SVGs — same dimensions, one visible at a time */}
      <div className="hidden lg:block relative w-full mt-6" style={{ aspectRatio: "1092 / 171" }}>
        {PATHS.map((d, i) => (
          <svg
            key={i}
            ref={svgRefs[i]}
            width="1092"
            height="171"
            viewBox="0 0 1092 171"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="absolute inset-0 w-full h-full"
            style={{ opacity: selectedIndex === i ? 1 : 0, transition: "opacity 0.5s ease" }}
            aria-hidden="true"
          >
            <path d={d} stroke="#BC2121" strokeWidth="3.5" strokeLinecap="round" />
          </svg>
        ))}
      </div>
    </>
  );
}
