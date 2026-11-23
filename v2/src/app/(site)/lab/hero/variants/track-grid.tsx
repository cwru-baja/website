"use client";

// PROTOTYPE — throwaway. Perspective floor grid: a fine, dim navy ground grid under the car,
// like a telemetry display, with the occasional teal or magenta pulse running toward the car.

import { useEffect, useRef } from "react";
import { PALETTE, hexToVec3, useFrameLoop, useHeroGeometry, useLabReducedMotion, type HeroGeometry } from "../lab";
import type { Variant } from "./types";

// World units: X across, z depth (camera looks down +z). Screen: x = vx + k·X/z, y = hy + k·z⁻¹.
const CELL = 0.25;
const Z_FAR = 11;
const RAD_X = 0.5;
const RAD_Y = 0.5;
const LINE_RGB = "46, 74, 124"; // navy lifted a touch toward the livery blue so 1px lines register at all

type Frame = {
  W: number;
  H: number;
  dpr: number;
  vx: number;
  hy: number;
  k: number;
  zNear: number;
  zCar: number;
  gy: number;
  carW: number;
};

type Pulse = {
  born: number;
  dur: number;
  kind: "depth" | "cross";
  lane: number; // X for depth pulses, z for cross pulses
  from: number;
  to: number;
  rgb: [number, number, number];
};

