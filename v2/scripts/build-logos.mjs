#!/usr/bin/env node
/**
 * Normalise sponsor logos.
 *
 *   node scripts/build-logos.mjs            # dry run, prints what would change
 *   node scripts/build-logos.mjs --write    # write trimmed assets + metrics
 *
 * Reads  public/logo/sponsor/{*.png,svg/*.svg}   (never modified)
 * Writes public/logo/sponsor/trimmed/{*.png,svg/*.svg}
 *        src/data/logo-metrics.json
 *
 * Two things happen here:
 *
 *  1. Trim. Every asset is cropped to its ink. SVGs get a rewritten viewBox
 *     (measured from a render, so strokes and filters are included -- getBBox()
 *     would miss those); PNGs get an extract() on their alpha bounding box.
 *
 *  2. Measure. Each trimmed asset's aspect ratio and ink coverage go into
 *     logo-metrics.json, which the sponsor components use to size logos by
 *     area instead of by height. See src/lib/logoSizing.ts.
 *
 * Two assets are "reverse" lockups -- a solid plate with the wordmark knocked
 * out as transparency. Under the site's `filter: brightness(0) invert(1)` the
 * plate paints white and the knockout shows the page through, so they render
 * as white blocks with black lettering. Both are repaired below before trimming.
 * Two more (online-carbide, tms-logo) print their lettering in an opaque colour
 * on a plate; see LUMA_KNOCKOUT.
 */
import sharp from "sharp";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "public/logo/sponsor");
const OUT = path.join(SRC, "trimmed");
const METRICS = path.join(ROOT, "src/data/logo-metrics.json");
const WRITE = process.argv.includes("--write");

const ALPHA = 0;      // a pixel counts as ink if alpha > this
const PAD_PX = 0.5;   // half a source pixel of guard, so antialiased edges survive the crop

/** Parker ships as a plate with `-Parker` knocked out. Subpath 6 is the plate;
 *  replacing it with just the leading dash turns the knockout into the wordmark. */
const PARKER_PLATE = "M0,0h460.64v176.83H0v-71.17h135.47v-21.07H0V0Z";
const PARKER_DASH = "M0,84.59h135.47v21.07H0Z";

/** Coloured lockups whose lettering is an opaque *colour* rather than
 *  transparency. The site's filter keeps only alpha, so the plate and the
 *  lettering on it merge into one white shape. Knocking out the lettering by
 *  luminance turns it into a real knockout.
 *    online-carbide: white tagline on a navy bar -> knock out the light pixels
 *    tms-logo:       dark type on a yellow hexagon -> knock out the dark pixels
 *  `lo`/`hi` are the luma ramp (0-1, Rec. 709 weights on sRGB values) across
 *  which ink fades out, so antialiased edges stay soft. */
const LUMA_KNOCKOUT = {
  "online-carbide": { knock: "light", lo: 0.45, hi: 0.85 },
  "tms-logo": { knock: "dark", lo: 0.3, hi: 0.6 },
};

/** Rasterise, backing off the density until we're under sharp's pixel limit. */
async function raster(input, resize) {
  let last;
  for (const density of [900, 600, 400, 200, 100, 72]) {
    for (const cap of [null, { width: 3000, fit: "inside" }, { width: 1200, fit: "inside" }]) {
      try {
        let p = sharp(input, { density, limitInputPixels: 4096 * 4096 });
        if (resize) p = p.resize(resize);
        else if (cap) p = p.resize(cap);
        return await p.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      } catch (e) { last = e; }
    }
  }
  throw last;
}

/** Tight ink box + coverage, measured on the alpha channel only.
 *  Alpha-only matters: several of these PNGs store junk RGB (rgb(71,112,76))
 *  under alpha 0, which an RGB-based trim would mistake for content. */
function inkBox(data, info) {
  const { width: W, height: H, channels: C } = info;
  let L = W, R = -1, T = H, B = -1, ink = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * C + 3] > ALPHA) {
        ink++;
        if (x < L) L = x; if (x > R) R = x;
        if (y < T) T = y; if (y > B) B = y;
      }
    }
  }
  if (R < 0) return null;
  const bw = R - L + 1, bh = B - T + 1;
  return { L, T, R, B, bw, bh, W, H, coverage: ink / (bw * bh) };
}

/** Classify the alpha channel.
 *
 *  "knockout" -- every border pixel is opaque AND a meaningful share of the
 *  interior is transparent: a solid plate with the artwork cut out of it.
 *  Inverting alpha recovers the artwork.
 *
 *  "opaque" -- every border pixel is opaque and there is no transparency at all
 *  (often a 3-channel PNG). There is no alpha to trim against, and under the
 *  site's invert filter it will paint as a solid block. Flagged, not repaired.
 *
 *  "alpha" -- ordinary transparent-background artwork. */
