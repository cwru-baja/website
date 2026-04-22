import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import PageContainer from "@/components/PageContainer";
import { ArrowRight, Mail } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "Support - CWRU Motorsports",
  description:
    "Support CWRU Motorsports through direct donations, official team apparel, or sponsorship inquiries.",
};

const stats = [
  { value: "2", label: "Ways to Help" },
  { value: "40+", label: "Student Builders" },
  { value: "2026", label: "Season" },
];

const supportLanes = [
  {
    index: "01",
    titleStart: "DONATE",
    titleAccent: "DIRECTLY.",
    description:
      "The fastest way to help. Direct gifts support materials, machining, testing, travel, and competition registration for the current Baja season.",
    detail:
      "On the giving form, choose \"other\" for the gift designation and enter \"Baja\" so it lands with the team.",
    ctaLabel: "Open GiveCampus",
    href: "https://www.givecampus.com/71er24",
    image: "/images/about-15.jpg",
    imageAlt: "CWRU Motorsports team photo at the track.",
    imagePosition: "object-[52%_center]",
  },
  {
    index: "02",
    titleStart: "WEAR THE",
    titleAccent: "TEAM.",
    description:
      "Official merch turns support into something visible. Every purchase feeds the same program budget while putting the team on campus, at competition, and in the shop.",
    detail:
      "The store is stocked with team apparel and ships directly through our online storefront.",
    ctaLabel: "Shop team gear",
    href: "https://cwrubaja.printful.me/",
    image: "/images/cwru-baja-tshirt.png",
    imageAlt: "Official CWRU Motorsports shirt.",
    imagePosition: "object-contain",
  },
];

const impactAreas = [
  {
    number: "01",
    title: "Material + machining",
    body:
      "Tube, sheet, fasteners, coatings, composites, tooling, and the one-off parts that turn CAD into a race-ready car.",
  },
  {
    number: "02",
    title: "Testing + reliability",
    body:
      "Track days, repair cycles, spares, and the iteration time it takes to push the car harder before competition week.",
  },
  {
    number: "03",
    title: "Travel + logistics",
    body:
      "Trailers, tow support, lodging, fuel, and getting the team and car to events across North America.",
  },
  {
    number: "04",
    title: "Competition season",
    body:
      "Registration, technical inspection prep, and the operational costs that let students show up ready to compete.",
  },
];

