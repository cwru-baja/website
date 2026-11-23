"use client";

// PROTOTYPE — throwaway. Group A · studio lighting: a big soft halo ring behind the car,
// painted once as a conic gradient (teal → blue → magenta → navy → teal) and turned by
// `rotate` once every 80s. The wrapper squashes it into a slight perspective ellipse.

import type { Variant } from "./types";

const GRAIN_URL =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='2.6 0 0 0 -0.8 2.6 0 0 0 -0.8 2.6 0 0 0 -0.8 0 0 0 0 1'/%3E%3C/filter%3E%3Crect width='240' height='240' filter='url(%23n)'/%3E%3C/svg%3E\")";

// Colour keys around the ring, in degrees from the gradient's start (-30deg, so at rest
// and under reduced motion teal sits top-right and magenta bottom-left, matching the
// render's baked rim lights). Each segment gets cosine-eased intermediate stops: plain
// linear stops leave a visible crease radiating from the centre at every key,
// most of all at the dark navy one.
const KEYS: [string, number][] = [
  ["var(--livery)", 0],
  ["var(--livery)", 90],
  ["var(--livery-support)", 168],
  ["var(--livery-pop)", 230],
  ["var(--livery-deep)", 290],
  ["var(--livery)", 360],
];

function easedStops(keys: [string, number][]) {
  const out: string[] = [];
  for (let i = 0; i < keys.length - 1; i++) {
    const [a, t0] = keys[i];
    const [b, t1] = keys[i + 1];
    for (const k of [0, 0.2, 0.4, 0.6, 0.8]) {
      const e = (1 - Math.cos(Math.PI * k)) / 2;
      const angle = (t0 + k * (t1 - t0)).toFixed(1);
      out.push(`color-mix(in oklab, ${a} ${((1 - e) * 100).toFixed(1)}%, ${b}) ${angle}deg`);
    }
  }
  const [last, end] = keys[keys.length - 1];
  out.push(`${last} ${end}deg`);
  return out.join(",\n    ");
}

const css = `
.conic-halo-tilt {
  position: absolute;
  left: calc(var(--car-cx) + var(--car-w) * 0.02);
  top: calc(var(--car-cy) - var(--car-h) * 0.04);
  width: calc(var(--car-w) * 1.32);
  height: calc(var(--car-w) * 1.32);
  translate: -50% -50%;
  scale: 1 0.86;
}
.conic-halo-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: conic-gradient(from -30deg in oklab,
    ${easedStops(KEYS)});
  -webkit-mask-image: radial-gradient(closest-side, rgb(0 0 0 / 0.04) 0%, rgb(0 0 0 / 0.12) 45%, rgb(0 0 0 / 0.66) 63%, #000 73%, rgb(0 0 0 / 0.55) 84%, rgb(0 0 0 / 0.15) 93%, transparent 100%);
  mask-image: radial-gradient(closest-side, rgb(0 0 0 / 0.04) 0%, rgb(0 0 0 / 0.12) 45%, rgb(0 0 0 / 0.66) 63%, #000 73%, rgb(0 0 0 / 0.55) 84%, rgb(0 0 0 / 0.15) 93%, transparent 100%);
  opacity: 0.4;
  will-change: rotate;
  animation: conic-halo-turn 80s linear infinite;
}
.conic-halo-grain {
  position: absolute;
  inset: 0;
  background-image: ${GRAIN_URL};
  background-size: 240px 240px;
  mix-blend-mode: overlay;
  opacity: 0.1;
}
@keyframes conic-halo-turn {
  from { rotate: 0deg; }
  to   { rotate: 360deg; }
}
[data-reduced-motion] .conic-halo-ring { animation: none; }
`;

function ConicHalo() {
  return (
    <>
      <style>{css}</style>
      <div className="conic-halo-tilt">
        <div className="conic-halo-ring" />
      </div>
      <div className="conic-halo-grain" />
    </>
  );
}

export const conicHalo: Variant = {
  id: "conic-halo",
  name: "Turntable halo",
  motion: "calm",
  tech: "CSS",
  idea: "A large soft halo ring behind the car whose livery colours (teal, blue, magenta, navy) slowly turn once every 80s, like light on a showroom turntable.",
  Component: ConicHalo,
};
