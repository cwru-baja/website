import Navbar from "@/components/Navbar";
import PageContainer from "@/components/PageContainer";
import PageTitle from "@/components/PageTitle";
import LeadershipSection from "@/components/LeadershipSection";
import GeneralBodyTable from "@/components/GeneralBodyTable";
import Footer from "@/components/Footer";
import { SEASON } from "@/lib/events";
import { MEMBER_COUNT, SUBTEAMS, roundedDown } from "@/lib/team";

export const metadata = {
  title: "Team — CWRU Motorsports",
  description: "Meet the students who design, build, and race the CWRU Baja SAE vehicle.",
};

export default function TeamPage() {
  return (
    <>
      <Navbar />

      {/* Page header */}
      <section className="bg-bg pt-40 pb-16">
        <PageContainer>

          {/* Headline */}
          <PageTitle lead="THE" accent="TEAM." />

          {/* Divider */}
          <div className="mt-8 h-px w-full bg-white/8" />

          {/* Stats row */}
          <div className="mt-6 flex flex-wrap gap-x-10 gap-y-2">
            {[
              { value: `${roundedDown(MEMBER_COUNT)}+`, label: "Members" },
              { value: `${roundedDown(SUBTEAMS.length)}+`, label: "Subteams" },
              { value: SEASON, label: "Season" },
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

        </PageContainer>
      </section>

      <LeadershipSection />
      <GeneralBodyTable />
      <Footer />
    </>
  );
}
