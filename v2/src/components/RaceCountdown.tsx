"use client";

import { useEffect, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import PageContainer from "@/components/PageContainer";

const COMPETITION_DATES: { name: string; location: string; date: Date }[] = [
  { name: "Baja SAE Tennessee", location: "Cookeville, TN",  date: new Date("2026-03-20T08:00:00") },
  { name: "Baja SAE Kansas",    location: "Pittsburg, KS",   date: new Date("2026-05-29T08:00:00") },
  { name: "Baja SAE Oregon",    location: "Corvallis, OR",   date: new Date("2026-09-18T08:00:00") },
];

interface TimeLeft { days: number; hours: number; minutes: number; seconds: number; }

function calcTimeLeft(target: Date): TimeLeft {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  return {
    days:    Math.floor(diff / 86400000),
    hours:   Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000)  / 60000),
    seconds: Math.floor((diff % 60000)    / 1000),
  };
}

function pad(n: number, len = 2) { return String(n).padStart(len, "0"); }

export default function RaceCountdown({ selectedIndex }: { selectedIndex: number }) {
  // displayIndex is what's currently rendered — lags behind selectedIndex during transition
  const [displayIndex, setDisplayIndex] = useState(selectedIndex);
  const [timeLeft, setTimeLeft]         = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  const unitsRef      = useRef<HTMLDivElement>(null);
  const metaRef       = useRef<HTMLParagraphElement>(null);
  const isFirstRender = useRef(true);

  const active = COMPETITION_DATES[displayIndex] ?? null;

  // Tick against the displayed competition
  useEffect(() => {
    const tick = () => { if (active) setTimeLeft(calcTimeLeft(active.date)); };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [active]);

  // ── EXIT: selectedIndex changed → sweep old digits out, then update displayIndex ──
  useGSAP(() => {
    if (selectedIndex === displayIndex) return;

    const units = Array.from(unitsRef.current?.querySelectorAll<HTMLElement>(".cd-unit") ?? []);
    gsap.killTweensOf([...units, metaRef.current]);

    gsap.timeline()
      // digits exit right→left (reverse cascade = S→M→H→D)
      .to([...units].reverse(), {
        y: -32,
        opacity: 0,
        duration: 0.18,
        stagger: 0.04,
        ease: "power3.in",
      })
      // date text fades with digits
      .to(metaRef.current, {
        y: -16,
        opacity: 0,
        duration: 0.15,
        ease: "power2.in",
      }, "<0.06")
      // swap content after exit completes
      .add(() => setDisplayIndex(selectedIndex));
  }, [selectedIndex]);

  // ── ENTER: displayIndex updated → drop new digits in ──
  useGSAP(() => {
    // skip the very first mount — no need to animate on load
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const units = Array.from(unitsRef.current?.querySelectorAll<HTMLElement>(".cd-unit") ?? []);
    gsap.killTweensOf([...units, metaRef.current]);

    gsap.timeline()
      // digits arrive left→right (D→H→M→S)
      .fromTo(units,
        { y: 32, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.28, stagger: 0.05, ease: "power3.out" }
      )
      // date text follows
      .fromTo(metaRef.current,
        { y: 16, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.22, ease: "power2.out" },
        "<0.1"
      );
  }, [displayIndex]);

  const units = [
    { value: pad(timeLeft.days, 2), label: "D" },
    { value: pad(timeLeft.hours),   label: "H" },
    { value: pad(timeLeft.minutes), label: "M" },
    { value: pad(timeLeft.seconds), label: "S" },
  ];

  if (!active) {
    return (
      <section className="bg-bg py-24">
        <PageContainer>
          <p className="text-center text-[0.62rem] font-semibold tracking-[0.28em] uppercase text-red">
            Season Complete
          </p>
          <p className="mt-4 text-center text-white/30 text-sm">
            All competitions for this season have concluded.
          </p>
        </PageContainer>
      </section>
    );
  }

  return (
    <section className="bg-bg overflow-hidden">
      <PageContainer className="pt-2 pb-16 lg:pb-20">

        {/* Each unit is wrapped in overflow-hidden so digits clip cleanly as they slide */}
        <div ref={unitsRef} className="flex items-baseline justify-center gap-0 select-none">
          {units.map(({ value, label }, i) => (
            <div key={i} className="cd-unit overflow-hidden flex items-baseline">
              <span
                className="font-coolvetica font-bold leading-none text-white tabular-nums"
                style={{ fontSize: "clamp(3rem, 11.5vw, 12.5rem)" }}
              >
                {value}
              </span>
              <span
                className="font-coolvetica font-bold leading-none text-white/20 tabular-nums"
                style={{
                  fontSize: "clamp(2rem, 7vw, 8rem)",
                  marginLeft: "0.04em",
                  marginRight: i < units.length - 1 ? "0.14em" : 0,
                }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>

        <p
          ref={metaRef}
          className="mt-6 text-center text-[0.62rem] tracking-[0.22em] uppercase text-white/20"
        >
          {active.date.toLocaleDateString("en-US", {
            weekday: "long", year: "numeric", month: "long", day: "numeric",
          })}
        </p>

      </PageContainer>
    </section>
  );
}
