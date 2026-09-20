"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { HEADLINE_MEMBERS } from "@/lib/team";

// `phrase` follows the number in the paragraph below lg.
const stats = [
  { value: HEADLINE_MEMBERS, suffix: "+", label: "Team Members",        sublabel: "Engineers & Builders",  phrase: "engineers and builders." },
  { value: 20,  suffix: "+", label: "Years Competing",     sublabel: "Baja SAE",              phrase: "years at Baja SAE." },
  { value: 3,   suffix: "",  label: "Competitions / Year", sublabel: "Across North America",  phrase: "races each season." },
  { value: 100, suffix: "%", label: "Student Built",       sublabel: "Design to Fabrication", phrase: "student built." },
];

/** 0 -> 1 over 1.4s, ease-out cubic, once `active` turns true. Every number counts off the same clock. */
function useCountUp(active: boolean) {
  const [eased, setEased] = useState(0);

  useEffect(() => {
    if (!active) return;

    let start: number | null = null;
    let frame = 0;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      frame = requestAnimationFrame(() => setEased(1));
      return () => cancelAnimationFrame(frame);
    }
    const step = (timestamp: number) => {
      if (start === null) start = timestamp;
      const progress = Math.min((timestamp - start) / 1400, 1);
      setEased(1 - Math.pow(1 - progress, 3));
      if (progress < 1) frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [active]);

  return eased;
}

/** Fade up 18px once the section is in view. */
function reveal(active: boolean, delay: number) {
  return {
    opacity: active ? 1 : 0,
    transform: active ? "translateY(0)" : "translateY(18px)",
    transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
  };
}

/**
 * A number inside the sentence. The finished value sits underneath, invisible,
 * so the box is its final width from the first frame and the words after it
 * don't reflow while it counts.
 */
function InlineFigure({ value, count, suffix }: { value: number; count: number; suffix: string }) {
  return (
    <span className="relative inline-block whitespace-nowrap leading-none text-white">
      <span aria-hidden="true" className="invisible">
        {value}
        <span className="font-light">{suffix}</span>
      </span>
      <span className="absolute inset-0">
        {count}
        <span className="font-light text-livery-pop">{suffix}</span>
      </span>
    </span>
  );
}

function StatItem({
  className,
  value,
  count,
  suffix,
  label,
  sublabel,
  delay,
  active,
}: {
  className: string;
  value: number;
  count: number;
  suffix: string;
  label: string;
  sublabel: string;
  delay: number;
  active: boolean;
}) {
  return (
    <div
      className={`relative flex min-w-0 flex-col px-10 py-12 transition-opacity duration-700 xl:px-14 ${className}`}
      style={reveal(active, delay)}
    >
      {/* Number */}
      <div
        className="relative mt-2 font-clash font-medium leading-none"
        style={{
          fontSize: "min(max(3.5rem, 7vw), 9rem)",
          color: "#fff",
        }}
      >
        <span aria-hidden="true" className="invisible hidden whitespace-nowrap xl:block">
          {value}
          <span className="font-light text-livery-pop">{suffix}</span>
        </span>
        <span className="whitespace-nowrap xl:absolute xl:inset-0">
          {count}
          <span className="font-light text-livery-pop">{suffix}</span>
        </span>
      </div>

      {/* Label */}
      <div className="mt-4 space-y-1 xl:whitespace-nowrap">
        <p className="text-sm font-semibold tracking-wide text-white/80">{label}</p>
        <p className="text-[0.65rem] tracking-[0.2em] uppercase text-white/30">{sublabel}</p>
      </div>
    </div>
  );
}

export default function StatsSection() {
  const ref = useRef<HTMLElement>(null);
  const [active, setActive] = useState(false);
  const eased = useCountUp(active);
  const counts = stats.map((stat) => Math.floor(eased * stat.value));

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setActive(true); },
      { threshold: 0.25 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={ref} className="bg-bg px-8 lg:px-16">
      {/* Below lg the stats are one run of big type, numbers in white. A grid of
          four read as the desktop row folded in half. "Across North America" and
          "Design to Fabrication" are left out: they ran it to eight lines. The
          wording is measured, not chosen by ear: "3 competitions a year" left a
          half-empty line on every phone, because "competitions" never fit after
          "Baja SAE.". text-wrap: pretty only does anything around 480px, where it
          keeps "built." off a line of its own. */}
      <p
        className="py-10 font-clash font-medium text-white/35 lg:hidden"
        style={{ fontSize: "min(2.25rem, 8.6vw)", lineHeight: 1.15, letterSpacing: "-0.01em", textWrap: "pretty", ...reveal(active, 0) }}
      >
        {stats.map((stat, i) => (
          <Fragment key={stat.label}>
            <InlineFigure value={stat.value} count={counts[i]} suffix={stat.suffix} /> {stat.phrase}{" "}
          </Fragment>
        ))}
      </p>

      <div className="mx-auto hidden w-full max-w-[1600px] justify-center lg:flex">
        {/* Stats grid. Every cell but the last draws its own divider. */}
        <div className="grid w-full grid-cols-4 xl:w-fit xl:grid-cols-[repeat(4,max-content)]">
          {stats.map((stat, i) => (
            <StatItem
              key={stat.label}
              {...stat}
              count={counts[i]}
              delay={i * 120}
              className={`border-white/5 ${i < stats.length - 1 ? "border-r" : ""}`}
              active={active}
            />
          ))}
        </div>

      </div>
    </section>
  );
}
