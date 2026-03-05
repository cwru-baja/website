"use client";

import { useState } from "react";

interface Competition {
  name: string;
  awards: string[];
}

interface YearResult {
  year: string;
  podiums: number;
  competitions: Competition[];
}

function getAvgFinish(competitions: Competition[]): string | null {
  const overalls: number[] = [];
  for (const comp of competitions) {
    for (const award of comp.awards) {
      const match = award.match(/^(\d+)(?:st|nd|rd|th) Place Overall$/i);
      if (match) { overalls.push(parseInt(match[1])); break; }
    }
  }
  if (overalls.length === 0) return null;
  const avg = Math.round(overalls.reduce((a, b) => a + b, 0) / overalls.length);
  const suffix = avg === 1 ? "st" : avg === 2 ? "nd" : avg === 3 ? "rd" : "th";
  return `${avg}${suffix}`;
}

function getOverallPlace(awards: string[]): string | null {
  for (const award of awards) {
    const match = award.match(/^(\d+)(st|nd|rd|th) Place Overall$/i);
    if (match) return `${match[1]}${match[2]}`;
  }
  return null;
}

function getCompPodiums(awards: string[]): number {
  return awards.filter(a => /^(1st|2nd|3rd)/i.test(a)).length;
}

function parseAward(award: string): { place: string; event: string } | null {
  const match = award.match(/^(\d+(?:st|nd|rd|th)) Place (.+)$/i);
  if (!match) return null;
  return { place: match[1], event: match[2] };
}

const RESULTS: YearResult[] = [
  {
    year: "2024",
    podiums: 6,
    competitions: [
      {
        name: "Baja SAE California",
        awards: [
          "9th Place Overall",
          "5th Place Design",
          "1st Place Acceleration",
          "1st Place Hill Climb",
          "2nd Place Maneuverability",
          "5th Place Suspension",
        ],
      },
      {
        name: "Baja SAE Williamsport",
        awards: [
          "6th Place Overall",
          "4th Place Design",
          "1st Place Acceleration",
          "7th Place Hill Climb",
          "5th Place Maneuverability",
          "10th Place Suspension",
        ],
      },
      {
        name: "Baja SAE Michigan",
        awards: [
          "6th Place Overall",
          "7th Place Design",
          "1st Place Acceleration",
          "3rd Place Hill Climb",
          "11th Place Maneuverability",
          "6th Place Suspension",
          "6th Place Endurance",
        ],
      },
    ],
  },
  {
    year: "2023",
    podiums: 9,
    competitions: [
      {
        name: "Baja SAE Oshkosh",
        awards: [
          "5th Place Overall",
          "5th Place Sales",
          "5th Place Design",
          "2nd Place Acceleration",
          "4th Place Maneuverability",
          "9th Place Endurance",
        ],
      },
      {
        name: "Baja SAE Oregon",
        awards: [
          "6th Place Overall",
          "9th Place Sales",
          "3rd Place Design",
          "5th Place Acceleration",
          "4th Place Maneuverability",
          "2nd Place Endurance",
        ],
      },
      {
        name: "Baja SAE Ohio",
        awards: [
          "1st Place Overall",
          "2nd Place Sales",
          "8th Place Design",
          "3rd Place Acceleration",
          "2nd Place Maneuverability",
          "1st Place Suspension",
          "2nd Place Endurance",
        ],
      },
    ],
  },
  {
    year: "2022",
    podiums: 4,
    competitions: [
      {
        name: "Baja SAE Arizona",
        awards: [
          "5th Place Overall",
          "2nd Place Sales",
          "3rd Place Acceleration",
          "3rd Place Maneuverability",
          "6th Place Sled Pull",
          "8th Place Endurance",
          "3rd Place Overall Dynamic",
        ],
      },
      {
        name: "Baja SAE Rochester",
        awards: ["6th Place Acceleration"],
      },
      {
        name: "Baja SAE Tennessee Tech",
        awards: [
          "5th Place Overall",
          "4th Place Design",
          "4th Place Acceleration",
        ],
      },
    ],
  },
  {
    year: "2021",
    podiums: 4,
    competitions: [
      {
        name: "Baja SAE Knowledge",
        awards: ["2nd Place Overall", "2nd Place Sales"],
      },
      {
        name: "Baja SAE Louisville",
        awards: ["1st Place Hill Climb", "1st Place Maneuverability"],
      },
    ],
  },
  {
    year: "2020",
    podiums: 1,
    competitions: [
      {
        name: "Baja SAE Louisville",
        awards: ["3rd Place Sales"],
      },
    ],
  },
  {
    year: "2019",
    podiums: 1,
    competitions: [
      {
        name: "Baja SAE Rochester",
        awards: ["1st Place Acceleration"],
      },
    ],
  },
  {
    year: "2018",
    podiums: 2,
    competitions: [
      {
        name: "Baja SAE Maryland",
        awards: ["3rd Place Maneuverability"],
      },
      {
        name: "Baja SAE Kansas",
        awards: ["3rd Place Design"],
      },
    ],
  },
  {
    year: "2017",
    podiums: 0,
    competitions: [
      {
        name: "Baja SAE California",
        awards: ["9th Place Overall"],
      },
      {
        name: "Baja SAE Kansas",
        awards: ["8th Place Overall"],
      },
    ],
  },
  {
    year: "2016",
    podiums: 1,
    competitions: [
      {
        name: "Baja SAE Rochester",
        awards: ["3rd Place Acceleration"],
      },
    ],
  },
];

