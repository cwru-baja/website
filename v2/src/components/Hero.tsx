import Image from "next/image";
import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative h-dvh overflow-hidden bg-bg">
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
      <div className="relative z-10 flex w-[42%] flex-col justify-center px-8 pl-16 lg:pl-20 xl:pl-28">
        {/* Headline */}
        <h1 className="leading-[1.05] text-white" style={{ fontSize: "clamp(3rem, 7vw, 7.5rem)" }}>
          <span className="block font-satoshi font-black tracking-tight">BUILT</span>
          <span className="block font-butler font-semibold text-red">TO WIN.</span>
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

      {/* Right panel — car render */}
      <div className="relative flex-1">

        <Image
          src="/main.webp"
          alt="CWRU Motorsports Baja Car"
          fill
          className="object-contain"
          style={{ objectPosition: "50% center", scale: "1.9", translate: "4% 3%" }}
          priority
        />
      </div>

      </div>{/* end constrained inner layout */}
    </section>
  );
}
