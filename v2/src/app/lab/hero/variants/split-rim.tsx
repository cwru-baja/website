"use client";

// PROTOTYPE — throwaway. Group A · studio lighting: a still, two-light backlight that
// echoes the render's baked rim lights. Teal from behind-above on the right, magenta
// from low behind the left. The hue comes from one oklab ramp (magenta → navy → blue →
// teal) and the light shapes are masks over it, so where the two lights overlap they
// meet through navy/blue instead of alpha-compositing into grey.

import type { Variant } from "./types";

const GRAIN_URL =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='2.6 0 0 0 -0.8 2.6 0 0 0 -0.8 2.6 0 0 0 -0.8 0 0 0 0 1'/%3E%3C/filter%3E%3Crect width='240' height='240' filter='url(%23n)'/%3E%3C/svg%3E\")";

// The light field is a box around the car: x from car-l - 0.3w (1.9w wide), y from
// car-t - 0.4h (1.8h tall). The mask is an SVG in a 1900x1330 viewBox stretched over
// that box (same aspect, ~1.25 units per px at any size): a long soft ellipse laid
// along the car's diagonal, with an intensity profile along that axis that peaks at
// both ends (magenta low-left, teal high-right) and dips behind the car's middle.
const MASK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1900 1330" preserveAspectRatio="none">
<defs>
  <linearGradient id="along" gradientUnits="userSpaceOnUse" x1="300" y1="1017" x2="1300" y2="250">
    <stop offset="0" stop-opacity="0.4"/>
    <stop offset="0.09" stop-opacity="0.8"/>
    <stop offset="0.17" stop-opacity="1"/>
    <stop offset="0.32" stop-opacity="0.62"/>
    <stop offset="0.5" stop-opacity="0.36"/>
    <stop offset="0.7" stop-opacity="0.66"/>
    <stop offset="0.88" stop-opacity="1"/>
    <stop offset="1" stop-opacity="0.8"/>
  </linearGradient>
  <radialGradient id="shape" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="translate(810 630) rotate(-37.5) scale(800 400)">
    <stop offset="0" stop-color="#fff"/>
    <stop offset="0.45" stop-color="#e0e0e0"/>
    <stop offset="0.7" stop-color="#8a8a8a"/>
    <stop offset="0.88" stop-color="#2a2a2a"/>
    <stop offset="1" stop-color="#000"/>
  </radialGradient>
  <mask id="mk" maskUnits="userSpaceOnUse" x="0" y="0" width="1900" height="1330">
    <rect width="1900" height="1330" fill="url(#shape)"/>
  </mask>
</defs>
<rect width="1900" height="1330" fill="url(#along)" mask="url(#mk)"/>
</svg>`;

const MASK_URL = `url("data:image/svg+xml,${encodeURIComponent(MASK_SVG.replace(/\n\s*/g, " "))}")`;

const css = `
.split-rim-field {
  position: absolute;
  left: calc(var(--car-l) - var(--car-w) * 0.3);
  top: calc(var(--car-t) - var(--car-h) * 0.4);
  width: calc(var(--car-w) * 1.9);
  height: calc(var(--car-h) * 1.8);
  background: linear-gradient(to top right in oklab,
    var(--livery-pop) 0%,
    var(--livery-pop) 27%,
    color-mix(in oklab, var(--livery-pop) 40%, var(--livery-deep)) 36%,
    color-mix(in oklab, var(--livery-deep) 70%, var(--livery-support)) 45%,
    var(--livery-support) 53%,
    var(--livery) 63%,
    var(--livery) 100%);
  -webkit-mask-image: ${MASK_URL};
  mask-image: ${MASK_URL};
  -webkit-mask-size: 100% 100%;
  mask-size: 100% 100%;
  opacity: 0.46;
}
.split-rim-grain {
  position: absolute;
  inset: 0;
  background-image: ${GRAIN_URL};
  background-size: 240px 240px;
  mix-blend-mode: overlay;
  opacity: 0.1;
}
`;

function SplitRim() {
  return (
    <>
      <style>{css}</style>
      <div className="split-rim-field" />
      <div className="split-rim-grain" />
    </>
  );
}

export const splitRim: Variant = {
  id: "split-rim",
  name: "Two-tone backlight",
  motion: "still",
  tech: "CSS",
  idea: "A still two-light studio setup that matches the render's baked rims: teal washing in from behind-above on the right, magenta from low behind the left, meeting through navy and blue.",
  Component: SplitRim,
};