function FinishDisplay({ finish, small }: { finish: string; small?: boolean }) {
  const match = finish.match(/^(\d+)(st|nd|rd|th)$/i);
  const fontSize = small ? "clamp(1.2rem,2vw,1.8rem)" : "clamp(1.8rem,3vw,3rem)";
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

const COLS_YEAR = "5rem 1fr 8rem 7rem";
const COLS_COMP = "4rem 1fr 8rem 7rem";
const COLS_EVENT = "4rem 1fr 8rem 7rem";

export default function AllResultsSection() {
  const [openYear, setOpenYear] = useState<string | null>(null);
  const [openComp, setOpenComp] = useState<string | null>(null);

  function handleYearClick(year: string) {
    if (openYear === year) {
      setOpenYear(null);
      setOpenComp(null);
    } else {
      setOpenYear(year);
      setOpenComp(null);
    }
  }

  return (
    <div className="mt-24 pb-24">
      {/* Section header */}
      <div className="text-right">
        <div
          className="font-coolvetica font-bold leading-none text-white"
          style={{ fontSize: "clamp(2rem,4.5vw,5rem)" }}
        >
          ALL
        </div>
        <div
          className="font-brier font-semibold leading-none text-red -mt-2"
          style={{ fontSize: "clamp(2rem,4.5vw,5rem)" }}
        >
          RESULTS
        </div>
      </div>

      {/* Table */}
      <div className="mt-8">
        {/* Column headers */}
        <div
          className="grid items-center border-b border-white/8 py-3"
          style={{ gridTemplateColumns: COLS_YEAR }}
        >
          <span className="text-[0.6rem] tracking-[0.2em] uppercase text-white/30">
            Results
          </span>
          <span className="text-[0.6rem] tracking-[0.2em] uppercase text-white/30">
            Year
          </span>
          <span className="text-[0.6rem] tracking-[0.2em] uppercase text-white/30 text-right pr-6">
            Avg Finish
          </span>
          <span className="text-[0.6rem] tracking-[0.2em] uppercase text-white/30 text-right">
            Podiums
          </span>
        </div>

        {RESULTS.map((result) => {
          const isOpen = openYear === result.year;
          return (
            <div key={result.year}>
              {/* Year row */}
              <button
                onClick={() => handleYearClick(result.year)}
                className={`w-full grid items-center border-b border-white/8 py-4 transition-none group ${
                  isOpen ? "bg-red" : "hover:bg-red"
                }`}
                style={{ gridTemplateColumns: COLS_YEAR }}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 36 36"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                  className={`ml-4 ${isOpen ? "text-black" : "text-red group-hover:text-black"}`}
                >
                  <path d="M6 12L18 24L30 12" stroke="currentColor" strokeWidth="6" strokeLinecap="square" strokeLinejoin="miter" />
                </svg>

                <span
                  className={`font-coolvetica font-bold text-left leading-none transition-none ${
                    isOpen ? "text-black" : "text-white group-hover:text-black"
                  }`}
                  style={{ fontSize: "clamp(2rem,4vw,4.5rem)" }}
                >
                  {result.year}
                </span>

                <div
                  className={`text-right pr-6 transition-none ${
                    isOpen ? "text-black" : "text-white group-hover:text-black"
                  }`}
                >
                  {getAvgFinish(result.competitions) ? (
                    <FinishDisplay finish={getAvgFinish(result.competitions)!} />
                  ) : (
                    <span className="font-clash font-bold opacity-20" style={{ fontSize: "clamp(1.8rem,3vw,3rem)" }}>
                      —
                    </span>
                  )}
                </div>

                <div className="text-right pr-4">
                  <span
                    className={`font-clash font-bold transition-none ${
                      isOpen ? "text-black" : "text-white group-hover:text-black"
                    }`}
                    style={{ fontSize: "clamp(1.8rem,3vw,3rem)", lineHeight: 1 }}
                  >
                    {result.podiums}
                  </span>
                </div>
              </button>

              {/* Competition sub-rows */}
              {isOpen && <div className="pt-4" />}
              {isOpen && result.competitions.map((comp) => {
                const compKey = `${result.year}-${comp.name}`;
                const isCompOpen = openComp === compKey;
                const overallPlace = getOverallPlace(comp.awards);
                const compPodiums = getCompPodiums(comp.awards);

                return (
                  <div key={comp.name}>
                    {/* Competition row — indented */}
                    <div className="pl-10">
                      <button
                        onClick={() => setOpenComp(isCompOpen ? null : compKey)}
                        className={`w-full grid items-center border-b border-white/8 py-4 transition-none group ${
                          isCompOpen ? "bg-red" : "hover:bg-red"
                        }`}
                        style={{ gridTemplateColumns: COLS_COMP }}
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 36 36"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          style={{ transform: isCompOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                          className={`ml-3 ${isCompOpen ? "text-black" : "text-red group-hover:text-black"}`}
                        >
                          <path d="M6 12L18 24L30 12" stroke="currentColor" strokeWidth="6" strokeLinecap="square" strokeLinejoin="miter" />
                        </svg>

                        <span
                          className={`font-coolvetica font-bold text-left leading-tight transition-none ${
                            isCompOpen ? "text-black" : "text-white group-hover:text-black"
                          }`}
                          style={{ fontSize: "clamp(1.1rem,2.2vw,2rem)" }}
                        >
                          {comp.name}
                        </span>

                        <div
                          className={`text-right pr-6 transition-none ${
                            isCompOpen ? "text-black" : "text-white group-hover:text-black"
                          }`}
                        >
                          {overallPlace ? (
                            <FinishDisplay finish={overallPlace} small />
                          ) : (
                            <span className="font-clash font-bold opacity-20" style={{ fontSize: "clamp(1.2rem,2vw,1.8rem)" }}>—</span>
                          )}
                        </div>

                        <div className="text-right pr-4">
                          <span
                            className={`font-clash font-bold transition-none ${
                              isCompOpen ? "text-black" : "text-white group-hover:text-black"
                            }`}
                            style={{ fontSize: "clamp(1.2rem,2vw,1.8rem)", lineHeight: 1 }}
                          >
                            {compPodiums}
                          </span>
                        </div>
                      </button>

                      {/* Event rows — indented further */}
                      {isCompOpen && comp.awards.map((award) => {
                        const parsed = parseAward(award);
                        if (!parsed) return null;
                        const isPodium = /^(1st|2nd|3rd)/i.test(parsed.place);

                        return (
                          <div key={award} className="pl-10">
                            <div
                              className="w-full grid items-center border-b border-white/8 py-3"
                              style={{ gridTemplateColumns: COLS_EVENT }}
                            >
                              {/* Empty chevron column */}
                              <div />

                              <span
                                className={`font-coolvetica font-bold leading-tight ${
                                  isPodium ? "text-red" : "text-white/40"
                                }`}
                                style={{ fontSize: "clamp(0.9rem,1.6vw,1.4rem)" }}
                              >
                                {parsed.event}
                              </span>

                              <div className={`text-right pr-6 ${isPodium ? "text-red" : "text-white/40"}`}>
                                <FinishDisplay finish={parsed.place} small />
                              </div>

                              <div />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
