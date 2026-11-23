"use client";

// PROTOTYPE — throwaway. Group A · studio lighting: a dim teal base glow behind the car,
// and every 10s one narrow diagonal band of light (teal → blue → magenta across its
// width) glides once behind the car, like a showroom light passing over the backdrop.

import type { Variant } from "./types";

const GRAIN_URL =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='2.6 0 0 0 -0.8 2.6 0 0 0 -0.8 2.6 0 0 0 -0.8 0 0 0 0 1'/%3E%3C/filter%3E%3Crect width='240' height='240' filter='url(%23n)'/%3E%3C/svg%3E\")";

// Sweep window: x from car-l - 0.02w (1.1w wide), y from car-t - 0.14h (1.3h tall).
// The band is painted once and only its `translate` animates, from fully left of the
// window to fully right of it; the window's soft mask fades it in and out, so the
// jump back to the start (while it's off to the right) is never seen.
const css = `
.light-sweep-base {
  position: absolute;
  left: calc(var(--car-cx) + var(--car-w) * 0.03);
  top: calc(var(--car-cy) - var(--car-h) * 0.06);
  width: calc(var(--car-w) * 1.36);
  height: calc(var(--car-w) * 1.02);
  translate: -50% -50%;
  background: radial-gradient(closest-side,
    color-mix(in oklab, var(--livery) 30%, transparent) 0%,
    color-mix(in oklab, var(--livery) 21%, transparent) 20%,
    color-mix(in oklab, var(--livery) 10%, transparent) 45%,
    color-mix(in oklab, var(--livery) 3%, transparent) 72%,
    transparent 100%);
}
.light-sweep-window {
  position: absolute;
  left: calc(var(--car-l) - var(--car-w) * 0.02);
  top: calc(var(--car-t) - var(--car-h) * 0.14);
  width: calc(var(--car-w) * 1.1);
  height: calc(var(--car-h) * 1.3);
  overflow: hidden;
  -webkit-mask-image:
    linear-gradient(to right, transparent 0%, rgb(0 0 0 / 0.5) 12%, #000 26%, #000 80%, transparent 100%),
    linear-gradient(to bottom, transparent 0%, #000 22%, #000 74%, transparent 100%);
  -webkit-mask-composite: source-in;
  mask-image:
    linear-gradient(to right, transparent 0%, rgb(0 0 0 / 0.5) 12%, #000 26%, #000 80%, transparent 100%),
    linear-gradient(to bottom, transparent 0%, #000 22%, #000 74%, transparent 100%);
  mask-composite: intersect;
}
.light-sweep-band {
  position: absolute;
  left: calc(var(--car-w) * -0.2);
  top: calc(var(--car-h) * -0.3);
  width: calc(var(--car-w) * 0.4);
  height: calc(var(--car-h) * 1.9);
  rotate: 20deg;
  translate: calc(var(--car-w) * -0.32) 0;
  background: linear-gradient(to right in oklab,
    transparent 0%,
    color-mix(in oklab, var(--livery) 5%, transparent) 24%,
    color-mix(in oklab, var(--livery) 38%, transparent) 40%,
    color-mix(in oklab, var(--livery-support) 44%, transparent) 50%,
    color-mix(in oklab, var(--livery-pop) 34%, transparent) 60%,
    color-mix(in oklab, var(--livery-pop) 5%, transparent) 76%,
    transparent 100%);
  will-change: translate;
  animation: light-sweep-pass 10s infinite;
}
.light-sweep-grain {
  position: absolute;
  inset: 0;
  background-image: ${GRAIN_URL};
  background-size: 240px 240px;
  mix-blend-mode: overlay;
  opacity: 0.1;
}
@keyframes light-sweep-pass {
  0% {
    translate: calc(var(--car-w) * -0.32) 0;
    animation-timing-function: cubic-bezier(0.3, 0.12, 0.62, 0.9);
  }
  40%, 100% { translate: calc(var(--car-w) * 1.4) 0; }
}
[data-reduced-motion] .light-sweep-band { animation: none; visibility: hidden; }
`;

function LightSweep() {
  return (
    <>
      <style>{css}</style>
      <div className="light-sweep-base" />
      <div className="light-sweep-window">
        <div className="light-sweep-band" />
      </div>
      <div className="light-sweep-grain" />
    </>
  );
}

export const lightSweep: Variant = {
  id: "light-sweep",
  name: "Showroom sweep",
  motion: "calm",
  tech: "CSS",
  idea: "A dim teal glow behind the car, and every 10s a single soft diagonal band of teal-blue-magenta light glides once behind it, like a showroom light passing over the backdrop.",
  Component: LightSweep,
};
