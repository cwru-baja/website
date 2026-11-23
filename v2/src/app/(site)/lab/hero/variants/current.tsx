"use client";

// PROTOTYPE — throwaway. Baseline: the aurora that ships in components/Hero.tsx today.

import type { Variant } from "./types";

const AURORA_BRIGHT = "var(--livery)";
const AURORA_MID = "var(--livery-support)";
const AURORA_DARK = "var(--livery-deep)";
const AURORA_DARKEST = "color-mix(in oklab, var(--livery-deep) 55%, black)";
const AURORA_POP = "var(--livery-pop)";

// globals.css dropped these with the aurora; the lab keeps its own copy for the baseline.
const KEYFRAMES = `@keyframes aurora {
  from { background-position: 50% 50%, 50% 50%; }
  to   { background-position: 350% 50%, 350% 50%; }
}`;

function CurrentAurora() {
  return (
    <>
      <style>{KEYFRAMES}</style>
      <div
        className="absolute inset-0 overflow-hidden"
        style={{
          maskImage:
            "linear-gradient(to bottom, transparent 0%, transparent 7%, black 14%), radial-gradient(ellipse 140% 70% at 65% 45%, black 0%, transparent 70%)",
          maskComposite: "intersect",
          WebkitMaskComposite: "source-in",
        }}
      >
        <div
          className="absolute -inset-[10px] will-change-transform"
          style={{
            backgroundImage:
              "repeating-linear-gradient(100deg, #000 0%, #000 7%, transparent 10%, transparent 12%, #000 16%), " +
              `repeating-linear-gradient(100deg, ${AURORA_BRIGHT} 10%, ${AURORA_MID} 18%, ${AURORA_DARKEST} 25%, ${AURORA_DARK} 32%, ${AURORA_MID} 40%)`,
            backgroundSize: "600%, 400%",
            backgroundPosition: "50% 50%, 50% 50%",
            animation: "aurora 120s linear infinite",
            opacity: 0.55,
            filter: "blur(8px)",
          }}
        />
        <div
          className="absolute -inset-[10px] will-change-transform"
          style={{
            backgroundImage:
              "repeating-linear-gradient(130deg, #000 0%, #000 7%, transparent 10%, transparent 12%, #000 16%), " +
              `repeating-linear-gradient(130deg, ${AURORA_MID} 10%, ${AURORA_DARK} 18%, ${AURORA_POP} 25%, ${AURORA_DARKEST} 32%, ${AURORA_DARK} 40%)`,
            backgroundSize: "600%, 400%",
            backgroundPosition: "50% 50%, 50% 50%",
            animation: "aurora 83s linear infinite",
            opacity: 0.4,
            filter: "blur(8px)",
          }}
        />
      </div>
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 70% at 80% 55%, color-mix(in oklab, var(--livery) 12%, transparent) 0%, transparent 70%)",
        }}
      />
    </>
  );
}

export const current: Variant = {
  id: "current",
  name: "Current aurora",
  motion: "ambient",
  tech: "CSS",
  idea: "What ships today: two blurred diagonal repeating-gradient bands drifting over 83s and 120s.",
  Component: CurrentAurora,
};
