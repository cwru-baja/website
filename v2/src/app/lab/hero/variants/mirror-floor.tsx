"use client";

// PROTOTYPE — throwaway. Showroom reflection: the car stands on glossy black. A
// short, faded, blurred mirrored copy of the render is flipped about the line
// through the tyre contact points (a single horizontal flip line can't serve a
// 3/4 view), over a flat teal light pool, with a faint backdrop glow behind.

import carSr26 from "@/assets/homepage-car-sr26.webp";
import { PALETTE } from "../lab";
import type { Variant } from "./types";

const T = PALETTE.teal;
const B = PALETTE.blue;
const N = PALETTE.navy;

// The 4200px source is 12MB; the optimiser's 1080w WebP keeps alpha and is ~100KB.
const CAR_URL = `/_next/image?url=${encodeURIComponent(carSr26.src)}&w=1080&q=75`;

const a = (hex: string, alpha: number) => `color-mix(in oklab, ${hex} ${(alpha * 100).toFixed(1)}%, transparent)`;

// Noise tile as a mask layer (alpha ~0.89–1.0): dithers faint gradients, invisible on black.
const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.3 0 0 0 0.8'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

// Tyre contact points in image fractions, measured from the PNG's alpha (lowest
// opaque row under each tyre): rear-left, front-right, rear-right.
const RL = { x: 0.111, y: 0.84 };
const FR = { x: 0.522, y: 0.987 };
const RR = { x: 0.9, y: 0.786 };
const ASPECT = 4200 / 3000; // iw / ih

// A floor reflection flips each column about its own contact height. With the
// contact line piecewise-linear through the three tyres, each piece is an exact
// affine map: skewY(φ) · flipY · skewY(−φ). The outer frame's skew makes the
// contact line horizontal in its own space, so the fade mask can follow it.
type Segment = { key: string; a: { x: number; y: number }; b: { x: number; y: number }; x0: number; x1: number; run: number };
const SEGMENTS: Segment[] = [
  { key: "left", a: RL, b: FR, x0: -0.05, x1: 0.56, run: 0.2 },
  { key: "right", a: FR, b: RR, x0: 0.49, x1: 1.05, run: 0.16 },
];

const pct = (f: number) => `${(f * 100).toFixed(3)}%`;

const segmentCss = (g: Segment) => {
  // Slope in px/px (image is ASPECT times wider than tall).
  const slope = (g.b.y - g.a.y) / ((g.b.x - g.a.x) * ASPECT);
  const phi = (Math.atan(slope) * 180) / Math.PI;
  // Contact line height at x = 0, in frame-local image fractions.
  const yc = g.a.y - slope * g.a.x * ASPECT;
  // Frame is 2 image-heights tall (the right piece's line sits below the image box).
  const f = (v: number) => pct(v / 2);
  const soft = 0.035;
  const mask = [
    `linear-gradient(to right, transparent ${pct(g.x0)}, #000 ${pct(g.x0 + soft)}, #000 ${pct(g.x1 - soft)}, transparent ${pct(g.x1)})`,
    `linear-gradient(to bottom, transparent ${f(yc - 0.004)}, #000 ${f(yc + 0.004)}, rgba(0,0,0,0.5) ${f(yc + g.run * 0.3)}, rgba(0,0,0,0.16) ${f(yc + g.run * 0.65)}, transparent ${f(yc + g.run)})`,
  ].join(", ");
  return `
.mirror-floor-frame.${g.key} {
  transform: skewY(${phi.toFixed(3)}deg);
  -webkit-mask-image: ${mask};
  mask-image: ${mask};
}
.mirror-floor-frame.${g.key} .mirror-floor-refl {
  transform-origin: 0 ${pct(yc)};
  transform: scaleY(-1) skewY(${(-phi).toFixed(3)}deg);
}`;
};

const CSS = `
.mirror-floor-backdrop {
  position: absolute;
  left: calc(var(--car-cx) - var(--car-w) * 0.62);
  top: calc(var(--car-cy) - var(--car-h) * 0.85);
  width: calc(var(--car-w) * 1.3);
  height: calc(var(--car-h) * 1.35);
  background: radial-gradient(in oklab closest-side, ${a(T, 0.11)} 0%, ${a(T, 0.075)} 25%, ${a(B, 0.045)} 50%, ${a(N, 0.025)} 72%, ${a(N, 0.008)} 90%, transparent 100%);
  -webkit-mask-image: ${GRAIN};
  mask-image: ${GRAIN};
}
.mirror-floor-pool {
  position: absolute;
  left: calc(var(--car-gx) - var(--car-w) * 0.62);
  top: calc(var(--car-gy) - var(--car-h) * 0.2);
  width: calc(var(--car-w) * 1.24);
  height: calc(var(--car-h) * 0.4);
  background: radial-gradient(in oklab closest-side, ${a(T, 0.26)} 0%, ${a(T, 0.16)} 35%, ${a(B, 0.07)} 70%, transparent 100%);
  -webkit-mask-image: ${GRAIN};
  mask-image: ${GRAIN};
  animation: mirror-floor-pool 14s ease-in-out infinite alternate;
}
@keyframes mirror-floor-pool {
  from { opacity: 1; }
  to { opacity: 0.8; }
}
.mirror-floor-box {
  position: absolute;
  --iw: calc(var(--car-w) / 0.944);
  --ih: calc(var(--car-h) / 0.976);
  left: calc(var(--car-l) - 0.013 * var(--iw));
  top: calc(var(--car-t) - 0.011 * var(--ih));
  width: var(--iw);
  height: var(--ih);
  opacity: 0.42;
  filter: blur(1.2px);
}
.mirror-floor-frame {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 200%;
  transform-origin: 0 0;
  -webkit-mask-composite: source-in;
  mask-composite: intersect;
}
.mirror-floor-refl {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 50%;
  background: url("${CAR_URL}") 0 0 / 100% 100% no-repeat;
}
${SEGMENTS.map(segmentCss).join("\n")}
[data-reduced-motion] .mirror-floor-pool { animation: none; opacity: 0.9; }
`;

function MirrorFloor() {
  return (
    <>
      <style>{CSS}</style>
      <div className="mirror-floor-backdrop" />
      <div className="mirror-floor-pool" />
      <div className="mirror-floor-box">
        {SEGMENTS.map((g) => (
          <div key={g.key} className={`mirror-floor-frame ${g.key}`}>
            <div className="mirror-floor-refl" />
          </div>
        ))}
      </div>
    </>
  );
}

export const mirrorFloor: Variant = {
  id: "mirror-floor",
  name: "Showroom reflection",
  motion: "ambient",
  tech: "CSS",
  idea: "The car stands on glossy black like a 3D showroom: faint, blurred tyre reflections over a flat teal light pool, with a dim teal backdrop glow, grounding the render instead of floating it.",
  Component: MirrorFloor,
};
