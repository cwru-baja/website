import { readFileSync } from "node:fs";
import path from "node:path";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PageContainer from "@/components/PageContainer";
import PageTitle from "@/components/PageTitle";
import SeasonSection from "@/components/SeasonSection";
import AllResultsSection from "@/components/AllResultsSection";
import HiredByTheBest from "@/components/HiredByTheBest";
import { seasonResults, type BajaData } from "@/lib/results";

// Read on the server so only our results, not the whole 8 MB file, reach the page.
function loadResults() {
  const file = path.join(process.cwd(), "public/baja-data.json");
  const data = JSON.parse(readFileSync(file, "utf8")) as BajaData;
  return seasonResults(data, "Case Western Reserve University");
}

export default function CompetitionPage() {
  return (
    <>
      <Navbar />

      {/* Page header */}
      <section className="bg-bg pt-40 pb-24">
        <PageContainer>

          {/* Headline */}
          <PageTitle lead="THE" accent="COMPETITION." />

          {/* Divider */}
          <div className="mt-8 h-px w-full bg-white/8" />

          {/* Stats row, with the blurb pulled to the far edge on desktop */}
          <div className="mt-6 flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-wrap gap-x-10 gap-y-2">
              {[
                { value: "10+", label: "Years Competing" },
                { value: "50+", label: "Teams per Event" },
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

            <p className="max-w-xl text-base leading-relaxed text-white/60 lg:text-right lg:text-lg">
              Every season ends at Baja SAE, where our car is judged on design, cost, and
              a four-hour endurance race.
            </p>
          </div>

          <SeasonSection />

        </PageContainer>
      </section>

      <HiredByTheBest />

      <section className="bg-bg py-20">
        <PageContainer>
          <AllResultsSection results={loadResults()} />
        </PageContainer>
      </section>

      <Footer />
    </>
  );
}
