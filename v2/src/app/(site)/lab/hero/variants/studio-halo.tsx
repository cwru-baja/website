"use client";

// PROTOTYPE — throwaway. Group A · studio lighting: one big soft teal backdrop light
// above-behind the car, a small magenta kicker low-left, both breathing slowly.

import type { Variant } from "./types";

// Static fractal-noise tile, contrast-stretched around mid grey. Laid over the glows
// with `overlay` it dithers the gradients (kills banding) without lifting the black.
const GRAIN_URL =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='2.6 0 0 0 -0.8 2.6 0 0 0 -0.8 2.6 0 0 0 -0.8 0 0 0 0 1'/%3E%3C/filter%3E%3Crect width='240' height='240' filter='url(%23n)'/%3E%3C/svg%3E\")";

const css = `
.studio-halo-teal {
  position: absolute;
  left: calc(var(--car-cx) + var(--car-w) * 0.04);
  top: calc(var(--car-cy) - var(--car-h) * 0.16);
  width: calc(var(--car-w) * 1.62);
  height: calc(var(--car-w) * 1.42);
  translate: -50% -50%;
  background: radial-gradient(closest-side,
    color-mix(in oklab, var(--livery) 56%, transparent) 0%,
    color-mix(in oklab, var(--livery) 43%, transparent) 13%,
    color-mix(in oklab, var(--livery) 25%, transparent) 31%,
    color-mix(in oklab, var(--livery) 11%, transparent) 51%,
    color-mix(in oklab, var(--livery) 4%, transparent) 70%,
    color-mix(in oklab, var(--livery) 1%, transparent) 86%,
    transparent 100%);
  will-change: transform, opacity;
  animation: studio-halo-breathe-teal 14s ease-in-out infinite alternate;
}
.studio-halo-kicker {
  position: absolute;
  left: calc(var(--car-l) + var(--car-w) * 0.17);
  top: calc(var(--car-t) + var(--car-h) * 0.84);
  width: calc(var(--car-w) * 0.74);
  height: calc(var(--car-w) * 0.36);
  translate: -50% -50%;
  background: radial-gradient(closest-side,
    color-mix(in oklab, var(--livery-pop) 34%, transparent) 0%,
    color-mix(in oklab, var(--livery-pop) 25%, transparent) 18%,
    color-mix(in oklab, var(--livery-pop) 12%, transparent) 42%,
    color-mix(in oklab, var(--livery-pop) 4%, transparent) 68%,
    color-mix(in oklab, var(--livery-pop) 1%, transparent) 86%,
    transparent 100%);
  will-change: transform, opacity;
  animation: studio-halo-breathe-kicker 11s ease-in-out -5s infinite alternate;
}
.studio-halo-grain {
  position: absolute;
  inset: 0;
  background-image: ${GRAIN_URL};
  background-size: 240px 240px;
  mix-blend-mode: overlay;
  opacity: 0.1;
}
@keyframes studio-halo-breathe-teal {
  from { scale: 0.95; opacity: 0.82; }
  to   { scale: 1.04; opacity: 1; }
}
@keyframes studio-halo-breathe-kicker {
  from { scale: 0.9; opacity: 0.7; }
  to   { scale: 1.06; opacity: 1; }
}
[data-reduced-motion] .studio-halo-teal,
[data-reduced-motion] .studio-halo-kicker { animation: none; }
`;

function StudioHalo() {
  return (
    <>
      <style>{css}</style>
      <div className="studio-halo-teal" />
      <div className="studio-halo-kicker" />
      <div className="studio-halo-grain" />
    </>
  );
}

export const studioHalo: Variant = {
  id: "studio-halo",
  name: "Studio halo",
  motion: "ambient",
  tech: "CSS",
  idea: "Product-photo lighting: a big soft teal backdrop light above-behind the car and a small magenta kicker low-left, matching the render's baked rim lights.",
  Component: StudioHalo,
};
