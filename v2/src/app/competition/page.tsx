"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PageContainer from "@/components/PageContainer";
import RaceCountdown from "@/components/RaceCountdown";
import SeasonSection from "@/components/SeasonSection";
import AllResultsSection from "@/components/AllResultsSection";

// Default to the next upcoming event (index 0–2)
const EVENT_STARTS = [
  new Date("2026-03-19T08:00:00"),
  new Date("2026-05-28T08:00:00"),
  new Date("2026-09-17T08:00:00"),
];

function getDefaultIndex() {
  const now = Date.now();
  const idx = EVENT_STARTS.findIndex((d) => d.getTime() + 4 * 86_400_000 > now);
  return idx === -1 ? 0 : idx;
}

export default function CompetitionPage() {
  const [selectedIndex, setSelectedIndex] = useState(getDefaultIndex);

  return (
    <>
      <Navbar />

      {/* Page header */}
      <section className="bg-bg pt-40 pb-0">
        <PageContainer>

          {/* Headline */}
          <h1
            className="font-coolvetica font-bold leading-[0.88] text-white"
            style={{ fontSize: "clamp(5rem, 10vw, 11rem)" }}
          >
            THE <span className="text-red">COMPETITION.</span>
          </h1>

          {/* Divider */}
          <div className="mt-8 h-px w-full bg-white/8" />

          {/* Stats row */}
          <div className="mt-6 flex flex-wrap gap-x-10 gap-y-2">
            {[
              { value: "10+", label: "Years Competing" },
              { value: "250+", label: "Teams per Event" },
              { value: "2026", label: "Season" },
            ].map(({ value, label }) => (
              <div key={label} className="flex items-baseline gap-2">
                <span className="font-clash font-medium text-2xl tracking-wide text-white">
                  {value}
                </span>
                <span className="text-[0.7rem] font-medium tracking-[0.18em] uppercase text-white/35">
                  {label}
                </span>
              </div>
            ))}
          </div>

          <SeasonSection selectedIndex={selectedIndex} onSelect={setSelectedIndex} />

        </PageContainer>
      </section>

      <RaceCountdown selectedIndex={selectedIndex} />

      <section className="bg-bg">
        <PageContainer>
          <AllResultsSection />
        </PageContainer>
      </section>

      <Footer />
    </>
  );
}
