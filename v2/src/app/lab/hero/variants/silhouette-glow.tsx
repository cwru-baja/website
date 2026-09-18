"use client";

// PROTOTYPE — throwaway. Silhouette glow: a blurred, livery-coloured copy of the
// car's own alpha sits behind the render, so light hugs the real outline like a rim light.

import carSr26 from "../../../../../public/homepage-car-sr26.png";
import { PALETTE } from "../lab";
import type { Variant } from "./types";

const T = PALETTE.teal;
const B = PALETTE.blue;
const M = PALETTE.magentaLight;

// The 4200px source is 12MB; the optimiser's 1080w WebP keeps alpha and is ~100KB.
const CAR_URL = `/_next/image?url=${encodeURIComponent(carSr26.src)}&w=1080&q=75`;

const a = (hex: string, alpha: number) => `color-mix(in oklab, ${hex} ${Math.round(alpha * 100)}%, transparent)`;

const CSS = `
.silhouette-glow-box {
  position: absolute;
  --iw: calc(var(--car-w) / 0.944);
  --ih: calc(var(--car-h) / 0.976);
  left: calc(var(--car-l) - 0.013 * var(--iw));
  top: calc(var(--car-t) - 0.011 * var(--ih));
  width: var(--iw);
  height: var(--ih);
}
.silhouette-glow-layer {
  position: absolute;
  inset: 0;
  transform-origin: 50% 54.4%;
  will-change: transform, opacity;
}
.silhouette-glow-blur {
  position: absolute;
  inset: 0;
}
.silhouette-glow-mask {
  position: absolute;
  inset: 0;
  overflow: hidden;
  -webkit-mask: url("${CAR_URL}") 0 0 / 100% 100% no-repeat;
  mask: url("${CAR_URL}") 0 0 / 100% 100% no-repeat;
}
/* Paint seen through the car's alpha. Teal over the top and right, blue through
   the middle, magenta pooled at the low-left rear tyre (where the render's own
   magenta rim light is), and the underside darkened so nothing glows beneath
   the tyres. */
.silhouette-glow-paint {
  position: absolute;
  inset: -12%;
  background:
    radial-gradient(in oklab 30% 36% at 16% 76%, ${a(M, 0.85)} 0%, ${a(M, 0.5)} 40%, transparent 100%),
    linear-gradient(in oklab to bottom, transparent 45%, ${a("#0a0a0a", 0.6)} 68%, ${a("#0a0a0a", 0.95)} 90%),
    linear-gradient(in oklab 212deg, #7ae6ee 4%, ${T} 30%, ${B} 62%, ${B} 100%);
}
.silhouette-glow-rim {
  transform: scale(1.026);
  opacity: 0.6;
  animation: silhouette-glow-breathe 8s ease-in-out infinite alternate;
}
.silhouette-glow-rim .silhouette-glow-blur { filter: blur(12px); }
.silhouette-glow-bloom {
  transform: scale(1.068);
  opacity: 0.32;
  animation: silhouette-glow-bloom 11s ease-in-out -3s infinite alternate;
}
.silhouette-glow-bloom .silhouette-glow-blur { filter: blur(42px); }
.silhouette-glow-rim .silhouette-glow-paint { animation: silhouette-glow-drift 19s ease-in-out infinite alternate; }
@keyframes silhouette-glow-breathe {
  from { opacity: 0.7; transform: scale(1.03); }
  to { opacity: 0.5; transform: scale(1.022); }
}
@keyframes silhouette-glow-bloom {
  from { opacity: 0.38; transform: scale(1.075); }
  to { opacity: 0.26; transform: scale(1.06); }
}
@keyframes silhouette-glow-drift {
  from { transform: translate(-4%, 3%); }
  to { transform: translate(4%, -3%); }
}
[data-reduced-motion] .silhouette-glow-layer,
[data-reduced-motion] .silhouette-glow-paint { animation: none; }
`;

function Silhouette({ kind }: { kind: "rim" | "bloom" }) {
  return (
    <div className={`silhouette-glow-layer silhouette-glow-${kind}`}>
      <div className="silhouette-glow-blur">
        <div className="silhouette-glow-mask">
          <div className="silhouette-glow-paint" />
        </div>
      </div>
    </div>
  );
}

function SilhouetteGlow() {
  return (
    <>
      <style>{CSS}</style>
      <div className="silhouette-glow-box">
        <Silhouette kind="bloom" />
        <Silhouette kind="rim" />
      </div>
    </>
  );
}

export const silhouetteGlow: Variant = {
  id: "silhouette-glow",
  name: "Silhouette glow",
  motion: "ambient",
  tech: "CSS",
  idea: "A blurred copy of the car's own silhouette, painted teal over the top and magenta low-left, rims the real outline the way the render's own back lights do.",
  Component: SilhouetteGlow,
};
