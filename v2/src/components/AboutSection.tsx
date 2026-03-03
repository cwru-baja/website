"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export default function AboutSection() {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.15 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={ref} className="bg-bg overflow-hidden pt-24 lg:pt-36">

      {/* Main body */}
      <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row">

        {/* Left — Photo */}
        <div
          className="relative lg:w-[56%] min-h-[360px] lg:min-h-[560px] overflow-hidden"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? "translateX(0)" : "translateX(-28px)",
            transition: "opacity 0.85s cubic-bezier(0.16,1,0.3,1), transform 0.85s cubic-bezier(0.16,1,0.3,1)",
          }}
        >
          <Image
            src="/images/about.jpg"
            alt="CWRU Motorsports team in the pits"
            fill
            className="object-cover"
            style={{ objectPosition: "center 35%" }}
            sizes="(max-width: 1024px) 100vw, 56vw"
          />

          {/* Right-edge gradient — bleeds into text panel */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(to right, transparent 55%, rgba(10,10,10,0.85) 85%, #0a0a0a 100%)",
            }}
          />

          {/* Bottom gradient */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(to top, rgba(10,10,10,0.55) 0%, transparent 35%)",
            }}
          />

          {/* Red glow overlay */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 50% 60% at 20% 70%, rgba(188,33,33,0.07) 0%, transparent 70%)",
            }}
          />
        </div>

        {/* Right — Text panel */}
        <div
          className="relative flex-1 flex flex-col justify-center px-8 py-14 lg:px-12 xl:px-16"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(22px)",
            transition:
              "opacity 0.85s cubic-bezier(0.16,1,0.3,1) 0.18s, transform 0.85s cubic-bezier(0.16,1,0.3,1) 0.18s",
          }}
        >
          {/* Headline */}
          <h2
            className="font-bebas leading-[0.88] tracking-tight text-white"
            style={{ fontSize: "clamp(4rem, 5.5vw, 7rem)" }}
          >
            WHO
            <br />
            <span className="text-red">WE ARE.</span>
          </h2>

          {/* Body */}
          <p className="mt-6 max-w-sm text-[0.82rem] leading-relaxed text-white/40">
            CWRU Motorsports is a student-run engineering team at Case Western
            Reserve University. Every year we design, fabricate, and race a
            competition-grade off-road vehicle in the international Baja SAE
            series — pushing boundaries against hundreds of university teams
            across North America.
          </p>

          {/* CTA */}
          <div className="mt-9">
            <Link
              href="/team"
              className="inline-flex items-center gap-2 border border-white/10 px-6 py-2.5 text-[0.67rem] font-semibold tracking-[0.18em] uppercase text-white/40 transition-all duration-200 hover:border-white/25 hover:text-white"
            >
              Meet the Team
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
