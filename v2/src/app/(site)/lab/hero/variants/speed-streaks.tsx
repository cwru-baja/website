"use client";

// PROTOTYPE — throwaway. Speed streaks: sparse, thin light streaks pass behind the car from left
// to right, as if it were driving toward screen-left. Scrolling briefly speeds them up.

import { useRef } from "react";
import { PALETTE, hexToVec3, useFrameLoop, useHeroGeometry, useLabReducedMotion } from "../lab";
import type { Variant } from "./types";

type Streak = { x: number; y: number; depth: number; len: number; speed: number; alpha: number; thick: number; sprite: number };

const SPRITE_W = 512;
const SPRITE_H = 32;
const COLORS = [PALETTE.teal, PALETTE.blue, PALETTE.magentaLight];

// A horizontal streak with a long transparent tail on the left, a soft rounded head on the right,
// and a thin bright core wrapped in a faint halo.
function makeSprite(hex: string) {
  const c = document.createElement("canvas");
  c.width = SPRITE_W;
  c.height = SPRITE_H;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(SPRITE_W, SPRITE_H);
  const [r, g, b] = hexToVec3(hex).map((v) => Math.round(v * 255));
  const cy = (SPRITE_H - 1) / 2;
  for (let x = 0; x < SPRITE_W; x++) {
    const u = x / (SPRITE_W - 1);
    const head = 1 - Math.pow(Math.max(0, (u - 0.965) / 0.035), 2);
    const along = Math.pow(u, 1.7) * head;
    for (let y = 0; y < SPRITE_H; y++) {
      const dy = y - cy;
      const across = Math.exp(-(dy * dy) / (2 * 2.2 * 2.2)) + 0.16 * Math.exp(-(dy * dy) / (2 * 7 * 7));
      const i = (y * SPRITE_W + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = Math.round(255 * Math.min(1, along * across));
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function SpeedStreaks() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const geometry = useHeroGeometry();
  const reduced = useLabReducedMotion();
  const s = useRef({
    seed: 20260916,
    sprites: null as HTMLCanvasElement[] | null,
    streaks: [] as Streak[],
    lastScroll: -1,
    boost: 0,
    spawnIn: 0,
    size: "",
    started: false,
  });

  // Seeded so the frozen reduced-motion frame is always the same composition.
  const random = () => {
    let t = (s.current.seed = (s.current.seed + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const spawn = (fresh: boolean): Streak => {
    const g = geometry.current;
    const { car } = g;
    const scale = car.w / 800;
    const depth = Math.pow(random(), 1.35); // mostly far and faint, a few near and bright
    // Concentrate around the car's body line, a little below centre.
    const spread = (random() + random()) / 2 - 0.5;
    const y = car.t + car.h * (0.5 + spread * 1.0);
    const low = (y - car.t) / car.h > 0.55;
    const roll = random();
    // Magenta only in the lower half, where the render's magenta rim light lives.
    const sprite = low && roll < 0.14 ? 2 : roll < 0.42 ? 1 : 0;
    const len = (50 + depth * 330 + random() * 60) * scale;
    const x0 = car.l - 0.12 * car.w;
    return {
      x: fresh ? x0 - random() * 260 * scale : x0 + random() * (g.width - x0 + len),
      y,
      depth,
      len,
      speed: (120 + depth * depth * 620 + random() * 40) * scale,
      alpha: (sprite === 1 ? 0.3 : 0.2) + depth * 0.95,
      thick: 0.6 + depth * 0.6,
      sprite,
    };
  };

  useFrameLoop((_t, dt) => {
    const canvas = canvasRef.current;
    const g = geometry.current;
    if (!canvas || g.car.w <= 1) return;
    const st = s.current;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = `${g.width}x${g.height}@${dpr}`;
    if (size !== st.size) {
      st.size = size;
      canvas.width = Math.round(g.width * dpr);
      canvas.height = Math.round(g.height * dpr);
    }
    if (!st.sprites) st.sprites = COLORS.map(makeSprite);
    if (!st.started) {
      st.started = true;
      st.lastScroll = g.scroll;
      for (let i = 0; i < 20; i++) st.streaks.push(spawn(false));
    }

    // Scroll velocity (hero heights per second) → a boost that attacks quickly and settles slowly.
    if (!reduced && dt > 0) {
      const v = Math.abs(g.scroll - st.lastScroll) / dt;
      st.lastScroll = g.scroll;
      const target = Math.min(1, v * 1.6);
      const rate = target > st.boost ? 7 : 1.1;
      st.boost += (target - st.boost) * (1 - Math.exp(-dt * rate));
    }
    const b = st.boost;
    const speedMul = 1 + b * 2.6;
    const lenMul = 1 + b * 1.1;

    if (!reduced) {
      for (const k of st.streaks) k.x += k.speed * speedMul * dt;
      const right = g.width;
      st.streaks = st.streaks.filter((k) => k.x - k.len * lenMul < right);
      const target = Math.round(20 + b * 12);
      st.spawnIn -= dt * speedMul;
      if (st.streaks.length < target && st.spawnIn <= 0) {
        st.streaks.push(spawn(true));
        st.spawnIn = 0.05 + random() * 0.3;
      }
    }

    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, g.width, g.height);
    ctx.globalCompositeOperation = "lighter";
    // Far streaks first.
    const sorted = [...st.streaks].sort((a, c) => a.depth - c.depth);
    for (const k of sorted) {
      const len = k.len * lenMul;
      const h = SPRITE_H * 0.5 * k.thick;
      const a = k.alpha * (1 + b * 0.25);
      // Alpha above 1 means "brighter than one pass": draw twice with the 'lighter' blend.
      for (let pass = a; pass > 0.01; pass -= 1) {
        ctx.globalAlpha = Math.min(1, pass);
        ctx.drawImage(st.sprites[k.sprite], k.x - len, k.y - h / 2, len, h);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }, canvasRef);

  // The band: fade in clear of the headline, out at the right edge, and above/below the car.
  const mask =
    "linear-gradient(to right, transparent calc(var(--car-l) - 0.02 * var(--car-w)), black calc(var(--car-l) + 0.24 * var(--car-w)), black calc(100% - 90px), transparent 100%), " +
    "linear-gradient(to bottom, transparent var(--car-t), black calc(var(--car-t) + 0.24 * var(--car-h)), black calc(var(--car-t) + 0.8 * var(--car-h)), transparent calc(var(--car-t) + 1.02 * var(--car-h)))";

  return (
    <>
      {/* A barely-there teal wash so the streaks sit in the same light as the car. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse calc(var(--car-w) * 0.62) calc(var(--car-h) * 0.5) at calc(var(--car-cx) + 0.08 * var(--car-w)) var(--car-cy), color-mix(in oklab, var(--livery) 9%, transparent), transparent 100%)",
        }}
      />
      <canvas
        ref={canvasRef}
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          display: "block",
          maskImage: mask,
          WebkitMaskImage: mask,
          maskComposite: "intersect",
          WebkitMaskComposite: "source-in",
        }}
      />
    </>
  );
}

export const speedStreaks: Variant = {
  id: "speed-streaks",
  name: "Speed streaks",
  motion: "lively",
  reactive: "scroll",
  tech: "Canvas 2D",
  idea: "Sparse teal and blue light streaks (the odd magenta one) slide past behind the car at different depths, so it reads as driving forward; a scroll briefly puts its foot down.",
  Component: SpeedStreaks,
};
