"use client";

import { useEffect, useRef, useState } from "react";
import { MEMBER_COUNT, roundedDown } from "@/lib/team";

const stats = [
  { value: roundedDown(MEMBER_COUNT), suffix: "+", label: "Team Members",        sublabel: "Engineers & Builders" },
  { value: 20,  suffix: "+", label: "Years Competing",     sublabel: "Baja SAE" },
  { value: 3,   suffix: "",  label: "Competitions / Year", sublabel: "Across North America" },
  { value: 100, suffix: "%", label: "Student Built",       sublabel: "Design to Fabrication" },
];

function StatItem({
  className,
  value,
  suffix,
  label,
  sublabel,
  delay,
  active,
}: {
  className: string;
  value: number;
  suffix: string;
  label: string;
  sublabel: string;
  delay: number;
  active: boolean;
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!active) return;

    let start: number | null = null;
    let frame = 0;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      frame = requestAnimationFrame(() => setCount(value));
      return () => cancelAnimationFrame(frame);
    }
    const step = (timestamp: number) => {
      if (start === null) start = timestamp;
      const progress = Math.min((timestamp - start) / 1400, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * value));
      if (progress < 1) frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [active, value]);

  return (
    <div
      className={`relative flex min-w-0 flex-col px-4 py-12 transition-opacity duration-700 sm:px-10 xl:px-14 ${className}`}
      style={{
        opacity: active ? 1 : 0,
        transform: active ? "translateY(0)" : "translateY(18px)",
        transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
      }}
    >
      {/* Number. The third limit keeps the widest value, "100%" (2.54em), inside
          its cell on a phone: two columns, px-8 around the grid and px-4 inside
          each cell leave 50vw - 4rem. It only binds below about 420px. */}
      <div
        className="relative mt-2 font-clash font-medium leading-none"
        style={{
          fontSize: "min(max(3.5rem, 7vw), 9rem, calc((50vw - 4rem) / 2.6))",
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
      <div className="mx-auto flex w-full max-w-[1600px] justify-center">
        {/* Stats grid */}
        {/* Each cell draws its own divider: the left column in two rows, every
            cell but the last in one. divide-x drew a stray line at the grid's
            right edge once the four wrapped into two rows. */}
        <div className="grid w-full grid-cols-2 lg:grid-cols-4 xl:w-fit xl:grid-cols-[repeat(4,max-content)]">
          {stats.map((stat, i) => (
            <StatItem
              key={stat.label}
              {...stat}
              delay={i * 120}
              className={`border-white/5 ${i % 2 === 0 ? "border-r" : ""} ${
                i < stats.length - 1 ? "lg:border-r" : "lg:border-r-0"
              }`}
              active={active}
            />
          ))}
        </div>

      </div>
    </section>
  );
}
