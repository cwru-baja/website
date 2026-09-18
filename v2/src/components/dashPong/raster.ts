// Draws flat-colour rectangles on the dash screen the way Cycles drew the dash
// texture there, so the game reads as part of the render instead of a sticker.
//
// The chain is measured, not styled (artifacts/export-dash-screen.mjs checks it
// against a lossless render: 0.45/255 on flat colour, 1.35/255 on edges):
//   texture colour -> linear light -> the texture's bilinear lookup
//   -> Cycles' 1.5px Blackman-Harris pixel filter -> the denoiser's extra blur
//   -> the scene's view transform (AgX, +0.29 stops) as a 17^3 LUT.
// Order matters: Cycles filters light, then tone-maps. Blurring display values
// instead leaves every edge visibly darker than the dash's own.
//
// Everything here is axis-aligned boxes (paddles, ball, net, blocky digits), and
// a box convolved with a separable kernel has a closed form - a product of two
// differences of the kernel's CDF - so each pixel's coverage is exact and cheap.

import screen from "./screen.json";

/** A colour as the dash texture would store it: sRGB, 0..1 per channel. */
export type Rgb = readonly [number, number, number];
/** A box in texture px (the panel's native 480x272), top-left origin. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  color: Rgb;
}

export const TEXTURE = screen.texture;
const [TL, TR, BR, BL] = screen.textureCorners;
/**
 * The canvas is the texture at the frame's own pixel density, so the page scales
 * it exactly as it scales the still around it and the kernel stays in frame px.
 * The screen is foreshortened, so that density differs between the axes.
 */
export const CANVAS = {
  w: Math.round((TR[0] - TL[0] + (BR[0] - BL[0])) / 2),
  h: Math.round((BL[1] - TL[1] + (BR[1] - TR[1])) / 2),
};
const SX = CANVAS.w / TEXTURE.w;
const SY = CANVAS.h / TEXTURE.h;

const s2l = (s: number) => (s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4);
const l2s = (l: number) => (l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055);

/**
 * CDF of the effective 1D kernel, in canvas px: Blackman-Harris over the filter
 * width, convolved with the fitted Gaussian and with a tent one texel wide (the
 * bilinear lookup that softens every texture edge before the filter sees it).
 */
function kernelCdf(texel: number) {
  const STEP = 1 / 64;
  const { width, sigma } = screen.kernel;
  const sample = (half: number, f: (t: number) => number) => {
    const n = Math.max(1, Math.round(half / STEP));
    return Array.from({ length: 2 * n + 1 }, (_, i) => f((i - n) * STEP));
  };
  const bh = sample(width / 2, (t) => {
    const x = (t + width / 2) / width;
    return 0.35875 - 0.48829 * Math.cos(2 * Math.PI * x) + 0.14128 * Math.cos(4 * Math.PI * x) - 0.01168 * Math.cos(6 * Math.PI * x);
  });
  const gauss = sigma > 0 ? sample(4 * sigma, (t) => Math.exp(-(t * t) / (2 * sigma * sigma))) : [1];
  const tent = sample(texel, (t) => Math.max(0, 1 - Math.abs(t) / texel));
  const conv = (a: number[], b: number[]) => {
    const out = new Array(a.length + b.length - 1).fill(0);
    for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) out[i + j] += a[i] * b[j];
    return out;
  };
  const k = conv(conv(bh, gauss), tent);
  const total = k.reduce((s, v) => s + v, 0);
  const cdf = new Float32Array(k.length);
  let acc = 0;
  for (let i = 0; i < k.length; i++) {
    acc += k[i] / total;
    cdf[i] = acc;
  }
  const radius = ((k.length - 1) / 2) * STEP;
  return {
    radius,
    at(x: number) {
      if (x <= -radius) return 0;
      if (x >= radius) return 1;
      const f = (x + radius) / STEP;
      const i = Math.floor(f);
      return cdf[i] + (cdf[Math.min(i + 1, cdf.length - 1)] - cdf[i]) * (f - i);
    },
  };
}