function frameFor(g: HeroGeometry, dpr: number): Frame {
  const hy = g.car.gy - 0.2 * g.car.h;
  const k = 0.41 * g.car.w;
  return {
    W: g.width,
    H: g.height,
    dpr,
    vx: g.car.gx,
    hy,
    k,
    zNear: (k / Math.max(1, g.height - hy)) * 0.9,
    zCar: k / Math.max(1, g.car.gy + 0.07 * g.car.h - hy),
    gy: g.car.gy,
    carW: g.car.w,
  };
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Same falloff the grid gets from its masks, evaluated at a point (for pulses).
function fadeAt(f: Frame, x: number, y: number) {
  const depth = smooth(f.hy, f.hy + 0.5 * (f.H - f.hy), y);
  const dx = (x - f.vx) / (RAD_X * f.W);
  const dy = (y - f.gy) / (RAD_Y * f.H);
  const radial = 1 - smooth(0.2, 1, Math.hypot(dx, dy));
  const left = smooth(0.3 * f.W, 0.5 * f.W, x);
  return depth * radial * left;
}

function drawGrid(ctx: CanvasRenderingContext2D, f: Frame) {
  const { W, H, dpr, vx, hy, k, zNear } = f;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.globalCompositeOperation = "source-over";
  ctx.lineWidth = 1;
  // Minor lines every cell, major lines every fourth: the major ones carry the structure.
  for (const major of [false, true]) {
    ctx.strokeStyle = `rgba(${LINE_RGB}, ${major ? 0.62 : 0.26})`;
    ctx.beginPath();
    const xSpan = (Math.max(vx, W - vx) / k) * Z_FAR * 0.5;
    for (let i = Math.ceil(-xSpan / CELL); i <= Math.floor(xSpan / CELL); i++) {
      if ((((i % 4) + 4) % 4 === 2) !== major) continue; // no major line straight down the car's centre
      const X = i * CELL;
      ctx.moveTo(vx + (k * X) / zNear, hy + k / zNear);
      ctx.lineTo(vx + (k * X) / Z_FAR, hy + k / Z_FAR);
    }
    // Cross lines, evenly spaced in depth, so they bunch toward the horizon.
    for (let j = Math.ceil(zNear / CELL); j * CELL <= Z_FAR; j++) {
      if ((j % 4 === 0) !== major) continue;
      const y = hy + k / (j * CELL);
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    ctx.stroke();
  }

  // Fade with distance (toward the horizon), away from the car, and away from the headline column.
  ctx.globalCompositeOperation = "destination-in";
  const vert = ctx.createLinearGradient(0, hy, 0, H);
  vert.addColorStop(0, "rgba(0,0,0,0)");
  vert.addColorStop(0.1, "rgba(0,0,0,0.06)");
  vert.addColorStop(0.3, "rgba(0,0,0,0.55)");
  vert.addColorStop(0.5, "rgba(0,0,0,1)");
  vert.addColorStop(1, "rgba(0,0,0,0.7)");
  ctx.fillStyle = vert;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(vx, f.gy);
  ctx.scale(RAD_X * W, RAD_Y * H);
  const rad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  rad.addColorStop(0, "rgba(0,0,0,1)");
  rad.addColorStop(0.3, "rgba(0,0,0,0.85)");
  rad.addColorStop(0.65, "rgba(0,0,0,0.3)");
  rad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = rad;
  ctx.fillRect(-4, -4, 8, 8);
  ctx.restore();

  const side = ctx.createLinearGradient(0.3 * W, 0, 0.5 * W, 0);
  side.addColorStop(0, "rgba(0,0,0,0)");
  side.addColorStop(1, "rgba(0,0,0,1)");
  ctx.fillStyle = side;
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = "source-over";
}

function drawPulse(ctx: CanvasRenderingContext2D, f: Frame, p: Pulse, now: number) {
  const u = Math.min(1, Math.max(0, (now - p.born) / p.dur));
  // Ease out: quick launch, gentle arrival.
  const e = 1 - Math.pow(1 - u, 2.2);
  const env = smooth(0, 0.12, u) * (1 - smooth(0.55, 1, u));
  if (env <= 0.001) return;
  const pos = p.from + (p.to - p.from) * e;
  const tailLen = (p.to - p.from) * 0.3;
  const proj = (s: number): [number, number] =>
    p.kind === "depth"
      ? [f.vx + (f.k * p.lane) / s, f.hy + f.k / s]
      : [f.vx + (f.k * s) / p.lane, f.hy + f.k / p.lane];
  const [hx, hy] = proj(pos);
  const [tx, ty] = proj(pos - tailLen);
  const a = env * Math.max(0.25, fadeAt(f, hx, hy));
  const [r, g, b] = p.rgb;
  const col = (alpha: number) => `rgba(${r},${g},${b},${alpha})`;

  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  const grad = ctx.createLinearGradient(tx, ty, hx, hy);
  grad.addColorStop(0, col(0));
  grad.addColorStop(1, col(a));
  ctx.strokeStyle = grad;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(hx, hy);
  ctx.stroke();

  const glow = ctx.createLinearGradient(tx, ty, hx, hy);
  glow.addColorStop(0, col(0));
  glow.addColorStop(1, col(a * 0.22));
  ctx.strokeStyle = glow;
  ctx.lineWidth = 6;
  ctx.stroke();

  const dot = ctx.createRadialGradient(hx, hy, 0, hx, hy, 24);
  dot.addColorStop(0, col(a * 0.6));
  dot.addColorStop(0.2, col(a * 0.16));
  dot.addColorStop(1, col(0));
  ctx.fillStyle = dot;
  ctx.fillRect(hx - 24, hy - 24, 48, 48);
  ctx.globalCompositeOperation = "source-over";
}

const TEAL = hexToVec3(PALETTE.teal).map((c) => Math.round(c * 255)) as [number, number, number];
const MAGENTA = hexToVec3(PALETTE.magentaLight).map((c) => Math.round(c * 255)) as [number, number, number];

function TrackGrid() {
  const gridRef = useRef<HTMLCanvasElement>(null);
  const pulseRef = useRef<HTMLCanvasElement>(null);
  const geometry = useHeroGeometry();
  const reduced = useLabReducedMotion();
  const state = useRef<{ frame: Frame | null; key: string; pulses: Pulse[]; next: number; seed: number }>({
    frame: null,
    key: "",
    pulses: [],
    next: 1.2,
    seed: 7,
  });

  const rand = () => {
    // Deterministic-ish so reloads feel similar; fine for a prototype.
    const s = state.current;
    s.seed = (s.seed * 16807) % 2147483647;
    return s.seed / 2147483647;
  };

  const spawn = (f: Frame, now: number): Pulse => {
    const teal = rand() < 0.62;
    if (rand() < 0.6) {
      // Run up a depth line toward the car's footprint. Teal on the right, magenta on the left.
      const lane = (1 + Math.floor(rand() * 5)) * CELL * (teal ? 1 : -1);
      return { born: now, dur: 2.6 + rand() * 1.2, kind: "depth", lane, from: f.zNear * 1.02, to: f.zCar, rgb: teal ? TEAL : MAGENTA };
    }
    // Run in along a cross line from the side.
    const z = f.zCar * (0.45 + rand() * 0.35);
    const lanes = Math.round(z / CELL);
    const edge = (teal ? 1 : -1) * ((teal ? f.W - f.vx : f.vx) / f.k) * lanes * CELL * 0.9;
    return { born: now, dur: 3 + rand() * 1.4, kind: "cross", lane: lanes * CELL, from: edge, to: edge * 0.22, rgb: teal ? TEAL : MAGENTA };
  };

  const draw = (t: number) => {
    const grid = gridRef.current;
    const pulse = pulseRef.current;
    if (!grid || !pulse) return;
    const g = geometry.current;
    if (g.car.w <= 1) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const s = state.current;
    const key = [g.width, g.height, g.car.gx, g.car.gy, g.car.w, dpr].map((v) => v.toFixed(1)).join();
    if (key !== s.key) {
      s.key = key;
      s.frame = frameFor(g, dpr);
      for (const c of [grid, pulse]) {
        c.width = Math.round(g.width * dpr);
        c.height = Math.round(g.height * dpr);
      }
      drawGrid(grid.getContext("2d")!, s.frame);
    }
    const f = s.frame!;
    const ctx = pulse.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, f.W, f.H);

    if (reduced) {
      // A frozen, finished composition: one pulse from each side, mid-run.
      const a = spawn(f, 0);
      const still: Pulse[] = [
        { ...a, kind: "depth", lane: 2 * CELL, from: f.zNear * 1.02, to: f.zCar, rgb: TEAL, born: 0, dur: 3 },
        { ...a, kind: "depth", lane: -3 * CELL, from: f.zNear * 1.02, to: f.zCar, rgb: MAGENTA, born: -0.4, dur: 3 },
      ];
      for (const p of still) drawPulse(ctx, f, p, 1.1);
      return;
    }

    if (t >= s.next && s.pulses.length < 2) {
      s.pulses.push(spawn(f, t));
      s.next = t + 2.2 + rand() * 2.8;
    }
    s.pulses = s.pulses.filter((p) => t - p.born < p.dur);
    for (const p of s.pulses) drawPulse(ctx, f, p, t);
  };

  useFrameLoop((t) => draw(t), gridRef);

  // Reduced motion draws a single frame; redraw it when the hero resizes.
  const drawRef = useRef(draw);
  useEffect(() => {
    drawRef.current = draw;
  });
  useEffect(() => {
    if (!reduced || !gridRef.current) return;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => drawRef.current(0));
    });
    ro.observe(gridRef.current);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [reduced]);

  const canvasStyle = { position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" } as const;
  return (
    <>
      <canvas ref={gridRef} style={canvasStyle} aria-hidden />
      <canvas ref={pulseRef} style={canvasStyle} aria-hidden />
    </>
  );
}

export const trackGrid: Variant = {
  id: "track-grid",
  name: "Perspective floor grid",
  motion: "calm",
  tech: "Canvas 2D",
  idea: "A fine navy ground grid recedes to a horizon just above the tyres, like a telemetry display, with the odd teal or magenta pulse running in toward the car.",
  Component: TrackGrid,
};