function classifyAlpha(data, info) {
  const { width: W, height: H, channels: C } = info;
  let borderOpaque = true;
  for (let x = 0; x < W && borderOpaque; x++)
    if (data[x * C + 3] < 250 || data[((H - 1) * W + x) * C + 3] < 250) borderOpaque = false;
  for (let y = 0; y < H && borderOpaque; y++)
    if (data[y * W * C + 3] < 250 || data[(y * W + W - 1) * C + 3] < 250) borderOpaque = false;
  if (!borderOpaque) return "alpha";
  let transparent = 0;
  for (let i = 0; i < W * H; i++) if (data[i * C + 3] < 128) transparent++;
  return transparent / (W * H) > 0.02 ? "knockout" : "opaque";
}

/** SVGs with live <text> render at the mercy of the visitor's installed fonts.
 *  Tightening the viewBox around text measured with *our* fonts means a browser
 *  that substitutes a wider face will overflow the viewBox and get clipped --
 *  and the generous untrimmed viewBox is the only thing preventing that today.
 *  Rasterising at high DPI removes the font dependency entirely. Four assets
 *  hit this: asi, automation-direct, kissoft, orange-vise. */
const RASTER_WIDTH = 1600;

async function rasteriseSvg(name, text) {
  const { data, info } = await raster(Buffer.from(text), { width: RASTER_WIDTH, fit: "inside" });
  const box = inkBox(data, info);
  if (!box) throw new Error("renders empty");
  const { width: W, height: H, channels: C } = info;
  const buf = Buffer.alloc(box.bw * box.bh * 4);
  for (let y = 0; y < box.bh; y++) {
    for (let x = 0; x < box.bw; x++) {
      const s = ((y + box.T) * W + (x + box.L)) * C, d = (y * box.bw + x) * 4;
      buf[d] = data[s]; buf[d + 1] = data[s + 1]; buf[d + 2] = data[s + 2]; buf[d + 3] = data[s + 3];
    }
  }
  const out = await sharp(buf, { raw: { width: box.bw, height: box.bh, channels: 4 } })
    .png({ compressionLevel: 9, effort: 10 }).toBuffer();
  return {
    out, ext: ".png", rasterized: true,
    before: `${W}x${H}`, after: `${box.bw}x${box.bh}`,
    heightUse: box.bh / H, aspect: box.bw / box.bh, coverage: box.coverage,
  };
}

