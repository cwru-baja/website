#!/usr/bin/env node
/**
 * Encodes the phone (portrait) /car frames from their lossless masters.
 *
 *   node artifacts/export-portrait-frames.mjs
 *
 * Reads  artifacts/masters/portrait/k070/{full,layers,layers/brake-arc}/*.png
 *        (1080x1350 RGBA, from artifacts/portrait-plan.py STAGE="render",
 *        QUALITY="final", MASTER="png"; git-ignored)
 * Writes public/renders-sr26/portrait/<same path>.webp
 *
 * WebP, not AVIF: every phone that gets this set runs WebKit or Chrome, and
 * Safari decodes these frames faster as WebP (see FrameFormat in
 * carSequenceModel.ts). Quality 75 with the alpha channel kept lossless, at the
 * encoder's slowest, smallest setting. Measured 2026-09-18 on 30 final frames of
 * the brake arc against their masters on the page background #0a0a0a:
 *   today's recipe (Blender WebP q80, alpha lossless)  113.7 KB/frame  VMAF 99.58
 *   this (q75, effort 6, alpha lossless)                 95.7 KB/frame
 * The opaque equivalent measured VMAF 99.38 at q75. Keeping the alpha channel
 * was the owner's call (2026-09-18): it keeps every blur-and-fade reveal exactly
 * as on desktop. Baking the page background in instead would save its ~32 KB a
 * frame (about 36% at q80) with no visible change outside those reveals.
 *
 * Anything under public/renders-sr26/portrait/{full,layers} that no master
 * produced is removed, so stand-ins never ship. mattes/ is left alone (see
 * artifacts/export-part-mattes.mjs portrait).
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const MASTERS = path.join(ROOT, "artifacts/masters/portrait/k070");
const OUT = path.join(ROOT, "public/renders-sr26/portrait");
const WEBP = { quality: 75, alphaQuality: 100, effort: 6 };

const masters = ["full", "layers", "layers/brake-arc"].flatMap((dir) =>
  fs.existsSync(path.join(MASTERS, dir))
    ? fs
        .readdirSync(path.join(MASTERS, dir))
        .filter((file) => file.endsWith(".png"))
        .map((file) => path.join(dir, file))
    : [],
);
if (!masters.length) {
  console.error(`No masters under ${MASTERS}. Render them first (portrait-plan.py STAGE="render", MASTER="png").`);
  process.exit(1);
}

const written = new Set();
let bytes = 0;
let largest = 0;
for (const [index, rel] of masters.entries()) {
  const out = path.join(OUT, rel.replace(/\.png$/, ".webp"));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const { width, height } = await sharp(path.join(MASTERS, rel)).metadata();
  if (width !== 1080 || height !== 1350) throw new Error(`${rel} is ${width}x${height}, not 1080x1350`);
  const info = await sharp(path.join(MASTERS, rel)).webp(WEBP).toFile(out);
  written.add(out);
  bytes += info.size;
  largest = Math.max(largest, info.size);
  if ((index + 1) % 50 === 0) console.log(`${index + 1}/${masters.length}`);
}

let removed = 0;
for (const dir of ["full", "layers", "layers/brake-arc"]) {
  const abs = path.join(OUT, dir);
  if (!fs.existsSync(abs)) continue;
  for (const file of fs.readdirSync(abs)) {
    const full = path.join(abs, file);
    if (fs.statSync(full).isFile() && !written.has(full)) {
      fs.rmSync(full);
      removed += 1;
    }
  }
}

console.log(
  `${masters.length} frames, ${(bytes / 1024 / 1024).toFixed(2)} MB, ` +
    `mean ${(bytes / masters.length / 1024).toFixed(1)} KB, largest ${(largest / 1024).toFixed(1)} KB; ` +
    `removed ${removed} stale files`,
);
