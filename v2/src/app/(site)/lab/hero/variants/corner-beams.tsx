"use client";

// PROTOTYPE — throwaway. Corner beams: faint, long searchlight beams angle down
// from the top-right corner onto the car and sway slowly (after Aceternity's Spotlight New).
// A thin magenta third beam landing low-left was tried and dropped: its only
// visible part was a smudge beside the rear tyre, and magenta arriving from the
// top-right contradicts the render's own low-left magenta rim light.

import { PALETTE } from "../lab";
import type { Variant } from "./types";

// Beams are light, so each livery colour is lifted toward white before being
// laid down at a few percent (a raw teal at 10% barely leaves black).
const lift = (hex: string, k: number) => `color-mix(in oklab, ${hex}, white ${k}%)`;
const T = lift(PALETTE.teal, 10);
const B = lift(PALETTE.blue, 16);

const a = (hex: string, alpha: number) => `color-mix(in oklab, ${hex} ${(alpha * 100).toFixed(1)}%, transparent)`;

// Noise tile as a mask layer (alpha ~0.89–1.0): dithers the faint gradients, invisible on black.
const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.3 0 0 0 0.8'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

type Beam = {
  key: string;
  color: string;
  peak: number;
  /** Half-angle of the cone, degrees. */
  spread: number;
  /** Aim point, CSS expressions in hero px. */
  tx: string;
  ty: string;
  /** Beam length as a multiple of the source→aim distance. */
  length: number;
  /** Length mask: where along the beam the light lives. */
  profile: string;
  sway: { deg: number; dur: number; delay: number };
};

// Source sits just outside the top-right corner, so the beams enter the page
// already spread and the hot spot is off-screen.
const SX = "calc(var(--hero-w) + 60px)";
const SY = "-90px";

const BEAMS: Beam[] = [
  {
    key: "blue",
    color: B,
    peak: 0.11,
    spread: 8,
    tx: "calc(var(--car-l) + var(--car-w) * 0.86)",
    ty: "calc(var(--car-t) + var(--car-h) * 0.62)",
    length: 1.35,
    profile: "transparent 0%, #000 16%, #000 38%, rgba(0,0,0,0.5) 66%, transparent 96%",
    sway: { deg: 3.2, dur: 11, delay: -4 },
  },
  {
    key: "teal",
    color: T,
    peak: 0.16,
    spread: 12,
    tx: "calc(var(--car-cx) - var(--car-w) * 0.04)",
    ty: "calc(var(--car-cy) - var(--car-h) * 0.08)",
    length: 1.45,
    profile: "transparent 0%, #000 14%, #000 40%, rgba(0,0,0,0.55) 68%, transparent 94%",
    sway: { deg: 3.6, dur: 9, delay: 0 },
  },
];

const beamCss = (b: Beam) => {
  const s = b.spread;
  const c = (k: number) => a(b.color, b.peak * k);
  // Cone around "down" with a soft, roughly gaussian angular falloff.
  const cone = `conic-gradient(in oklab from 180deg at 50% 0%, ${c(1)} 0deg, ${c(0.7)} ${s * 0.35}deg, ${c(0.3)} ${s * 0.65}deg, transparent ${s}deg, transparent ${360 - s}deg, ${c(0.3)} ${360 - s * 0.65}deg, ${c(0.7)} ${360 - s * 0.35}deg, ${c(1)} 360deg)`;
  return `
.corner-beams-sway.${b.key} { animation: corner-beams-sway-${b.key} ${b.sway.dur}s cubic-bezier(0.45, 0, 0.55, 1) ${b.sway.delay}s infinite alternate; }
.corner-beams-beam.${b.key} {
  --len: calc(hypot(calc(${SX} - ${b.tx}), calc(${b.ty} - ${SY})) * ${b.length});
  --half: calc(var(--len) * ${Math.tan(((s + 1) * Math.PI) / 180).toFixed(4)});
  left: calc(-1 * var(--half));
  width: calc(2 * var(--half));
  height: var(--len);
  transform: rotate(atan2(calc(${SX} - ${b.tx}), calc(${b.ty} - ${SY})));
  background: ${cone};
  -webkit-mask-image: linear-gradient(to bottom, ${b.profile}), ${GRAIN};
  mask-image: linear-gradient(to bottom, ${b.profile}), ${GRAIN};
}
@keyframes corner-beams-sway-${b.key} {
  from { transform: rotate(${-b.sway.deg}deg); }
  to { transform: rotate(${b.sway.deg}deg); }
}`;
};

const CSS = `
.corner-beams-src {
  position: absolute;
  left: ${SX};
  top: ${SY};
  width: 0;
  height: 0;
}
.corner-beams-sway {
  position: absolute;
  left: 0;
  top: 0;
  width: 0;
  height: 0;
  transform-origin: 0 0;
  will-change: transform;
}
.corner-beams-beam {
  position: absolute;
  top: 0;
  transform-origin: 50% 0;
  -webkit-mask-composite: source-in;
  mask-composite: intersect;
  -webkit-mask-repeat: no-repeat, repeat;
  mask-repeat: no-repeat, repeat;
}
${BEAMS.map(beamCss).join("\n")}
[data-reduced-motion] .corner-beams-sway { animation: none; }
`;

function CornerBeams() {
  return (
    <>
      <style>{CSS}</style>
      <div className="corner-beams-src">
        {BEAMS.map((b) => (
          <div key={b.key} className={`corner-beams-sway ${b.key}`}>
            <div className={`corner-beams-beam ${b.key}`} />
          </div>
        ))}
      </div>
    </>
  );
}

export const cornerBeams: Variant = {
  id: "corner-beams",
  name: "Corner beams",
  motion: "calm",
  tech: "CSS",
  idea: "Two faint searchlight beams, teal and blue, reach down from the top-right corner onto the car and sway slowly, like the cyan key light baked into the render; depth without spectacle.",
  Component: CornerBeams,
};