export default function SupportPage() {
  return (
    <>
      <Navbar />

      <main className="bg-bg text-white">
        <section className="bg-bg pt-40 pb-16">
          <PageContainer>
            <h1
              className="font-coolvetica font-bold leading-[0.88] text-white"
              style={{ fontSize: "clamp(5rem, 10vw, 11rem)" }}
            >
              SUPPORT <span className="text-red">US.</span>
            </h1>

            <div className="mt-8 h-px w-full bg-white/8" />

            <div className="mt-6 flex flex-wrap gap-x-10 gap-y-2">
              {stats.map(({ value, label }) => (
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

            <div className="mt-12 max-w-[42rem]">
              <p className="max-w-xl text-sm leading-7 text-white/58 sm:text-[0.95rem]">
                Every contribution helps a student-run team design, build,
                test, and race an off-road vehicle from scratch. The money
                goes where it matters: parts, manufacturing, travel, and time
                at the track.
              </p>

              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <a
                  href="https://www.givecampus.com/71er24"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center justify-center gap-3 bg-red px-7 py-3 text-[0.72rem] font-semibold tracking-[0.22em] uppercase text-white transition-colors duration-300 hover:bg-red/85"
                >
                  Donate directly
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </a>
                <a
                  href="https://cwrubaja.printful.me/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center justify-center gap-3 border border-white/14 px-7 py-3 text-[0.72rem] font-semibold tracking-[0.22em] uppercase text-white/72 transition-colors duration-300 hover:border-white/28 hover:text-white"
                >
                  Shop team gear
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </a>
              </div>

              <p className="mt-6 max-w-md text-xs leading-6 text-white/34">
                When you reach the giving form, select{" "}
                <span className="text-white/58">Other</span> for the gift
                designation and enter{" "}
                <span className="text-white/58">Baja</span>.
              </p>
            </div>
          </PageContainer>
        </section>

        <section className="pb-8 pt-8 lg:pb-12 lg:pt-14">
          <PageContainer>
            <div className="border-t border-white/10">
              <div className="grid gap-10 py-12 lg:grid-cols-[minmax(0,0.42fr)_minmax(0,1fr)] lg:gap-20">
                <div className="max-w-sm">
                  <p className="text-[0.68rem] font-medium tracking-[0.28em] uppercase text-white/40">
                    Choose your lane
                  </p>
                  <h2 className="mt-4 max-w-xs leading-[0.95]">
                    <span className="block font-coolvetica text-[clamp(2.7rem,5.2vw,4.9rem)] font-bold text-white">
                      TWO
                    </span>
                    <span className="-mt-2 block font-brier text-[clamp(2.7rem,5.2vw,4.9rem)] font-semibold text-red">
                      PATHS.
                    </span>
                  </h2>
                  <p className="mt-6 text-sm leading-7 text-white/52">
                    Both routes support the same race program. Pick the one that
                    fits how you want to back the team.
                  </p>
                </div>

                <div className="space-y-14">
                  {supportLanes.map((lane) => (
                    <article
                      key={lane.index}
                      className="grid gap-8 border-b border-white/10 pb-14 last:border-b-0 last:pb-0 md:grid-cols-[5rem_minmax(0,1fr)] xl:grid-cols-[5rem_minmax(0,0.9fr)_minmax(17rem,0.6fr)]"
                    >
                      <div className="font-clash text-2xl font-medium tracking-wide text-white/28">
                        {lane.index}
                      </div>

                      <div className="max-w-xl">
                        <h3 className="leading-[0.94]">
                          <span className="font-coolvetica text-[clamp(2.15rem,4vw,3.8rem)] font-bold text-white">
                            {lane.titleStart}{" "}
                          </span>
                          <span className="font-brier text-[clamp(2.15rem,4vw,3.8rem)] font-semibold text-red">
                            {lane.titleAccent}
                          </span>
                        </h3>
                        <p className="mt-5 text-sm leading-7 text-white/58">
                          {lane.description}
                        </p>
                        <p className="mt-4 text-xs leading-6 text-white/34">
                          {lane.detail}
                        </p>
                        <a
                          href={lane.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group mt-7 inline-flex items-center gap-3 text-[0.72rem] font-semibold tracking-[0.2em] uppercase text-white transition-colors duration-300 hover:text-red"
                        >
                          {lane.ctaLabel}
                          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                        </a>
                      </div>

                      <div
                        className={
                          lane.index === "02"
                            ? "relative min-h-[16rem]"
                            : "relative min-h-[16rem] overflow-hidden border border-white/10 bg-white/[0.02]"
                        }
                      >
                        <Image
                          src={lane.image}
                          alt={lane.imageAlt}
                          fill
                          sizes="(min-width: 1280px) 22vw, (min-width: 768px) 40vw, 90vw"
                          className={`${lane.imagePosition} transition-transform duration-700 hover:scale-[1.04]`}
                        />
                        {lane.index === "01" ? (
                          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,10,10,0.02),rgba(10,10,10,0.7))]" />
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </PageContainer>
        </section>

        <section className="py-10 lg:py-20">
          <PageContainer>
            <div className="grid gap-12 lg:grid-cols-[minmax(0,0.44fr)_minmax(0,1fr)] lg:gap-20">
              <div>
                <h2 className="mt-4 max-w-sm leading-[0.94]">
                  <span className="block font-coolvetica text-[clamp(2.9rem,5vw,5.4rem)] font-bold text-white">
                    WHERE IT
                  </span>
                  <span className="-mt-2 block font-brier text-[clamp(2.9rem,5vw,5.4rem)] font-semibold text-red">
                    LANDS.
                  </span>
                </h2>
                <p className="mt-6 max-w-sm text-sm leading-7 text-white/52">
                  Support does not disappear into overhead. It goes straight
                  into the parts, testing, travel, and event costs that keep the
                  team on the ground and on track.
                </p>
              </div>

              <div>
                {impactAreas.map((item) => (
                  <div
                    key={item.number}
                    className="group border-t border-white/10 py-7 transition-colors duration-300 hover:border-white/20"
                  >
                    <div className="grid gap-4 md:grid-cols-[5rem_minmax(0,1fr)_minmax(0,0.72fr)] md:items-start">
                      <div className="font-clash text-2xl font-medium tracking-wide text-white/28">
                        {item.number}
                      </div>
                      <h3 className="font-coolvetica text-[clamp(1.7rem,3vw,2.8rem)] leading-none text-white">
                        {item.title.toUpperCase()}
                      </h3>
                      <p className="max-w-xl text-sm leading-7 text-white/54">
                        {item.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </PageContainer>
        </section>

        <section className="pb-24 pt-8 lg:pt-12">
          <PageContainer>
            <div className="grid gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,0.75fr)] lg:items-end">
              <div className="max-w-2xl">
                <h2 className="leading-[0.94]">
                  <span className="block font-coolvetica text-[clamp(2.8rem,5vw,5.2rem)] font-bold text-white">
                    BACK THE
                  </span>
                  <span className="-mt-2 block font-brier text-[clamp(2.8rem,5vw,5.2rem)] font-semibold text-red">
                    NEXT RUN.
                  </span>
                </h2>
                <p className="mt-6 max-w-xl text-sm leading-7 text-white/56">
                  Want to support as a company, alum, or technical partner?
                  We are always looking for sponsors, in-kind manufacturing
                  help, and relationships that make the car faster and the
                  team stronger.
                </p>
              </div>

              <div className="space-y-5">
                <a
                  href="mailto:baja-exec@case.edu"
                  className="group flex items-center justify-between border border-white/10 px-5 py-4 transition-colors duration-300 hover:border-white/22"
                >
                  <div className="flex items-center gap-4">
                    <Mail className="h-5 w-5 text-red" />
                    <div>
                      <p className="text-[0.65rem] font-medium tracking-[0.24em] uppercase text-white/34">
                        Contact the team
                      </p>
                      <p className="mt-1 text-sm text-white/72">
                        baja-exec@case.edu
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-white/54 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-white" />
                </a>

                <Link
                  href="/sponsors"
                  className="group flex items-center justify-between border border-white/10 px-5 py-4 transition-colors duration-300 hover:border-white/22"
                >
                  <div>
                    <p className="text-[0.65rem] font-medium tracking-[0.24em] uppercase text-white/34">
                      See the current roster
                    </p>
                    <p className="mt-1 text-sm text-white/72">
                      Browse the partners already backing the program.
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-white/54 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-white" />
                </Link>
              </div>
            </div>
          </PageContainer>
        </section>
      </main>

      <Footer />
    </>
  );
}
