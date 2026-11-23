"use client";

// PROTOTYPE — throwaway. Lamp line: a thin teal light bar behind the car at tyre
// height with a cone of light fanning upward from it (after Aceternity's lamp).

import { PALETTE } from "../lab";
import type { Variant } from "./types";

const T = PALETTE.teal;
const B = PALETTE.blue;
const M = PALETTE.magentaLight;

// Static noise tile used as an extra mask layer: alpha 0.89–1.0, so it dithers
// the lit gradients (which band in 8-bit) and does nothing on black.
const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.3 0 0 0 0.8'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

const a = (hex: string, alpha: number) => `color-mix(in oklab, ${hex} ${Math.round(alpha * 100)}%, transparent)`;

const CSS = `
.lamp-bar-anchor {
  position: absolute;
  left: var(--car-gx);
  top: calc(var(--car-gy) - 0.055 * var(--car-h));
  width: 0;
  height: 0;
  --lw: calc(var(--car-w) * 0.9);
  --lh: calc(var(--car-h) * 1.05);
}
.lamp-bar-open {
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: 0 0;
  animation: lamp-bar-open 1.2s cubic-bezier(0.16, 1, 0.3, 1) 0.15s both;
}
.lamp-bar-breathe {
  position: absolute;
  left: 0;
  top: 0;
  animation: lamp-bar-breathe 11s ease-in-out 1.4s infinite alternate;
}
.lamp-bar-cone {
  position: absolute;
  bottom: 0;
  width: var(--lw);
  height: var(--lh);
  -webkit-mask-image: linear-gradient(to top, #000 0%, rgba(0,0,0,0.55) 18%, rgba(0,0,0,0.27) 46%, rgba(0,0,0,0.1) 72%, transparent 95%), var(--side-mask), ${GRAIN};
  -webkit-mask-composite: source-in, source-in;
  mask-image: linear-gradient(to top, #000 0%, rgba(0,0,0,0.55) 18%, rgba(0,0,0,0.27) 46%, rgba(0,0,0,0.1) 72%, transparent 95%), var(--side-mask), ${GRAIN};
  mask-composite: intersect;
  mask-repeat: no-repeat, no-repeat, repeat;
  -webkit-mask-repeat: no-repeat, no-repeat, repeat;
}
/* Each half's conic origin sits at a line end: bright toward the centre, fading
   up and outward, so the two halves meet as an upturned lamp funnel. */
.lamp-bar-cone.l {
  right: 0;
  --side-mask: linear-gradient(to right, transparent 20%, #000 62%);
  background: conic-gradient(in oklab from 290deg at 50% 100%,
    transparent 0%, transparent 8%, ${a(B, 0.14)} 20%, ${a(T, 0.3)} 32%, ${a(T, 0.5)} 50%, transparent 50%);
}
.lamp-bar-cone.r {
  left: 0;
  --side-mask: linear-gradient(to left, transparent 20%, #000 62%);
  background: conic-gradient(in oklab from 250deg at 50% 100%,
    ${a(T, 0.5)} 0%, ${a(T, 0.3)} 18%, ${a(B, 0.14)} 30%, transparent 42%, transparent 50%);
}
.lamp-bar-glow {
  position: absolute;
  bottom: 0;
  left: calc(var(--lw) * -0.5);
  width: var(--lw);
  height: calc(var(--car-h) * 0.3);
  mask-image: ${GRAIN};
  -webkit-mask-image: ${GRAIN};
  background: radial-gradient(in oklab 50% 100% at 50% 100%, ${a(T, 0.34)} 0%, ${a(T, 0.14)} 35%, ${a(B, 0.05)} 65%, transparent 100%);
}
.lamp-bar-core {
  position: absolute;
  bottom: 0;
  left: calc(var(--lw) * -0.22);
  width: calc(var(--lw) * 0.44);
  height: 56px;
  background: radial-gradient(in oklab 50% 100% at 50% 100%, ${a("#c8f7fb", 0.32)} 0%, ${a(T, 0.18)} 40%, transparent 100%);
}
.lamp-bar-bounce {
  position: absolute;
  top: 0;
  left: calc(var(--lw) * -0.36);
  width: calc(var(--lw) * 0.72);
  height: 34px;
  background: radial-gradient(in oklab 50% 100% at 50% 0%, ${a(T, 0.12)} 0%, ${a(B, 0.04)} 50%, transparent 100%);
}
.lamp-bar-halo {
  position: absolute;
  top: -6px;
  left: calc(var(--lw) * -0.5);
  width: var(--lw);
  height: 12px;
  background: radial-gradient(in oklab 50% 50% at 50% 50%, ${a(T, 0.55)} 0%, ${a(B, 0.18)} 55%, transparent 100%);
}
.lamp-bar-line {
  position: absolute;
  top: -0.75px;
  left: calc(var(--lw) * -0.5);
  width: var(--lw);
  height: 1.5px;
  background: linear-gradient(in oklab 90deg,
    transparent 0%, ${a(M, 0.7)} 6%, ${a(B, 0.9)} 22%, ${T} 38%, #d4fafd 50%, ${T} 62%, ${a(B, 0.9)} 78%, ${a(M, 0.7)} 94%, transparent 100%);
}
@keyframes lamp-bar-open {
  from { transform: scaleX(0.28); opacity: 0; }
  30% { opacity: 1; }
  to { transform: scaleX(1); opacity: 1; }
}
@keyframes lamp-bar-breathe {
  from { opacity: 1; }
  to { opacity: 0.8; }
}
[data-reduced-motion] .lamp-bar-open,
[data-reduced-motion] .lamp-bar-breathe { animation: none; }
`;

function LampBar() {
  return (
    <>
      <style>{CSS}</style>
      <div className="lamp-bar-anchor">
        <div className="lamp-bar-open">
          <div className="lamp-bar-breathe">
            <div className="lamp-bar-cone l" />
            <div className="lamp-bar-cone r" />
            <div className="lamp-bar-glow" />
            <div className="lamp-bar-core" />
            <div className="lamp-bar-bounce" />
          </div>
          <div className="lamp-bar-halo" />
          <div className="lamp-bar-line" />
        </div>
      </div>
    </>
  );
}

export const lampBar: Variant = {
  id: "lamp-bar",
  name: "Lamp line",
  motion: "calm",
  tech: "CSS",
  idea: "A thin teal light bar behind the car at tyre height throws a cone of light up behind it, opening once on load like Linear's lamp, then holding.",
  Component: LampBar,
};
