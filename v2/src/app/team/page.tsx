import Navbar from "@/components/Navbar";
import PageContainer from "@/components/PageContainer";
import LeadershipSection from "@/components/LeadershipSection";
import GeneralBodyTable from "@/components/GeneralBodyTable";

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
          <h1
            className="font-bebas leading-[0.88] tracking-tight text-white"
            style={{ fontSize: "clamp(5rem, 10vw, 11rem)" }}
          >
            THE{" "}
            <span className="text-red">TEAM.</span>
          </h1>

          {/* Divider */}
          <div className="mt-8 h-px w-full bg-white/8" />

          {/* Stats row */}
          <div className="mt-6 flex flex-wrap gap-x-10 gap-y-2">
            {[
              { value: "40", label: "Members" },
              { value: "10", label: "Subteams" },
              { value: "2025", label: "Season" },
            ].map(({ value, label }) => (
              <div key={label} className="flex items-baseline gap-2">
                <span className="font-bebas text-2xl tracking-wide text-white">
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
    </>
  );
}
