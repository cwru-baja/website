"use client";

// PROTOTYPE — throwaway. Group A · studio lighting: the light lives on the floor. A flat
// perspective pool under the car (teal core, blue body, thin magenta rim) with a faint
// back wall catching the bounce, so the car reads as parked on a lit showroom stage.

import type { Variant } from "./types";

const GRAIN_URL =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='2.6 0 0 0 -0.8 2.6 0 0 0 -0.8 2.6 0 0 0 -0.8 0 0 0 0 1'/%3E%3C/filter%3E%3Crect width='240' height='240' filter='url(%23n)'/%3E%3C/svg%3E\")";

const css = `
.stage-floor-root {
  --sf-rx: calc(var(--car-w) * 0.6);
  --sf-ry: calc(var(--car-w) * 0.17);
  --sf-x: calc(var(--car-gx) - var(--car-w) * 0.005);
  --sf-y: calc(var(--car-gy) + var(--car-w) * 0.015);
  --sf-seam: calc(var(--car-cy) - var(--car-w) * 0.04);
  position: absolute;
  inset: 0;
}
/* Back wall: a faint blue-navy bounce rising from the stage edge, faded out sideways. */
.stage-floor-wall {
  position: absolute;
  left: calc(var(--car-cx) + var(--car-w) * 0.1 - var(--car-w) * 0.75);
  top: calc(var(--sf-seam) - var(--car-w) * 0.5);
  width: calc(var(--car-w) * 1.5);
  height: calc(var(--car-w) * 0.5);
  background: radial-gradient(ellipse 50% 100% at 50% 100% in oklab,
    color-mix(in oklab, var(--livery-support) 13%, transparent) 0%,
    color-mix(in oklab, var(--livery-deep) 42%, transparent) 30%,
    color-mix(in oklab, var(--livery-deep) 14%, transparent) 65%,
    transparent 100%);
}
/* The stage edge: a hairline where wall meets floor, fading out at both ends. */
.stage-floor-horizon {
  position: absolute;
  left: calc(var(--car-cx) + var(--car-w) * 0.1 - var(--car-w) * 0.75);
  top: calc(var(--sf-seam) - 0.5px);
  width: calc(var(--car-w) * 1.5);
  height: 1px;
  background: linear-gradient(to right in oklab,
    transparent 0%,
    color-mix(in oklab, var(--livery-support) 14%, transparent) 28%,
    color-mix(in oklab, var(--livery) 20%, transparent) 55%,
    color-mix(in oklab, var(--livery-support) 10%, transparent) 85%,
    transparent 100%);
}
/* Floor falloff between the stage edge and the pool, so the floor has a plane. */
.stage-floor-deck {
  position: absolute;
  left: calc(var(--car-cx) + var(--car-w) * 0.1 - var(--car-w) * 0.75);
  top: var(--sf-seam);
  width: calc(var(--car-w) * 1.5);
  height: calc(var(--car-w) * 0.34);
  background: radial-gradient(ellipse 50% 100% at 50% 0% in oklab,
    color-mix(in oklab, var(--livery-deep) 30%, transparent) 0%,
    color-mix(in oklab, var(--livery-deep) 10%, transparent) 55%,
    transparent 100%);
}
.stage-floor-pool {
  position: absolute;
  left: var(--sf-x);
  top: var(--sf-y);
  width: calc(var(--sf-rx) * 2);
  height: calc(var(--sf-ry) * 2);
  translate: -50% -50%;
  background: radial-gradient(closest-side in oklab,
    color-mix(in oklab, var(--livery) 60%, transparent) 0%,
    color-mix(in oklab, var(--livery) 46%, transparent) 26%,
    color-mix(in oklab, var(--livery-support) 32%, transparent) 54%,
    color-mix(in oklab, var(--livery-support) 15%, transparent) 76%,
    color-mix(in oklab, var(--livery-pop) 9%, transparent) 89%,
    color-mix(in oklab, var(--livery-pop) 2%, transparent) 96%,
    transparent 100%);
}
.stage-floor-core {
  position: absolute;
  left: var(--sf-x);
  top: var(--sf-y);
  width: calc(var(--sf-rx) * 1.1);
  height: calc(var(--sf-ry) * 1.1);
  translate: -50% -50%;
  background: radial-gradient(closest-side,
    color-mix(in oklab, var(--livery) 30%, transparent) 0%,
    color-mix(in oklab, var(--livery) 12%, transparent) 50%,
    transparent 100%);
  will-change: opacity, transform;
  animation: stage-floor-shimmer 9s ease-in-out infinite alternate;
}
/* Contact shadows: the body blocks the overhead light, the tyres touch down. */
.stage-floor-shadow {
  position: absolute;
  translate: -50% -50%;
  background: radial-gradient(closest-side, rgb(0 0 0 / 0.75) 0%, rgb(0 0 0 / 0.45) 45%, transparent 100%);
}
.stage-floor-grain {
  position: absolute;
  inset: 0;
  background-image: ${GRAIN_URL};
  background-size: 240px 240px;
  mix-blend-mode: overlay;
  opacity: 0.1;
}
@keyframes stage-floor-shimmer {
  from { opacity: 0.55; scale: 0.97 1; }
  to   { opacity: 1; scale: 1.03 1; }
}
[data-reduced-motion] .stage-floor-core { animation: none; opacity: 0.8; }
`;

// [x, y] as fractions of the car box, [rx, ry] as fractions of car width.
const SHADOWS: [number, number, number, number][] = [
  [0.53, 0.86, 0.36, 0.075], // under the chassis
  [0.553, 0.985, 0.1, 0.02], // front tyre
  [0.12, 0.835, 0.08, 0.018], // rear left tyre
  [0.93, 0.78, 0.07, 0.016], // rear right tyre
];

function StageFloor() {
  return (
    <div className="stage-floor-root">
      <style>{css}</style>
      <div className="stage-floor-wall" />
      <div className="stage-floor-deck" />
      <div className="stage-floor-horizon" />
      <div className="stage-floor-pool" />
      <div className="stage-floor-core" />
      {SHADOWS.map(([x, y, rx, ry], i) => (
        <div
          key={i}
          className="stage-floor-shadow"
          style={{
            left: `calc(var(--car-l) + var(--car-w) * ${x})`,
            top: `calc(var(--car-t) + var(--car-h) * ${y})`,
            width: `calc(var(--car-w) * ${rx * 2})`,
            height: `calc(var(--car-w) * ${ry * 2})`,
          }}
        />
      ))}
      <div className="stage-floor-grain" />
    </div>
  );
}

export const stageFloor: Variant = {
  id: "stage-floor",
  name: "Lit stage",
  motion: "ambient",
  tech: "CSS",
  idea: "The light is on the floor: a flat perspective pool under the tyres (teal core, blue body, thin magenta rim) and a faint back wall, like the car is parked on a showroom stage.",
  Component: StageFloor,
};
