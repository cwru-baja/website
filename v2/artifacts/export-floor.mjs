#!/usr/bin/env node
/**
 * Web images for the hero's showroom floor, from render-floor.py's 16-bit render.
 *
 *   node artifacts/export-floor.mjs
 *
 * Reads  artifacts/floor/final/floor-sr26-final-p2000.png   (5880x3900, straight RGBA)
 * Writes public/homepage-floor-sr26{,@2x}.webp                (1470 / 2940 wide)
 *        src/data/hero-floor.json                                  (where the floor sits relative to the car PNG)
 *
 * The page draws these with mix-blend-mode: screen, so they are exported OPAQUE:
 * premultiplied onto black (the render's holdout fade becomes black, which screen
 * leaves untouched). Opaque lossless WebP is the format because the floor is a
 * slow gradient a few levels above black, and every lossy encoder tried banded it
 * or lifted black: AVIF q92 4:4:4 lifted black by up to 6 levels and banded the
 * pool falloff; WebP q90 was worse. Lossless WebP decodes identical to PNG at half
 * the bytes.
 *
 * The floor is a still. An earlier version crossfaded this with a 1500 W render
 * so the pool "breathed"; the user dropped the animation.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "artifacts/floor/final");
const CAR_PX = [4200, 3000];                 // homepage-car-sr26.webp
const EXTEND = { L: 0.3, R: 0.1, T: 0, B: 0.3 }; // must match render-floor.py

async function premultiplied(path) {
  const { data, info } = await sharp(path).toColourspace("rgb16").raw({ depth: "ushort" }).toBuffer({ resolveWithObject: true });
  const bytes = new Uint8Array(data.length);
  bytes.set(data); // sharp's buffer can start at an odd offset; Uint16Array needs alignment
  const px = new Uint16Array(bytes.buffer);
  const out = new Float32Array(info.width * info.height * 3);
  for (let i = 0, j = 0; i < px.length; i += 4, j += 3) {
    const a = px[i + 3] / 65535;
    out[j] = (px[i] / 65535) * a * 255;
    out[j + 1] = (px[i + 1] / 65535) * a * 255;
    out[j + 2] = (px[i + 2] / 65535) * a * 255;
  }
  return { rgb: out, width: info.width, height: info.height };
}

/** Area-average downsample by an integer factor, over rows [y0, y1). */
function downsample({ rgb, width }, factor, y0, y1) {
  const w = Math.floor(width / factor), h = Math.floor((y1 - y0) / factor);
  const out = Buffer.alloc(w * h * 3);
  const n = factor * factor;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      for (let k = 0; k < 3; k++) {
        let s = 0;
        for (let dy = 0; dy < factor; dy++)
          for (let dx = 0; dx < factor; dx++) s += rgb[((y0 + y * factor + dy) * width + x * factor + dx) * 3 + k];
        out[(y * w + x) * 3 + k] = Math.max(0, Math.min(255, Math.round(s / n)));
      }
  return { buf: out, w, h };
}

const render = await premultiplied(join(SRC, "floor-sr26-final-p2000.png"));
const { width, height } = render;
if (width !== Math.round(CAR_PX[0] * (1 + EXTEND.L + EXTEND.R)) || height !== Math.round(CAR_PX[1] * (1 + EXTEND.T + EXTEND.B)))
  throw new Error(`unexpected render size ${width}x${height}; re-check EXTEND against render-floor.py`);

// Crop to the rows that carry any light, snapped to 4 px so the 1x and 2x crops agree.
let top = height, bottom = 0;
for (let y = 0; y < height; y++)
  for (let x = 0; x < width; x++) {
    const j = (y * width + x) * 3;
    if (render.rgb[j] > 0.25 || render.rgb[j + 1] > 0.25 || render.rgb[j + 2] > 0.25) {
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      break;
    }
  }
const y0 = Math.max(0, Math.floor((top - 8) / 4) * 4);
const y1 = Math.min(Math.floor(height / 4) * 4, Math.ceil((bottom + 9) / 4) * 4);

const written = {};
for (const [suffix, factor] of [["@2x", 2], ["", 4]]) {
  const { buf, w, h } = downsample(render, factor, y0, y1);
  const file = `public/homepage-floor-sr26${suffix}.webp`;
  const info = await sharp(buf, { raw: { width: w, height: h, channels: 3 } }).webp({ lossless: true, effort: 6 }).toFile(join(ROOT, file));
  written[file] = `${w}x${h}, ${Math.round(info.size / 1024)} KB`;
}

// Position in units of the car PNG's drawn box (0..1 across the car image).
const box = {
  left: -EXTEND.L,
  top: +(y0 / CAR_PX[1] - EXTEND.T).toFixed(5),
  width: +(width / CAR_PX[0]).toFixed(5),
  height: +((y1 - y0) / CAR_PX[1]).toFixed(5),
};
const previous = (() => { try { return readFileSync(join(ROOT, "src/data/hero-floor.json"), "utf8"); } catch { return null; } })();
const json = JSON.stringify({ _generated: "artifacts/export-floor.mjs - do not edit", ...box }, null, 2) + "\n";
writeFileSync(join(ROOT, "src/data/hero-floor.json"), json);
console.log(JSON.stringify({ crop: [y0, y1], box, written, jsonChanged: previous !== json }, null, 2));
