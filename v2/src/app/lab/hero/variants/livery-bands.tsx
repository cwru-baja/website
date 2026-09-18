"use client";

// PROTOTYPE — throwaway. Livery bands: crisp, flat diagonal slats of navy, blue and
// teal behind the car, slanted at the team logo's 60° slash, with a slow sheen
// travelling up them (after Raycast's glass slats / Stripe's ribbon).

import { PALETTE } from "../lab";
import type { Variant } from "./types";

const a = (hex: string, alpha: number) => `color-mix(in oklab, ${hex} ${Math.round(alpha * 100)}%, transparent)`;

type Band = {
  key: string;
  /** Left edge and width at the car's centre height, as fractions of the car width from --car-cx. */
  x: number;
  w: number;
  fill: string;
  /** Optional thin accent on the band's leading (left) edge. */
  edge?: string;
  /** The travelling light: a lifted version of the band's own colour. */
  sheen: { color: string; alpha: number; delay: number };
};

// Three equal slats with equal gaps, like the "///" of the team logo, set behind
// the car's centre so they read above and below the body. Weight steps down from
// teal (nearest the car's lit side) through blue to navy.
const SLAT = 0.105;
const GAP = 0.055;
const X0 = -0.2;
const BANDS: Band[] = [
  { key: "teal", x: X0, w: SLAT, fill: a(PALETTE.teal, 0.3), edge: a(PALETTE.magentaLight, 0.9), sheen: { color: PALETTE.teal, alpha: 0.28, delay: -2 } },
  { key: "blue", x: X0 + SLAT + GAP, w: SLAT, fill: a(PALETTE.blue, 0.34), sheen: { color: PALETTE.blue, alpha: 0.26, delay: -5 } },
  { key: "navy", x: X0 + 2 * (SLAT + GAP), w: SLAT, fill: a(PALETTE.navy, 0.95), sheen: { color: PALETTE.blue, alpha: 0.12, delay: -8 } },
];

const bandCss = (b: Band) => `
.livery-bands-band.${b.key} {
  left: calc(var(--car-cx) + var(--car-w) * ${b.x});
  width: calc(var(--car-w) * ${b.w});
  background: ${b.fill};
  ${b.edge ? `box-shadow: inset 3px 0 0 ${b.edge};` : ""}
}
.livery-bands-band.${b.key} .livery-bands-sheen {
  background: linear-gradient(in oklab to bottom, transparent 0%, ${a(`color-mix(in oklab, ${b.sheen.color}, white 25%)`, b.sheen.alpha)} 50%, transparent 100%);
  animation: livery-bands-sheen 26s cubic-bezier(0.4, 0, 0.6, 1) ${b.sheen.delay}s infinite;
}`;

const CSS = `
.livery-bands-field {
  position: absolute;
  inset: 0;
  -webkit-mask-image:
    linear-gradient(to right, transparent 36%, #000 60%),
    linear-gradient(to bottom, transparent 6%, #000 34%, #000 68%, transparent 97%);
  -webkit-mask-composite: source-in;
  mask-image:
    linear-gradient(to right, transparent 36%, #000 60%),
    linear-gradient(to bottom, transparent 6%, #000 34%, #000 68%, transparent 97%);
  mask-composite: intersect;
}
.livery-bands-band {
  position: absolute;
  top: calc(var(--hero-h) * -0.15);
  height: calc(var(--hero-h) * 1.3);
  /* Pivot at the car's centre height so x offsets are measured there. */
  transform-origin: 0 calc(var(--car-cy) + var(--hero-h) * 0.15);
  transform: skewX(-30deg);
  overflow: hidden;
}
.livery-bands-sheen {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 28%;
  transform: translateY(-110%);
  will-change: transform;
}
${BANDS.map(bandCss).join("\n")}
/* Travels bottom → top (forward along the "/" slant), then rests off-band for a
   third of the cycle so the motion comes and goes. */
@keyframes livery-bands-sheen {
  0% { transform: translateY(365%); }
  66% { transform: translateY(-110%); }
  100% { transform: translateY(-110%); }
}
[data-reduced-motion] .livery-bands-sheen { animation: none; }
`;

function LiveryBands() {
  return (
    <>
      <style>{CSS}</style>
      <div className="livery-bands-field">
        {BANDS.map((b) => (
          <div key={b.key} className={`livery-bands-band ${b.key}`}>
            <div className="livery-bands-sheen" />
          </div>
        ))}
      </div>
    </>
  );
}

export const liveryBands: Variant = {
  id: "livery-bands",
  name: "Livery bands",
  motion: "ambient",
  tech: "CSS",
  idea: "Flat, sharp-edged slats of navy, blue and teal (one with a magenta edge) cut diagonally behind the car at the logo's 60° slash, with a slow sheen sliding up them; the graphic-design answer, not a lighting one.",
  Component: LiveryBands,
};
