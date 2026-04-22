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
    year: "2025",
    podiums: 7,
    competitions: [
      {
        name: "Baja SAE Carolina",
        awards: [
          "7th Place Overall",
          "19th Place Business Presentation",
          "5th Place Cost",
          "2nd Place Design",
          "3rd Place Acceleration",
          "4th Place Hill Climb",
          "1st Place Suspension & Traction",
          "9th Place Endurance",
        ],
      },
      {
        name: "Baja SAE Maryland",
        awards: [
          "6th Place Overall",
          "28th Place Business Presentation",
          "10th Place Cost",
          "1st Place Design",
          "7th Place Acceleration",
          "11th Place Maneuverability",
          "9th Place Hill Climb",
          "33rd Place Suspension & Traction",
          "2nd Place Endurance",
        ],
      },
      {
        name: "Baja SAE Arizona",
        awards: [
          "4th Place Overall",
          "22nd Place Business Presentation",
          "11th Place Cost",
          "1st Place Design",
          "11th Place Acceleration",
          "16th Place Maneuverability",
          "9th Place Pilot Pull",
          "7th Place Suspension & Traction",
          "1st Place Endurance",
        ],
      },
    ],
  },
  {
    year: "2024",
    podiums: 6,
    competitions: [
      {
        name: "Baja SAE Michigan",
        awards: [
          "6th Place Overall",
          "32nd Place Business Presentation",
          "16th Place Cost",
          "7th Place Design",
          "1st Place Acceleration",
          "11th Place Maneuverability",
          "3rd Place Hill Climb",
          "6th Place Suspension & Traction",
          "6th Place Endurance",
        ],
      },
      {
        name: "Baja SAE Williamsport",
        awards: [
          "6th Place Overall",
          "33rd Place Business Presentation",
          "22nd Place Cost",
          "4th Place Design",
          "1st Place Acceleration",
          "5th Place Maneuverability",
          "7th Place Hill Climb",
          "10th Place Suspension & Traction",
          "20th Place Endurance",
        ],
      },
      {
        name: "Baja SAE California",
        awards: [
          "9th Place Overall",
          "22nd Place Business Presentation",
          "20th Place Cost",
          "5th Place Design",
          "1st Place Acceleration",
          "2nd Place Maneuverability",
          "1st Place Hill Climb",
          "5th Place Suspension & Traction",
          "19th Place Endurance",
        ],
      },
    ],
  },
  {
    year: "2023",
    podiums: 8,
    competitions: [
      {
        name: "Baja SAE Ohio",
        awards: [
          "1st Place Overall",
          "2nd Place Business Presentation",
          "22nd Place Cost",
          "8th Place Design",
          "3rd Place Acceleration",
          "2nd Place Maneuverability",
          "28th Place Pilot Pull",
          "1st Place Suspension & Traction",
          "2nd Place Endurance",
        ],
      },
      {
        name: "Baja SAE Oregon",
        awards: [
          "6th Place Overall",
          "9th Place Sales Presentation",
          "47th Place Cost",
          "3rd Place Design",
          "5th Place Acceleration",
          "4th Place Maneuverability",
          "11th Place Hill Climb",
          "17th Place Rock Crawl",
          "2nd Place Endurance",
        ],
      },
      {
        name: "Baja SAE Oshkosh",
        awards: [
          "5th Place Overall",
          "5th Place Sales Presentation",
          "13th Place Cost",
          "5th Place Design",
          "2nd Place Acceleration",
          "4th Place Maneuverability",
          "42nd Place Sled Pull",
          "11th Place Suspension & Traction",
          "9th Place Endurance",
        ],
      },
    ],
  },
  {
    year: "2022",
    podiums: 3,
    competitions: [
      {
        name: "Baja SAE Tennessee Tech",
        awards: [
          "12th Place Overall",
          "5th Place Sales Presentation",
          "13th Place Cost",
          "4th Place Design",
          "4th Place Acceleration",
          "54th Place Sled Pull",
          "40th Place Suspension & Traction",
          "12th Place Endurance",
        ],
      },
      {
        name: "Baja SAE Arizona",
        awards: [
          "5th Place Overall",
          "2nd Place Sales Presentation",
          "12th Place Cost",
          "13th Place Design",
          "3rd Place Acceleration",
          "3rd Place Maneuverability",
          "6th Place Sled Pull",
          "12th Place Suspension & Traction",
          "8th Place Endurance",
        ],
      },
      {
        name: "Baja SAE Rochester",
        awards: [
          "28th Place Overall",
          "16th Place Sales Presentation",
          "15th Place Cost",
          "24th Place Design",
          "6th Place Acceleration",
          "18th Place Maneuverability",
          "58th Place Sled Pull",
          "52nd Place Suspension & Traction",
          "39th Place Endurance",
        ],
      },
    ],
  },
  {
    year: "2019",
    podiums: 1,
    competitions: [
      {
        name: "Baja SAE Rochester",
        awards: [
          "11th Place Overall",
          "13th Place Sales Presentation",
          "25th Place Cost",
          "20th Place Design",
          "1st Place Acceleration",
          "41st Place Maneuverability",
          "4th Place Hill Climb",
          "35th Place Suspension & Traction",
          "15th Place Endurance",
        ],
      },
      {
        name: "Baja SAE California",
        awards: [
          "13th Place Overall",
          "45th Place Sales Presentation",
          "23rd Place Cost",
          "15th Place Design",
          "22nd Place Acceleration",
          "31st Place Maneuverability",
          "28th Place Hill Climb",
          "29th Place Suspension & Traction",
          "15th Place Endurance",
        ],
      },
      {
        name: "Baja SAE Tennessee Tech",
        awards: [
          "31st Place Overall",
          "15th Place Sales Presentation",
          "20th Place Cost",
          "10th Place Design",
          "8th Place Acceleration",
          "35th Place Maneuverability",
          "35th Place Sled Pull",
          "6th Place Suspension & Traction",
          "65th Place Endurance",
        ],
      },
    ],
  },
  {
    year: "2018",
    podiums: 2,
    competitions: [
      {
        name: "Baja SAE Oregon",
        awards: [
          "18th Place Overall",
          "45th Place Sales Presentation",
          "32nd Place Cost",
          "11th Place Design",
          "4th Place Acceleration",
          "15th Place Maneuverability",
          "24th Place Hill Climb",
          "34th Place Rock Crawl",
          "32nd Place Endurance",
        ],
      },
      {
        name: "Baja SAE Kansas",
        awards: [
          "23rd Place Overall",
          "40th Place Sales Presentation",
          "43rd Place Cost",
          "3rd Place Design",
          "10th Place Acceleration",
          "25th Place Maneuverability",
          "17th Place Sled Pull",
          "55th Place Suspension & Traction",
          "40th Place Endurance",
        ],
      },
      {
        name: "Baja SAE Maryland",
        awards: [
          "12th Place Overall",
          "19th Place Sales Presentation",
          "34th Place Cost",
          "22nd Place Design",
          "4th Place Acceleration",
          "3rd Place Maneuverability",
          "9th Place Hill Climb",
          "40th Place Suspension & Traction",
          "16th Place Endurance",
        ],
      },
    ],
  },
  {
    year: "2017",
    podiums: 0,
    competitions: [
      {
        name: "Baja SAE Kansas",
        awards: [
          "8th Place Overall",
          "67th Place Sales Presentation",
          "79th Place Cost",
          "21st Place Design",
          "11th Place Acceleration",
          "6th Place Maneuverability",
          "48th Place Sled Pull",
          "14th Place Suspension & Traction",
          "8th Place Endurance",
        ],
      },
      {
        name: "Baja SAE California",
        awards: [
          "9th Place Overall",
          "6th Place Sales Presentation",
          "38th Place Cost",
          "14th Place Design",
          "14th Place Acceleration",
          "6th Place Maneuverability",
          "29th Place Hill Climb",
          "4th Place Endurance",
        ],
      },
    ],
  },
  {
    year: "2016",
    podiums: 1,
    competitions: [
      {
        name: "Baja SAE Rochester",
        awards: [
          "23rd Place Overall",
          "6th Place Sales Presentation",
          "27th Place Cost",
          "12th Place Design",
          "3rd Place Acceleration",
          "22nd Place Maneuverability",
          "4th Place Hill Climb",
          "26th Place Suspension & Traction",
          "50th Place Endurance",
        ],
      },
      {
        name: "Baja SAE California",
        awards: [
          "23rd Place Overall",
          "4th Place Sales Presentation",
          "29th Place Cost",
          "12th Place Design",
          "8th Place Acceleration",
          "32nd Place Maneuverability",
          "30th Place Hill Climb",
          "39th Place Suspension & Traction",
          "40th Place Endurance",
        ],
      },
      {
        name: "Baja SAE Tennessee Tech",
        awards: [
          "46th Place Overall",
          "24th Place Sales Presentation",
          "30th Place Cost",
          "21st Place Design",
          "4th Place Acceleration",
          "30th Place Maneuverability",
          "62nd Place Sled Pull",
          "30th Place Suspension & Traction",
          "69th Place Endurance",
        ],
      },
    ],
  },
  {
    year: "2015",
    podiums: 0,
    competitions: [
      {
        name: "Baja SAE Oregon",
        awards: [
          "42nd Place Overall",
          "53rd Place Endurance",
          "26th Place Hill Climb",
          "20th Place Rock Crawl",
          "17th Place Maneuverability",
          "27th Place Acceleration",
          "8th Place Sales Presentation",
          "23rd Place Design",
          "64th Place Cost",
        ],
      },
      {
        name: "Baja SAE Maryland",
        awards: [
          "14th Place Overall",
          "5th Place Endurance",
          "22nd Place Suspension & Traction",
          "28th Place Hill Climb",
          "23rd Place Maneuverability",
          "38th Place Acceleration",
          "52nd Place Sales Presentation",
          "21st Place Design",
          "58th Place Cost",
        ],
      },
      {
        name: "Baja SAE Auburn",
        awards: [
          "42nd Place Overall",
          "59th Place Endurance",
          "47th Place Suspension & Traction",
          "32nd Place Hill Climb",
          "23rd Place Maneuverability",
          "10th Place Acceleration",
          "14th Place Sales Presentation",
          "20th Place Design",
          "62nd Place Cost",
        ],
      },
    ],
  },
  {
    year: "2014",
    podiums: 0,
    competitions: [
      {
        name: "Baja SAE Illinois",
        awards: [
          "42nd Place Overall",
          "32nd Place Endurance",
          "37th Place Hill Climb",
          "59th Place Rock Crawl",
          "55th Place Maneuverability",
          "21st Place Acceleration",
          "26th Place Sales Presentation",
          "55th Place Design",
          "34th Place Cost",
        ],
      },
      {
        name: "Baja SAE Kansas",
        awards: [
          "49th Place Overall",
          "34th Place Endurance",
          "62nd Place Suspension & Traction",
          "71st Place Sled Pull",
          "50th Place Maneuverability",
          "72nd Place Acceleration",
          "46th Place Sales Presentation",
          "27th Place Design",
          "43rd Place Cost",
        ],
      },
    ],
  },
  {
    year: "2013",
    podiums: 0,
    competitions: [
      {
        name: "Baja SAE Rochester",
        awards: [
          "58th Place Overall",
          "68th Place Endurance",
          "27th Place Suspension & Traction",
          "60th Place Hill Climb",
          "35th Place Maneuverability",
          "49th Place Acceleration",
          "30th Place Design",
          "31st Place Cost",
        ],
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
    <div className="pb-4">
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
                className={`w-full grid items-center border-b border-white/8 py-4 transition-none group cursor-pointer ${
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
              {isOpen && <div className="pt-1" />}
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
                        className={`w-full grid items-center border-b border-white/8 py-4 transition-none group cursor-pointer ${
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
                          {comp.name.replace(/^Baja SAE\s*/i, "")}
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
                      {isCompOpen && <div className="pt-1" />}
                      {isCompOpen && comp.awards.map((award) => {
                        const parsed = parseAward(award);
                        if (!parsed) return null;
                        const isPodium = /^(1st|2nd|3rd)/i.test(parsed.place);

                        return (
                          <div key={award} className="pl-10">
                            <div
                              className="group grid w-full items-center border-b border-white/8 py-3 hover:bg-red"
                              style={{ gridTemplateColumns: COLS_EVENT }}
                            >
                              {/* Empty chevron column */}
                              <div />

                              <span
                                className={`font-coolvetica font-bold leading-tight ${
                                  isPodium
                                    ? "text-red group-hover:text-black"
                                    : "text-white/40 group-hover:text-black"
                                }`}
                                style={{ fontSize: "clamp(0.9rem,1.6vw,1.4rem)" }}
                              >
                                {parsed.event}
                              </span>

                              <div
                                className={`pr-6 text-right ${
                                  isPodium
                                    ? "text-red group-hover:text-black"
                                    : "text-white/40 group-hover:text-black"
                                }`}
                              >
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
              {isOpen && <div className="pb-6" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
