import Image from "next/image";
import Footer from "@/components/Footer";
import FinanceDonutChart from "@/components/FinanceDonutChart";
import Navbar from "@/components/Navbar";
import PageContainer from "@/components/PageContainer";

export const metadata = {
  title: "Support — CWRU Motorsports",
  description: "Support CWRU Motorsports through donations or official team apparel.",
};

export default function SupportPage() {
  return (
    <>
      <Navbar />

      <main className="bg-bg">
        <header className="pt-36 pb-14 sm:pt-40 sm:pb-16 lg:pb-20">
          <PageContainer>
            <h1
              className="font-coolvetica font-bold leading-[0.88] text-white"
              style={{ fontSize: "clamp(4.5rem, 10vw, 11rem)" }}
            >
              SUPPORT <span className="text-red">US.</span>
            </h1>

            <div className="mt-8 h-px w-full bg-white/10" />

            <div className="mt-6 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex flex-wrap gap-x-10 gap-y-3">
                {[
                  { value: "2", label: "Ways to Help" },
                  { value: "2026", label: "Season" },
                ].map(({ value, label }) => (
                  <div key={label} className="flex items-baseline gap-2">
                    <span className="font-clash text-2xl font-medium tracking-wide text-white">
                      {value}
                    </span>
                    <span className="text-[0.7rem] font-medium uppercase tracking-[0.18em] text-white/40">
                      {label}
                    </span>
                  </div>
                ))}
              </div>

              <p className="max-w-xl text-base leading-relaxed text-white/60 lg:text-right lg:text-lg">
                Every donation and purchase helps our student team turn ambitious engineering
                into a competition-ready off-road vehicle.
              </p>
            </div>
          </PageContainer>
        </header>

        <section aria-labelledby="donation-heading" className="pb-24 lg:pb-32">
          <PageContainer>
            <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(30rem,1.15fr)] lg:gap-16">
              <div className="py-12 sm:py-16 lg:py-24">
                <h2 id="donation-heading" className="leading-[0.84] text-white">
                  <span className="block font-coolvetica text-[clamp(3.2rem,5.5vw,6rem)] font-bold tracking-wide">
                    FUND THE
                  </span>
                  <span className="block font-brier text-[clamp(3rem,5.2vw,5.6rem)] font-semibold tracking-wide text-red">
                    BUILD.
                  </span>
                </h2>

                <p className="mt-8 max-w-lg text-base leading-relaxed text-white/60">
                  Your contribution helps CWRU Baja SAE design, build, test, and compete.
                  Donations directly support the equipment, materials, competition fees, and
                  travel that move our season forward.
                </p>

                <div className="mt-12">
                  <p className="border-l-2 border-red pl-4 text-sm leading-relaxed text-white/45">
                    On the giving form, choose &ldquo;Other&rdquo; in the gift designation field and
                    enter &ldquo;Baja&rdquo;.
                  </p>
                  <a
                    href="https://www.givecampus.com/71er24"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-8 inline-flex min-h-12 items-center justify-center bg-red px-8 py-3 font-coolvetica text-sm uppercase tracking-[0.12em] text-white transition-colors hover:bg-red-dim focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                  >
                    Donate Now
                  </a>
                </div>
              </div>

              <FinanceDonutChart />
            </div>
          </PageContainer>
        </section>

        <section aria-labelledby="gear-heading" className="bg-bg py-10 sm:py-14 lg:py-20">
          <PageContainer>
            <article className="grid overflow-hidden lg:grid-cols-2">
              <div className="relative min-h-[28rem] overflow-hidden sm:min-h-[36rem]">
                <Image
                  src="/images/cwru-baja-tshirt.png"
                  alt="Official navy CWRU Motorsports team T-shirt"
                  fill
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="scale-[0.86] object-contain"
                />
              </div>

              <div className="flex flex-col items-end py-8 pl-8 text-right sm:py-10 sm:pl-10 lg:py-14 lg:pl-14 xl:py-16 xl:pl-16">
                <div className="w-full">
                  <h2 id="gear-heading" className="leading-[0.84] text-white">
                    <span className="block font-coolvetica text-[clamp(3.4rem,6vw,7rem)] font-bold tracking-wide">
                      GET THE
                    </span>
                    <span className="block font-brier text-[clamp(3.2rem,5.7vw,6.6rem)] font-semibold tracking-wide text-red">
                      GEAR.
                    </span>
                  </h2>
                  <p className="mt-8 ml-auto max-w-md text-base leading-relaxed text-white/55">
                    Support the team with official CWRU Motorsports apparel. Every purchase
                    directly helps fund equipment, travel expenses, and competition fees.
                  </p>
                </div>

                <a
                  href="https://cwrubaja.printful.me/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-10 inline-flex min-h-12 w-fit items-center justify-center bg-red px-8 py-3 font-coolvetica text-sm uppercase tracking-[0.12em] text-white transition-colors hover:bg-red-dim focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                >
                  Shop Now
                </a>
              </div>
            </article>
          </PageContainer>
        </section>
      </main>

      <Footer />
    </>
  );
}
