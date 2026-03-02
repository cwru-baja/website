"use client";

import { useEffect, useRef, useState } from "react";

const events = [
  {
    tag: "JAN — MAR",
    name: "Baja SAE\nTennessee",
    location: "Cookeville, TN",
    desc: "Timed hill climbs, rock crawls, and a four-hour endurance race across punishing Appalachian terrain.",
  },
  {
    tag: "MAY",
    name: "Baja SAE\nKansas",
    location: "Pittsburg, KS",
    desc: "Open plains and deep mud test raw suspension design, powertrain durability, and static engineering reviews.",
  },
  {
    tag: "JUN — OCT",
    name: "Baja SAE\nOregon",
    location: "Corvallis, OR",
    desc: "Technical off-camber trails and steep grades at the Northwest's most demanding off-road proving ground.",
  },
];

export default function CompetitionSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="bg-bg overflow-hidden pt-24 lg:pt-48">

      {/* ── Header block ── */}
      <div className="max-w-[1600px] mx-auto px-8 lg:px-12 xl:px-16">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">

          {/* Title */}
          <div
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? "translateY(0)" : "translateY(22px)",
              transition: "opacity 0.85s cubic-bezier(0.16,1,0.3,1), transform 0.85s cubic-bezier(0.16,1,0.3,1)",
            }}
          >
            {/* Eyebrow */}
            <p className="mb-3 text-[0.62rem] font-semibold tracking-[0.28em] uppercase text-red">
              Baja SAE Series
            </p>

            <h2
              className="font-bebas leading-[0.88] tracking-tight text-white"
              style={{ fontSize: "clamp(4rem, 5.5vw, 7rem)" }}
            >
              THE
              <br />
              <span className="text-red">COMPETITION.</span>
            </h2>
          </div>

          {/* Right descriptor */}
          <div
            className="lg:max-w-xs xl:max-w-sm pb-2"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? "translateY(0)" : "translateY(22px)",
              transition: "opacity 0.85s cubic-bezier(0.16,1,0.3,1) 0.14s, transform 0.85s cubic-bezier(0.16,1,0.3,1) 0.14s",
            }}
          >
            <p className="text-[0.82rem] leading-relaxed text-white/40">
              Baja SAE pits student-built off-road vehicles against rough terrain in
              a global competition series sanctioned by SAE International. Each year
              we qualify for — and race in — three events across North America,
              competing against hundreds of university teams on dynamic design,
              endurance, and engineering excellence.
            </p>
          </div>
        </div>
      </div>

      {/* ── Video ── */}
      <div
        className="mt-12 lg:mt-16 mx-auto max-w-[1600px] px-8 lg:px-12 xl:px-16"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(32px)",
          transition: "opacity 0.9s cubic-bezier(0.16,1,0.3,1) 0.26s, transform 0.9s cubic-bezier(0.16,1,0.3,1) 0.26s",
        }}
      >
        {/* Red top accent line */}
        <div className="h-[2px] w-16 bg-red mb-0" />

        {/* Video wrapper */}
        <div className="relative w-full overflow-hidden" style={{ paddingBottom: "56.25%" }}>
          <iframe
            src="https://www.youtube.com/embed/wtBAbLzCRr0?rel=0&modestbranding=1&color=white"
            title="CWRU Motorsports — 2024 Season Recap"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
            style={{ border: "none" }}
          />

          {/* Edge vignette for depth */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              boxShadow: "inset 0 0 80px rgba(0,0,0,0.55)",
            }}
          />
        </div>

        {/* Bottom red rule */}
        <div className="h-[1px] w-full bg-white/5" />
      </div>

      {/* ── Events strip ── */}
      <div className="max-w-[1600px] mx-auto mt-0">
        <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-white/5">
          {events.map((ev, i) => (
            <div
              key={i}
              className="relative px-8 lg:px-12 xl:px-16 py-10 group"
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0)" : "translateY(18px)",
                transition: `opacity 0.75s cubic-bezier(0.16,1,0.3,1) ${0.4 + i * 0.1}s, transform 0.75s cubic-bezier(0.16,1,0.3,1) ${0.4 + i * 0.1}s`,
              }}
            >
              {/* Hover red top line */}
              <div
                className="absolute top-0 left-8 lg:left-12 xl:left-16 right-8 h-[1px] bg-red origin-left transition-transform duration-500"
                style={{ transform: "scaleX(0)" }}
                aria-hidden="true"
              />
              <style>{`
                .event-card-${i}:hover .event-line-${i} { transform: scaleX(1) !important; }
              `}</style>

              {/* Season tag */}
              <p className="text-[0.6rem] tracking-[0.24em] uppercase text-red/70 mb-3 font-medium">
                {ev.tag}
              </p>

              {/* Event name */}
              <h3
                className="font-bebas leading-tight text-white"
                style={{ fontSize: "clamp(1.6rem, 2.4vw, 2.4rem)", whiteSpace: "pre-line" }}
              >
                {ev.name}
              </h3>

              {/* Location */}
              <p className="mt-1 text-[0.67rem] tracking-[0.18em] uppercase text-white/25">
                {ev.location}
              </p>

              {/* Description */}
              <p className="mt-4 text-[0.78rem] leading-relaxed text-white/35 max-w-xs">
                {ev.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

    </section>
  );
}
