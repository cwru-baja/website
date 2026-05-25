"use client";

import { useEffect, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import PageContainer from "@/components/PageContainer";
import { EVENTS } from "@/lib/events";

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
  const isFirstRender = useRef(true);

  const active = EVENTS[displayIndex] ?? null;

  // Tick against the displayed competition
  useEffect(() => {
    const tick = () => { if (active) setTimeLeft(calcTimeLeft(active.startDate)); };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [active]);

  // ── EXIT: selectedIndex changed → sweep old digits out, then update displayIndex ──
  useGSAP(() => {
    if (selectedIndex === displayIndex) return;

    const units = Array.from(unitsRef.current?.querySelectorAll<HTMLElement>(".cd-unit") ?? []);
    gsap.killTweensOf(units);

    gsap.timeline()
      // digits exit right→left (reverse cascade = S→M→H→D)
      .to([...units].reverse(), {
        y: -32,
        opacity: 0,
        duration: 0.18,
        stagger: 0.04,
        ease: "power3.in",
      })
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
    gsap.killTweensOf(units);

    gsap.timeline()
      // digits arrive left→right (D→H→M→S)
      .fromTo(units,
        { y: 32, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.28, stagger: 0.05, ease: "power3.out" }
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
      <PageContainer className="py-16">

        {/* Each unit is wrapped in overflow-hidden so digits clip cleanly as they slide */}
        <div ref={unitsRef} className="flex items-baseline justify-start gap-0 select-none">
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

      </PageContainer>
    </section>
  );
}
