import Image from "next/image";
import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative h-dvh overflow-hidden bg-bg">
      {/* Aurora background layer */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{
          maskImage: "linear-gradient(to bottom, transparent 0%, transparent 7%, black 14%), radial-gradient(ellipse 140% 70% at 65% 45%, black 0%, transparent 70%)",
          maskComposite: "intersect",
          WebkitMaskComposite: "source-in",
        }}
      >
        {/* Layer 1 — 100deg, 120s */}
        <div
          className="absolute -inset-[10px] will-change-transform"
          style={{
            backgroundImage:
              "repeating-linear-gradient(100deg, #000 0%, #000 7%, transparent 10%, transparent 12%, #000 16%), repeating-linear-gradient(100deg, #bc2121 10%, #8a1818 18%, #3d0a0a 25%, #600d0d 32%, #8a1818 40%)",
            backgroundSize: "600%, 400%",
            backgroundPosition: "50% 50%, 50% 50%",
            animation: "aurora 120s linear infinite",
            opacity: 0.55,
            filter: "blur(8px)",
          }}
        />
        {/* Layer 2 — 130deg, 83s (different angle + speed creates interference) */}
        <div
          className="absolute -inset-[10px] will-change-transform"
          style={{
            backgroundImage:
              "repeating-linear-gradient(130deg, #000 0%, #000 7%, transparent 10%, transparent 12%, #000 16%), repeating-linear-gradient(130deg, #8a1818 10%, #600d0d 18%, #bc2121 25%, #3d0a0a 32%, #600d0d 40%)",
            backgroundSize: "600%, 400%",
            backgroundPosition: "50% 50%, 50% 50%",
            animation: "aurora 83s linear infinite",
            opacity: 0.4,
            filter: "blur(8px)",
          }}
        />
      </div>

      {/* Subtle red glow behind the car */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 70% at 80% 55%, rgba(169, 10, 28, 0.07) 0%, transparent 70%)",
        }}
      />

      {/* Constrained inner layout */}
      <div className="relative flex h-full max-w-[1600px] mx-auto">

      {/* Left panel — text content */}
      <div className="relative z-10 flex w-[42%] flex-col justify-start pt-[18%] px-8 pl-16 lg:pl-20 xl:pl-28">
        {/* Headline */}
        <h1 className="leading-[1.05] text-white" style={{ fontSize: "clamp(3rem, 7vw, 7.5rem)" }}>
          <span className="block font-coolvetica font-bold leading-none">BUILT</span>
          <span className="block font-brier font-semibold text-red leading-none -mt-5">TO WIN.</span>
        </h1>

        {/* Subtitle */}
        <div className="mt-6">
          <p className="text-sm tracking-widest uppercase text-white/40 font-light">
            Built at Case.&nbsp;&nbsp;Raced Everywhere.
          </p>
        </div>

        {/* Description */}
        <p className="mt-6 max-w-xs text-[0.82rem] leading-relaxed text-white/40">
          We design and manufacture a competition-grade off-road vehicle from
          scratch every year, then race it against hundreds of teams across
          North America.
        </p>

        {/* CTAs */}
        <div className="mt-9 flex items-center gap-4">
          <Link
            href="/team"
            className="inline-flex items-center gap-2 bg-red px-7 py-3 text-[0.7rem] font-semibold tracking-[0.2em] uppercase text-white transition-colors duration-200 hover:bg-red/85"
          >
            Meet the Team
          </Link>
          <Link
            href="/car"
            className="inline-flex items-center gap-2 border border-white/15 px-7 py-3 text-[0.7rem] font-semibold tracking-[0.2em] uppercase text-white/55 transition-all duration-200 hover:border-white/30 hover:text-white"
          >
            View the Car
          </Link>
        </div>
      </div>

      {/* Car render — fully contained, scales with viewport */}
      <div className="absolute top-[4%] bottom-[2%] left-[40%] right-[1%]">
        <Image
          src="/homepage-car-sr26.png"
          alt="CWRU Motorsports Baja Car"
          fill
          sizes="59vw"
          className="object-contain"
          style={{ objectPosition: "left center" }}
          priority
        />
      </div>

      </div>{/* end constrained inner layout */}
    </section>
  );
}
