"use client";

// PROTOTYPE — throwaway. Livery ribbons: a fan of dim hairlines sweeping behind the car
// from lower-left to top-right, each carrying a soft travelling highlight in a livery colour.

import { useEffect, useRef, useState } from "react";
import { PALETTE, useHeroGeometry } from "../lab";
import type { Variant } from "./types";

type Pt = [number, number];
type Box = { W: number; H: number; l: number; t: number; w: number; h: number };

// Control points in car-box fractions (0,0 = car top-left, 1,1 = car bottom-right).
// Stops weight each ribbon's colour along its length: magenta reads low-left, teal high-right,
// matching the rim lights baked into the render.
const RIBBONS: {
  pts: [Pt, Pt, Pt, Pt];
  color: string;
  stops: [number, number][];
  dur: number;
  delay: number;
  rest: number;
  base: number;
}[] = [
  {
    pts: [[-0.34, 1.16], [0.18, 1.12], [0.72, 0.78], [1.12, -0.02]],
    color: PALETTE.magentaLight,
    stops: [[0, 0], [0.12, 1], [0.5, 0.75], [0.82, 0.1], [1, 0]],
    dur: 11,
    delay: -2.5,
    rest: 30,
    base: 0.12,
  },
  {
    pts: [[-0.3, 1.12], [0.2, 1.06], [0.72, 0.7], [1.1, -0.08]],
    color: PALETTE.blue,
    stops: [[0, 0], [0.18, 0.9], [0.7, 1], [1, 0]],
    dur: 9,
    delay: -6,
    rest: 55,
    base: 0.2,
  },
  {
    pts: [[-0.25, 1.08], [0.22, 1.0], [0.71, 0.62], [1.08, -0.14]],
    color: PALETTE.teal,
    stops: [[0, 0], [0.25, 0.45], [0.62, 1], [0.92, 0.7], [1, 0]],
    dur: 7.5,
    delay: -0.5,
    rest: 72,
    base: 0.16,
  },
  {
    pts: [[-0.19, 1.04], [0.25, 0.93], [0.7, 0.54], [1.06, -0.2]],
    color: PALETTE.teal,
    stops: [[0, 0], [0.35, 0.3], [0.7, 0.85], [1, 0]],
    dur: 13,
    delay: -9,
    rest: 88,
    base: 0.1,
  },
];

// Highlight = stacked dashes, each centred `shift` behind the head, so it reads as a comet
// with a soft nose and a long faint tail. Widths in CSS px; len/shift in % of the path.
const LAYERS = [
  { width: 1.1, len: 24, shift: 12, opacity: 0.4 },
  { width: 12, len: 18, shift: 7, opacity: 0.06 },
  { width: 5.5, len: 12, shift: 4.5, opacity: 0.14 },
  { width: 2.6, len: 7, shift: 2.8, opacity: 0.42 },
  { width: 1.5, len: 3.5, shift: 1.2, opacity: 1 },
];

// Pattern period in path units (pathLength = 100). The head travels -4 → 128, so the whole
// comet (tail included) is off the path at both ends: no second dash, no loop seam.
const PERIOD = 240;

function useCarBox(ref: React.RefObject<HTMLDivElement | null>) {
  const geometry = useHeroGeometry();
  const [box, setBox] = useState<Box | null>(null);
  useEffect(() => {
    let raf = 0;
    const read = () => {
      raf = 0;
      const g = geometry.current;
      if (g.car.w <= 1) return void (raf = requestAnimationFrame(read));
      const next = { W: g.width, H: g.height, l: g.car.l, t: g.car.t, w: g.car.w, h: g.car.h };
      setBox((prev) =>
        prev && (Object.keys(next) as (keyof Box)[]).every((k) => Math.abs(prev[k] - next[k]) < 0.5) ? prev : next,
      );
    };
    const ro = new ResizeObserver(() => {
      if (!raf) raf = requestAnimationFrame(read);
    });
    if (ref.current) ro.observe(ref.current);
    raf = requestAnimationFrame(read);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [geometry, ref]);
  return box;
}

function LiveryRibbons() {
  const ref = useRef<HTMLDivElement>(null);
  const box = useCarBox(ref);

  const map = ([u, v]: Pt): Pt => (box ? [box.l + u * box.w, box.t + v * box.h] : [0, 0]);

  return (
    <div ref={ref} className="absolute inset-0">
      <style>{`
        ${LAYERS.map(
          (layer, j) =>
            `@keyframes livery-ribbons-travel-${j} { from { stroke-dashoffset: ${layer.shift + 4}; } to { stroke-dashoffset: ${layer.shift - 128}; } }`,
        ).join("\n")}
        .livery-ribbons-pulse {
          animation-iteration-count: infinite;
          animation-timing-function: cubic-bezier(0.3, 0.1, 0.7, 0.9);
        }
        [data-reduced-motion] .livery-ribbons-pulse { animation: none !important; }
      `}</style>
      {box && (
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${box.W} ${box.H}`}
          preserveAspectRatio="none"
          style={{ position: "absolute", inset: 0, overflow: "visible" }}
          aria-hidden
        >
          <defs>
            {RIBBONS.map((r, i) => {
              const [x1, y1] = map(r.pts[0]);
              const [x2, y2] = map(r.pts[3]);
              return (
                <linearGradient key={i} id={`livery-ribbons-g${i}`} gradientUnits="userSpaceOnUse" x1={x1} y1={y1} x2={x2} y2={y2}>
                  {r.stops.map(([o, a], j) => (
                    <stop key={j} offset={o} stopColor={r.color} stopOpacity={a} />
                  ))}
                </linearGradient>
              );
            })}
          </defs>
          {RIBBONS.map((r, i) => {
            const [p0, c1, c2, p3] = r.pts.map(map);
            const d = `M${p0[0]},${p0[1]} C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p3[0]},${p3[1]}`;
            const stroke = `url(#livery-ribbons-g${i})`;
            return (
              <g key={i} fill="none" strokeLinecap="round">
                <path d={d} stroke={stroke} strokeWidth={1} strokeOpacity={r.base} />
                {LAYERS.map((layer, j) => (
                  <path
                    key={j}
                    className="livery-ribbons-pulse"
                    d={d}
                    pathLength={100}
                    stroke={stroke}
                    strokeWidth={layer.width}
                    strokeOpacity={layer.opacity}
                    strokeDasharray={`${layer.len / 2} ${PERIOD - layer.len} ${layer.len / 2} 0`}
                    style={
                      {
                        animationName: `livery-ribbons-travel-${j}`,
                        strokeDashoffset: layer.shift - r.rest,
                        animationDuration: `${r.dur}s`,
                        animationDelay: `${r.delay}s`,
                      } as React.CSSProperties
                    }
                  />
                ))}
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

export const liveryRibbons: Variant = {
  id: "livery-ribbons",
  name: "Livery ribbons",
  motion: "calm",
  tech: "SVG",
  idea: "A fan of dim hairlines sweeps behind the car like the livery's swooshes, with soft teal, blue and magenta highlights gliding along them.",
  Component: LiveryRibbons,
};
