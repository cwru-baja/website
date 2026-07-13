"use client";

import { useEffect, useRef, useState } from "react";

const stats = [
  { value: 40,  suffix: "+", label: "Team Members",        sublabel: "Engineers & Builders" },
  { value: 20,  suffix: "+", label: "Years Competing",     sublabel: "Baja SAE" },
  { value: 3,   suffix: "",  label: "Competitions / Year", sublabel: "Across North America" },
  { value: 100, suffix: "%", label: "Student Built",       sublabel: "Design to Fabrication" },
];

function StatItem({
  value,
  suffix,
  label,
  sublabel,
  delay,
  active,
}: {
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
      className="relative flex flex-col px-10 xl:px-14 py-12 transition-opacity duration-700"
      style={{
        opacity: active ? 1 : 0,
        transform: active ? "translateY(0)" : "translateY(18px)",
        transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
      }}
    >
      {/* Number */}
      <div
        className="font-clash font-medium leading-none mt-2"
        style={{ fontSize: "clamp(4.5rem, 7vw, 9rem)", color: "#fff" }}
      >
        {count}
        <span className="text-red font-light">{suffix}</span>
      </div>

      {/* Label */}
      <div className="mt-4 space-y-1">
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
    <section ref={ref} className="bg-bg">
      <div className="max-w-[1600px] mx-auto px-8 lg:px-16 xl:px-24">
        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-white/5">
          {stats.map((stat, i) => (
            <StatItem
              key={stat.label}
              {...stat}
              delay={i * 120}
              active={active}
            />
          ))}
        </div>

      </div>
    </section>
  );
}