export interface Raster {
  /** RGBA, CANVAS.w x CANVAS.h. Transparent wherever nothing is lit, so the screen-off plate shows. */
  readonly pixels: Uint8ClampedArray;
  draw(rects: readonly Rect[]): void;
}

/** `lut`: the exporter's agx-lut17.bin - n^3 RGB bytes, red fastest, sRGB in and out. */
export function createRaster(lut: Uint8Array, n = screen.lut.n): Raster {
  if (lut.length !== n * n * n * 3) throw new Error(`LUT has ${lut.length} bytes, expected ${n * n * n * 3}`);
  const kx = kernelCdf(SX);
  const ky = kernelCdf(SY);
  const W = CANVAS.w, H = CANVAS.h;
  const light = new Float32Array(W * H * 3);
  const pixels = new Uint8ClampedArray(W * H * 4);
  let dirty: [number, number, number, number][] = [];

  const toneMap = (r: number, g: number, b: number, out: Uint8ClampedArray, o: number) => {
    const f = (v: number) => Math.min(n - 1 - 1e-6, Math.max(0, l2s(Math.min(1, v)) * (n - 1)));
    const fr = f(r), fg = f(g), fb = f(b);
    const r0 = fr | 0, g0 = fg | 0, b0 = fb | 0, dr = fr - r0, dg = fg - g0, db = fb - b0;
    let R = 0, G = 0, B = 0;
    for (let i = 0; i < 8; i++) {
      const ir = i & 1, ig = (i >> 1) & 1, ib = (i >> 2) & 1;
      const w = (ir ? dr : 1 - dr) * (ig ? dg : 1 - dg) * (ib ? db : 1 - db);
      const k = (((b0 + ib) * n + (g0 + ig)) * n + (r0 + ir)) * 3;
      R += w * lut[k]; G += w * lut[k + 1]; B += w * lut[k + 2];
    }
    out[o] = R; out[o + 1] = G; out[o + 2] = B; out[o + 3] = 255;
  };

  return {
    pixels,
    draw(rects) {
      for (const [x0, y0, x1, y1] of dirty) {
        for (let y = y0; y < y1; y++) {
          light.fill(0, (y * W + x0) * 3, (y * W + x1) * 3);
          pixels.fill(0, (y * W + x0) * 4, (y * W + x1) * 4);
        }
      }
      dirty = [];
      for (const r of rects) {
        const X0 = r.x * SX, X1 = (r.x + r.w) * SX, Y0 = r.y * SY, Y1 = (r.y + r.h) * SY;
        const i0 = Math.max(0, Math.floor(X0 - kx.radius)), i1 = Math.min(W, Math.ceil(X1 + kx.radius));
        const j0 = Math.max(0, Math.floor(Y0 - ky.radius)), j1 = Math.min(H, Math.ceil(Y1 + ky.radius));
        if (i0 >= i1 || j0 >= j1) continue;
        const lin = [s2l(r.color[0]), s2l(r.color[1]), s2l(r.color[2])];
        const wx = new Float32Array(i1 - i0);
        for (let i = i0; i < i1; i++) wx[i - i0] = kx.at(X1 - (i + 0.5)) - kx.at(X0 - (i + 0.5));
        for (let j = j0; j < j1; j++) {
          const wy = ky.at(Y1 - (j + 0.5)) - ky.at(Y0 - (j + 0.5));
          if (wy <= 0) continue;
          for (let i = i0; i < i1; i++) {
            const c = wx[i - i0] * wy;
            if (c <= 0) continue;
            const o = (j * W + i) * 3;
            light[o] += c * lin[0]; light[o + 1] += c * lin[1]; light[o + 2] += c * lin[2];
          }
        }
        dirty.push([i0, j0, i1, j1]);
      }
      for (const [x0, y0, x1, y1] of dirty) {
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const o = (y * W + x) * 3;
            const r = light[o], g = light[o + 1], b = light[o + 2];
            if (r < 1e-6 && g < 1e-6 && b < 1e-6) continue;
            toneMap(r, g, b, pixels, (y * W + x) * 4);
          }
        }
      }
    },
  };
}

/** "#26B0BD" -> sRGB 0..1. */
export const hexRgb = (hex: string): Rgb => {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as unknown as Rgb;
};