async function doSvg(name, file) {
  let text = await fs.readFile(file, "utf8");
  let repaired = null;

  if (name === "parker") {
    if (!text.includes(PARKER_PLATE)) throw new Error("parker.svg: plate subpath not found -- asset changed, re-derive it");
    text = text.replace(PARKER_PLATE, PARKER_DASH);
    repaired = "removed knockout plate";
  }

  if (/<text[\s>]/.test(text)) {
    const r = await rasteriseSvg(name, text);
    return { ...r, repaired: repaired ?? "rasterised (contains live <text>)" };
  }

  const m = text.match(/viewBox\s*=\s*["']\s*([-\d.eE]+)[\s,]+([-\d.eE]+)[\s,]+([-\d.eE]+)[\s,]+([-\d.eE]+)\s*["']/);
  if (!m) throw new Error("no viewBox");
  const [vx, vy, vw, vh] = m.slice(1, 5).map(Number);

  const { data, info } = await raster(Buffer.from(text));
  const box = inkBox(data, info);
  if (!box) throw new Error("renders empty");

  const sx = vw / info.width, sy = vh / info.height;
  const nx = vx + (box.L - PAD_PX) * sx, ny = vy + (box.T - PAD_PX) * sy;
  const nw = (box.bw + 2 * PAD_PX) * sx, nh = (box.bh + 2 * PAD_PX) * sy;
  const r = (n) => Number(n.toFixed(4));

  // Drop width/height so the new viewBox alone governs the intrinsic size.
  const out = text
    .replace(m[0], `viewBox="${r(nx)} ${r(ny)} ${r(nw)} ${r(nh)}"`)
    .replace(/\s(width|height)\s*=\s*["'][^"']*["']/g, "");

  return {
    out: Buffer.from(out), ext: ".svg", repaired,
    before: `${r(vw)}x${r(vh)}`, after: `${r(nw)}x${r(nh)}`,
    heightUse: box.bh / info.height,
    aspect: nw / nh, coverage: box.coverage,
  };
}

async function doPng(name, file) {
  let img = sharp(file);
  let repaired = null;

  let { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const kind = classifyAlpha(data, info);
  if (kind === "opaque") {
    // Nothing to trim against and nothing safe to repair automatically.
    const box = { L: 0, T: 0, R: info.width - 1, B: info.height - 1, bw: info.width, bh: info.height, coverage: 1 };
    const out = await sharp(file).png({ compressionLevel: 9, effort: 10 }).toBuffer();
    return {
      out, ext: ".png", opaque: true,
      before: `${info.width}x${info.height}`, after: `${info.width}x${info.height}`,
      heightUse: 1, aspect: box.bw / box.bh, coverage: 1,
    };
  }
  if (kind === "knockout") {
    const { width: W, height: H, channels: C } = info;
    const flipped = Buffer.alloc(W * H * 4);
    for (let i = 0; i < W * H; i++) {
      flipped[i * 4] = 255; flipped[i * 4 + 1] = 255; flipped[i * 4 + 2] = 255;
      flipped[i * 4 + 3] = 255 - data[i * C + 3];
    }
    data = flipped;
    info = { width: W, height: H, channels: 4 };
    img = sharp(flipped, { raw: { width: W, height: H, channels: 4 } });
    repaired = "inverted alpha (knockout plate)";
  }
  const lk = LUMA_KNOCKOUT[name];
  if (lk) {
    const { width: W, height: H, channels: C } = info;
    const out = Buffer.alloc(W * H * 4);
    for (let i = 0; i < W * H; i++) {
      const r = data[i * C], g = data[i * C + 1], b = data[i * C + 2];
      const y = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      const t = Math.min(1, Math.max(0, (y - lk.lo) / (lk.hi - lk.lo)));
      const keep = lk.knock === "light" ? 1 - t : t;
      out[i * 4] = r; out[i * 4 + 1] = g; out[i * 4 + 2] = b;
      out[i * 4 + 3] = Math.round(data[i * C + 3] * keep);
    }
    data = out;
    info = { width: W, height: H, channels: 4 };
    img = sharp(out, { raw: { width: W, height: H, channels: 4 } });
    repaired = `knocked out ${lk.knock} lettering by luminance`;
  }

  const box = inkBox(data, info);
  if (!box) throw new Error("fully transparent");

  const L = Math.max(0, box.L - 1), T = Math.max(0, box.T - 1);
  const width = Math.min(info.width, box.R + 2) - L;
  const height = Math.min(info.height, box.B + 2) - T;

  const out = await img
    .extract({ left: L, top: T, width, height })
    .png({ compressionLevel: 9, effort: 10 })
    .toBuffer();

  return {
    out, ext: ".png", repaired,
    before: `${info.width}x${info.height}`, after: `${width}x${height}`,
    heightUse: box.bh / info.height,
    aspect: width / height, coverage: box.coverage,
  };
}

const metrics = {};
const rows = [];

for (const [dir, outDir, kind] of [
  [SRC, OUT, "png"],
  [path.join(SRC, "svg"), path.join(OUT, "svg"), "svg"],
]) {
  if (WRITE) await fs.mkdir(outDir, { recursive: true });
  for (const f of (await fs.readdir(dir)).sort()) {
    const ext = path.extname(f).toLowerCase();
    if (kind === "png" ? ext !== ".png" : ext !== ".svg") continue;
    const name = path.basename(f, ext);
    const file = path.join(dir, f);
    try {
      const r = kind === "svg" ? await doSvg(name, file) : await doPng(name, file);
      // A rasterised SVG lands next to the PNGs, not in trimmed/svg/.
      const dest = r.rasterized ? OUT : outDir;
      if (WRITE) { await fs.mkdir(dest, { recursive: true }); await fs.writeFile(path.join(dest, name + r.ext), r.out); }
      metrics[name] = {
        aspect: Number(r.aspect.toFixed(4)),
        coverage: Number(r.coverage.toFixed(4)),
        ...(r.rasterized ? { rasterized: true } : {}),
        ...(r.opaque ? { opaqueBackground: true } : {}),
      };
      rows.push({ name, kind, ...r });
    } catch (e) {
      const hint = /pixel limit/.test(e.message)
        ? "declared canvas is enormous and the artwork sits outside it -- asset is broken at source"
        : e.message;
      rows.push({ name, kind, error: hint });
    }
  }
}

const trimmed = rows.filter((r) => !r.error && r.heightUse < 0.99).sort((a, b) => a.heightUse - b.heightUse);
const failed = rows.filter((r) => r.error);
const repaired = rows.filter((r) => r.repaired);

for (const r of repaired) console.log(`REPAIR  ${r.name.padEnd(32)} ${r.repaired}`);
if (repaired.length) console.log();
console.log(`Trimmed ${trimmed.length} of ${rows.length - failed.length} assets (rest were already tight):`);
for (const r of trimmed.slice(0, 20)) {
  console.log(`  ${r.name.padEnd(32)} ${r.before.padEnd(14)} -> ${r.after.padEnd(14)} ink filled ${(100 * r.heightUse).toFixed(0)}% of canvas height`);
}
if (trimmed.length > 20) console.log(`  ... and ${trimmed.length - 20} more`);
const opaque = rows.filter((r) => r.opaque);
if (opaque.length) {
  console.log(`\n${opaque.length} asset(s) have a fully opaque background -- they will paint as a solid`);
  console.log(`block under filter: brightness(0) invert(1). Trimming cannot fix these:`);
  for (const r of opaque) console.log(`  ${r.name}`);
}
if (failed.length) {
  console.log(`\n${failed.length} failed:`);
  for (const r of failed) console.log(`  ${r.name.padEnd(32)} ${r.error}`);
}

if (WRITE) {
  await fs.mkdir(path.dirname(METRICS), { recursive: true });
  await fs.writeFile(METRICS, JSON.stringify(metrics, null, 2) + "\n");
  console.log(`\nWrote ${Object.keys(metrics).length} metrics -> ${path.relative(ROOT, METRICS)}`);
  console.log(`Wrote trimmed assets    -> ${path.relative(ROOT, OUT)}`);
} else {
  console.log("\nDry run. Re-run with --write to apply.");
}
