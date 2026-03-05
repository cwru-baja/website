import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PageContainer from "@/components/PageContainer";
import Image from "next/image";

export const metadata = {
  title: "Support — CWRU Motorsports",
  description: "Support CWRU Motorsports through donations or official team apparel.",
};

export default function SupportPage() {
  return (
    <>
      <Navbar />

      {/* Page header */}
      <section className="bg-bg pt-40 pb-0">
        <PageContainer>
          <h1
            className="font-coolvetica font-bold leading-[0.88] text-white"
            style={{ fontSize: "clamp(5rem, 10vw, 11rem)" }}
          >
            SUPPORT <span className="text-red">US.</span>
          </h1>

          <div className="mt-8 h-px w-full bg-white/8" />

          <div className="mt-6 flex flex-wrap gap-x-10 gap-y-2">
            {[
              { value: "2", label: "Ways to Help" },
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
        </PageContainer>
      </section>

      {/* Donate + Apparel sections */}
      <section className="bg-bg py-24">
        <PageContainer>
          <div className="flex flex-col gap-24">

            {/* Donate — left aligned */}
            <div>
              <div className="leading-none mb-6">
                <div className="font-coolvetica font-bold text-[clamp(2rem,4vw,4rem)] tracking-wide text-white leading-none">
                  MAKE A
                </div>
                <div className="font-brier font-semibold text-[clamp(2rem,4vw,4rem)] tracking-wide text-red leading-none -mt-2">
                  DONATION.
                </div>
              </div>
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
                <div>
                  <p className="text-sm text-white/50 max-w-md leading-relaxed">
                    Your generous contribution helps CWRU Baja SAE continue to design, build,
                    and compete with our off-road vehicles. Donations directly support new
                    equipment, materials, competition fees, and travel expenses.
                  </p>
                  <p className="mt-3 text-xs text-white/30 max-w-md leading-relaxed">
                    Once reaching the giving form, check &ldquo;other&rdquo; in the gift
                    designation field and enter &ldquo;Baja&rdquo;.
                  </p>
                </div>
                <div className="shrink-0">
                  <a
                    href="https://www.givecampus.com/71er24"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center px-8 py-3 bg-red text-white text-sm font-coolvetica tracking-[0.12em] uppercase transition-opacity hover:opacity-80"
                  >
                    Donate Now
                  </a>
                </div>
              </div>
            </div>

            {/* Apparel — right aligned */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
              {/* Left: blurb + button */}
              <div className="flex flex-col items-start gap-6">
                <p className="text-sm text-white/50 max-w-sm leading-relaxed">
                  Support our team with official CWRU Motorsports apparel. Every purchase
                  directly helps fund equipment, travel expenses, and competition fees.
                </p>
                <a
                  href="https://cwrubaja.printful.me/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center px-8 py-3 bg-red text-white text-sm font-coolvetica tracking-[0.12em] uppercase transition-opacity hover:opacity-80"
                >
                  Shop Now
                </a>
              </div>

              {/* Right: heading + t-shirt */}
              <div className="flex flex-col items-end gap-4 shrink-0">
                <div className="leading-none text-right">
                  <div className="font-coolvetica font-bold text-[clamp(2rem,4vw,4rem)] tracking-wide text-white leading-none">
                    GET THE
                  </div>
                  <div className="font-brier font-semibold text-[clamp(2rem,4vw,4rem)] tracking-wide text-red leading-none -mt-2">
                    GEAR.
                  </div>
                </div>
                <Image
                  src="/images/cwru-baja-tshirt.png"
                  alt="CWRU Baja SAE T-Shirt"
                  width={280}
                  height={280}
                  className="w-48 h-auto object-contain"
                />
              </div>
            </div>

          </div>
        </PageContainer>
      </section>

      <Footer />
    </>
  );
}
