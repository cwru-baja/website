"use client";

// PROTOTYPE — throwaway. Trail dust: a faint teal backlight cone from high behind the car, with
// sparse dust drifting through it. Motes catch teal on the car's right and magenta low-left (where
// the render's rim lights are), a few big ones sit out of focus, and the cursor gently parts them.

import { useRef } from "react";
import { PALETTE, hexToVec3, useFrameLoop, useHeroGeometry, useLabReducedMotion, type HeroGeometry } from "../lab";
import type { Variant } from "./types";

type Mote = {
  x: number;
  y: number;
  vx: number; // push velocity (decays)
  vy: number;
  drift: number; // px/s rightward, scaled by depth
  rise: number; // px/s upward
  phase: number;
  r: number; // radius in CSS px
  bokeh: boolean;
  age: number;
  life: number;
  bright: number;
};

const SPRITE = 64;
// Beam: apex high behind the car's rear, aimed down-left through the car (CSS conic angle, 0 = up).
const BEAM_AXIS_DEG = 190;
const BEAM_HALF_DEG = 30;

function sprite(hex: string, bokeh: boolean) {
  const c = document.createElement("canvas");
  c.width = c.height = SPRITE;
  const ctx = c.getContext("2d")!;
  const [r, g, b] = hexToVec3(hex).map((v) => Math.round(v * 255));
  const grad = ctx.createRadialGradient(SPRITE / 2, SPRITE / 2, 0, SPRITE / 2, SPRITE / 2, SPRITE / 2);
  const col = (a: number) => `rgba(${r},${g},${b},${a})`;
  if (bokeh) {
    // Out-of-focus disc: flat body, soft edge.
    grad.addColorStop(0, col(0.75));
    grad.addColorStop(0.55, col(0.7));
    grad.addColorStop(0.8, col(0.35));
    grad.addColorStop(1, col(0));
  } else {
    grad.addColorStop(0, col(1));
    grad.addColorStop(0.18, col(0.75));
    grad.addColorStop(0.45, col(0.18));
    grad.addColorStop(1, col(0));
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SPRITE, SPRITE);
  return c;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function lights(g: HeroGeometry, x: number, y: number) {
  const { car } = g;
  // Teal: inside the beam, strongest a little above the car, plus a general lift right of centre.
  const ax = car.cx + car.w * 0.14;
  const ay = car.t - car.h * 0.34;
  const dx = x - ax;
  const dy = y - ay;
  const dist = Math.hypot(dx, dy);
  const angle = (Math.atan2(dx, -dy) * 180) / Math.PI; // 0 = up, clockwise, like CSS conic
  const off = Math.abs(((angle - BEAM_AXIS_DEG + 540) % 360) - 180);
  const inBeam = 1 - smooth(BEAM_HALF_DEG * 0.35, BEAM_HALF_DEG, off);
  const along = smooth(car.h * 0.15, car.h * 0.55, dist) * (1 - smooth(car.h * 0.9, car.h * 1.55, dist));
  const right = smooth(car.cx - car.w * 0.05, car.cx + car.w * 0.35, x) * (1 - smooth(car.t + car.h * 0.8, car.t + car.h * 1.15, y));
  const teal = Math.min(1, inBeam * along + right * 0.6);
  // Magenta: low and left, under the nose.
  const mx = (x - (car.l + car.w * 0.14)) / (car.w * 0.46);
  const my = (y - (car.t + car.h * 0.88)) / (car.h * 0.4);
  const magenta = (1 - smooth(0.15, 1, Math.hypot(mx, my))) * 0.95;
  // Keep dust out of the headline column.
  const clear = smooth(g.width * 0.37, g.width * 0.47, x);
  return { teal: teal * clear, magenta: magenta * clear };
}

function DustMotes() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const geometry = useHeroGeometry();
  const reduced = useLabReducedMotion();
  const st = useRef({
    seed: 916,
    motes: [] as Mote[],
    sprites: null as null | { teal: HTMLCanvasElement; magenta: HTMLCanvasElement; tealBokeh: HTMLCanvasElement; magentaBokeh: HTMLCanvasElement },
    size: "",
    key: "",
  });

  const random = () => {
    let t = (st.current.seed = (st.current.seed + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const region = (g: HeroGeometry) => ({
    x0: Math.max(g.width * 0.36, g.car.l - g.car.w * 0.1),
    x1: g.width,
    y0: g.car.t - g.car.h * 0.2,
    y1: Math.min(g.height, g.car.floor + g.car.h * 0.1),
  });

  const make = (g: HeroGeometry, bokeh: boolean, fresh: boolean): Mote => {
    const R = region(g);
    const scale = g.car.w / 800;
    const depth = random();
    const r = bokeh ? (9 + random() * 16) * scale : (0.6 + Math.pow(random(), 1.8) * 2.2) * Math.max(0.6, scale);
    const life = 9 + random() * 14;
    // Most dust behind the car body would be hidden anyway: thin it out there, keep it where it shows.
    let x = 0;
    let y = 0;
    for (let tries = 0; tries < 6; tries++) {
      x = R.x0 + random() * (R.x1 - R.x0);
      y = R.y0 + random() * (R.y1 - R.y0);
      const ex = (x - g.car.cx) / (g.car.w * 0.42);
      const ey = (y - (g.car.cy + g.car.h * 0.02)) / (g.car.h * 0.36);
      if (ex * ex + ey * ey > 1 || random() < 0.25) break;
    }
    return {
      x,
      y,
      vx: 0,
      vy: 0,
      drift: (bokeh ? 12 : 3 + depth * 8) * scale,
      rise: (bokeh ? 3 : 1.5 + depth * 4) * scale,
      phase: random() * Math.PI * 2,
      r,
      bokeh,
      age: fresh ? 0 : random() * life,
      life,
      bright: bokeh ? 0.12 + random() * 0.08 : 0.4 + random() * 0.6,
    };
  };

  useFrameLoop((t, dt) => {
    const canvas = canvasRef.current;
    const g = geometry.current;
    if (!canvas || g.car.w <= 1) return;
    const s = st.current;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = `${g.width}x${g.height}@${dpr}`;
    if (size !== s.size) {
      s.size = size;
      canvas.width = Math.round(g.width * dpr);
      canvas.height = Math.round(g.height * dpr);
    }
    if (!s.sprites) {
      s.sprites = {
        teal: sprite(PALETTE.teal, false),
        magenta: sprite(PALETTE.magentaLight, false),
        tealBokeh: sprite(PALETTE.teal, true),
        magentaBokeh: sprite(PALETTE.magentaLight, true),
      };
    }
    // (Re)seed the field when the car moves (first frame, resize).
    const key = [g.car.l, g.car.t, g.car.w, g.width].map((v) => Math.round(v)).join();
    if (key !== s.key) {
      s.key = key;
      s.seed = 916;
      const count = Math.round(Math.min(110, Math.max(36, 95 * (g.car.w / 800))));
      s.motes = [];
      for (let i = 0; i < count; i++) s.motes.push(make(g, i < 7, false));
    }

    const step = reduced ? 0 : dt;
    const R = region(g);
    const push = g.pointer.active;
    const radius = 170 * Math.max(0.5, g.car.w / 800);

    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, g.width, g.height);
    ctx.globalCompositeOperation = "lighter";

    for (let i = 0; i < s.motes.length; i++) {
      let m = s.motes[i];
      if (step > 0) {
        m.age += step;
        if (m.age > m.life) {
          m = s.motes[i] = make(g, m.bokeh, true);
        }
        // Cursor: push away within the radius, falling off smoothly.
        if (push > 0.01) {
          const dx = m.x - g.pointer.x;
          const dy = m.y - g.pointer.y;
          const d = Math.hypot(dx, dy) || 1;
          if (d < radius) {
            const f = Math.pow(1 - d / radius, 2) * 520 * push * (m.bokeh ? 0.4 : 1);
            m.vx += (dx / d) * f * step;
            m.vy += (dy / d) * f * step;
          }
        }
        const damp = Math.exp(-step * 1.8);
        m.vx *= damp;
        m.vy *= damp;
        const wanderX = Math.sin(t * 0.23 + m.phase) * 4 + Math.sin(t * 0.61 + m.phase * 1.7) * 2;
        const wanderY = Math.cos(t * 0.19 + m.phase * 1.3) * 3;
        m.x += (m.drift + wanderX + m.vx) * step;
        m.y += (-m.rise + wanderY + m.vy) * step;
        // Wrap softly: anything that leaves the region is recycled (it has faded by then).
        if (m.x > R.x1 + 30 || m.y < R.y0 - 40 || m.x < R.x0 - 60 || m.y > R.y1 + 40) {
          m = s.motes[i] = make(g, m.bokeh, true);
        }
      }

      const fade = smooth(0, 2, m.age) * (1 - smooth(m.life - 2.5, m.life, m.age));
      // Region edges fade too, so nothing pops at the boundary.
      const edge =
        smooth(R.y0 - 30, R.y0 + 60, m.y) * (1 - smooth(R.y1 - 60, R.y1 + 30, m.y)) * (1 - smooth(R.x1 - 60, R.x1 + 20, m.x));
      const L = lights(g, m.x, m.y);
      const a = m.bright * fade * edge;
      if (a < 0.004) continue;
      const d = m.bokeh ? m.r * 2 : m.r * 6;
      const sp = s.sprites;
      if (L.teal > 0.01) {
        ctx.globalAlpha = Math.min(1, a * (0.1 + 1.3 * L.teal));
        ctx.drawImage(m.bokeh ? sp.tealBokeh : sp.teal, m.x - d / 2, m.y - d / 2, d, d);
      }
      if (L.magenta > 0.01) {
        ctx.globalAlpha = Math.min(1, a * 1.3 * L.magenta);
        ctx.drawImage(m.bokeh ? sp.magentaBokeh : sp.magenta, m.x - d / 2, m.y - d / 2, d, d);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }, canvasRef);

  const apexX = "calc(var(--car-cx) + var(--car-w) * 0.14)";
  const apexY = "calc(var(--car-t) - var(--car-h) * 0.34)";
  const teal = (k: number) => `color-mix(in oklab, var(--livery) ${k}%, transparent)`;
  const from = BEAM_AXIS_DEG - BEAM_HALF_DEG;
  const beamMask = `radial-gradient(circle calc(var(--car-h) * 1.6) at ${apexX} ${apexY}, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.85) 30%, rgba(0,0,0,0.55) 62%, transparent 100%)`;

  return (
    <>
      {/* Backlight cone */}
      <div
        className="absolute inset-0"
        style={{
          background: `conic-gradient(from ${from}deg at ${apexX} ${apexY} in oklab, transparent 0deg, ${teal(3)} ${BEAM_HALF_DEG * 0.3}deg, ${teal(13)} ${BEAM_HALF_DEG * 0.65}deg, ${teal(19)} ${BEAM_HALF_DEG}deg, ${teal(13)} ${BEAM_HALF_DEG * 1.35}deg, ${teal(3)} ${BEAM_HALF_DEG * 1.7}deg, transparent ${BEAM_HALF_DEG * 2}deg, transparent 360deg)`,
          maskImage: beamMask,
          WebkitMaskImage: beamMask,
        }}
      />
      {/* The render's low-left magenta rim light, barely there, so magenta dust has a source. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse calc(var(--car-w) * 0.4) calc(var(--car-h) * 0.3) at calc(var(--car-l) + var(--car-w) * 0.2) calc(var(--car-t) + var(--car-h) * 0.88), color-mix(in oklab, var(--livery-pop) 7%, transparent), transparent)",
        }}
      />
      <canvas ref={canvasRef} aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} />
    </>
  );
}

export const dustMotes: Variant = {
  id: "dust-motes",
  name: "Trail dust",
  motion: "lively",
  reactive: "cursor",
  tech: "Canvas 2D",
  idea: "Sparse trail dust drifts through a faint teal backlight, catching teal behind the car and magenta low-left like the render's rim lights; the cursor gently parts it.",
  Component: DustMotes,
};
