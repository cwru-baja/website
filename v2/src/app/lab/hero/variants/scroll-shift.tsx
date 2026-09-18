"use client";

// PROTOTYPE — throwaway. Scroll colour shift: a teal backlight sits behind the car at rest; as the
// hero scrolls away the light swings around the car (over the right, under, out low-left) and
// cross-fades teal → blue → magenta, ending where the render's magenta rim light already is.

import type { Variant } from "./types";

// Soft light falloff for one pre-coloured glow (approximately Gaussian, interpolated in oklab).
function glow(color: string, peak: number) {
  const stop = (k: number, at: number) => `color-mix(in oklab, ${color} ${(peak * k * 100).toFixed(1)}%, transparent) ${at}%`;
  return `radial-gradient(closest-side in oklab, ${stop(1, 0)}, ${stop(0.82, 18)}, ${stop(0.55, 36)}, ${stop(0.28, 55)}, ${stop(0.1, 74)}, ${stop(0.025, 90)}, transparent 100%)`;
}

// Faint static grain so the long dark gradient tails don't band.
const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 2.2 -1.1'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

// Orbit squash: the light swings on a flattened ellipse so it stays inside the hero.
const SQUASH = 0.62;

const CSS = `
  .scroll-shift-root {
    /* 0 → 1 over the first half of the hero scrolling away, so the whole shift plays out
       while the car is still on screen. */
    --scroll-shift-p: clamp(0, calc(var(--scroll, 0) / 0.5), 1);
    --scroll-shift-a: calc(var(--scroll-shift-p) * 180deg);
  }
  .scroll-shift-stage {
    position: absolute;
    inset: 0;
    /* Never reach the hero's bottom edge (it scrolls into view exactly when the light is low)
       or the headline column. */
    mask-image: linear-gradient(to bottom, black 62%, transparent 97%), linear-gradient(to right, transparent 30%, black 52%);
    -webkit-mask-image: linear-gradient(to bottom, black 62%, transparent 97%), linear-gradient(to right, transparent 30%, black 52%);
    mask-composite: intersect;
    -webkit-mask-composite: source-in;
  }
  .scroll-shift-pivot {
    position: absolute;
    left: var(--car-cx);
    top: calc(var(--car-cy) - var(--car-h) * 0.04);
    width: 0;
    height: 0;
    transform: scale(1, ${SQUASH}) rotate(var(--scroll-shift-a));
  }
  .scroll-shift-drift {
    position: absolute;
    inset: 0;
    animation: scroll-shift-drift 29s cubic-bezier(0.45, 0, 0.55, 1) infinite alternate;
  }
  .scroll-shift-sway {
    position: absolute;
    inset: 0;
    animation: scroll-shift-sway 41s cubic-bezier(0.45, 0, 0.55, 1) -13s infinite alternate;
  }
  @keyframes scroll-shift-drift {
    from { transform: rotate(-8deg); }
    to   { transform: rotate(7deg); }
  }
  @keyframes scroll-shift-sway {
    from { transform: translate(calc(var(--car-w) * -0.025), calc(var(--car-h) * 0.03)) scale(0.96); }
    to   { transform: translate(calc(var(--car-w) * 0.025), calc(var(--car-h) * -0.03)) scale(1.04); }
  }
  [data-reduced-motion] .scroll-shift-drift,
  [data-reduced-motion] .scroll-shift-sway { animation: none; }
  .scroll-shift-glow {
    position: absolute;
    /* Counter-rotate so each glow keeps its shape while its centre travels the orbit. */
    transform: rotate(calc(-1 * var(--scroll-shift-a)));
    will-change: transform, opacity;
  }
  ${[
    // [class, colour var, peak, offset x (car w), offset y (car h, pre-squash), width (car w), height (car h, on screen)]
    ["teal", "var(--livery)", 0.4, 0.2, -0.36, 1.4, 1.2, "clamp(0, calc(1 - var(--scroll-shift-p) * 2), 1)"],
    ["blue", "var(--livery-support)", 0.5, 0.2, -0.36, 1.25, 1.1, "clamp(0, min(calc(var(--scroll-shift-p) * 2), calc(2 - var(--scroll-shift-p) * 2)), 1)"],
    ["magenta", "var(--livery-pop)", 0.36, 0.2, -0.36, 1.15, 1.0, "clamp(0, calc(var(--scroll-shift-p) * 2 - 1), 1)"],
  ]
    .map(
      ([name, color, peak, ox, oy, w, h, opacity]) => `
  .scroll-shift-${name} {
    left: calc(var(--car-w) * ${(ox as number) - (w as number) / 2});
    top: calc(var(--car-h) * ${(oy as number) - (h as number) / SQUASH / 2});
    width: calc(var(--car-w) * ${w});
    height: calc(var(--car-h) * ${(h as number) / SQUASH});
    background: ${glow(color as string, peak as number)};
    opacity: ${opacity};
  }`,
    )
    .join("")}
  .scroll-shift-grain {
    position: absolute;
    inset: 0;
    background-image: ${GRAIN};
    opacity: 0.035;
    mask-image: radial-gradient(ellipse calc(var(--car-w) * 1.1) calc(var(--car-h) * 1.1) at var(--car-cx) var(--car-cy), black, transparent);
    -webkit-mask-image: radial-gradient(ellipse calc(var(--car-w) * 1.1) calc(var(--car-h) * 1.1) at var(--car-cx) var(--car-cy), black, transparent);
  }
`;

function ScrollShift() {
  return (
    <div className="scroll-shift-root absolute inset-0">
      <style>{CSS}</style>
      <div className="scroll-shift-stage">
        <div className="scroll-shift-pivot">
          <div className="scroll-shift-drift">
            <div className="scroll-shift-sway">
              <div className="scroll-shift-glow scroll-shift-teal" />
              <div className="scroll-shift-glow scroll-shift-blue" />
              <div className="scroll-shift-glow scroll-shift-magenta" />
            </div>
          </div>
        </div>
      </div>
      <div className="scroll-shift-grain" />
    </div>
  );
}

export const scrollShift: Variant = {
  id: "scroll-shift",
  name: "Scroll colour shift",
  motion: "ambient",
  reactive: "scroll",
  tech: "CSS",
  idea: "A clean teal backlight drifts behind the car; scrolling swings it round under the car and through blue to magenta, so the lighting follows you down the page.",
  Component: ScrollShift,
};
