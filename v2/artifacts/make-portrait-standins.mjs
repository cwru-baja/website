#!/usr/bin/env node
/**
 * Stand-in portrait frames for building and testing the phone /car sequence
 * before the real 4:5 renders exist.
 *
 *   node artifacts/make-portrait-standins.mjs          # QUALITY=60 by default
 *
 * Center-crops every file the page actually plays - the painted orbit frames
 * (orbitFrameSet), every layer the sequence plays (warmLayerUrls) and every part
 * mask - from the landscape set to 4:5 at full height (864x1080), and writes
 * them under public/renders-sr26/portrait/ with the same names. The lists come
 * from carSequenceModel.ts itself, so the stand-ins can't drift from what the
 * page requests.
 *
 * A plain center crop, not a reframing: it is only here so the loader, the
 * streaming and the layout can be measured against files of a realistic size
 * (~70 KB a full frame). The crop is not framed for the car, so seams and label
 * positions mean nothing in it. public/renders-sr26/portrait/ is gitignored; the
 * real renders replace it.
 */

import { mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import {
  CAR_EXCURSION,
  frameUrl,
  matteUrl,
  orbitFrameSet,
  warmLayerUrls,
} from "../src/components/carSequenceModel.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = join(ROOT, "public");
const QUALITY = Number(process.env.QUALITY ?? 60);
const mattes = JSON.parse(
  readFileSync(join(ROOT, "src/data/car-part-mattes.json"), "utf8"),
);

/** [landscape url, portrait url, lossless] for every file the page plays. */
const jobs = [];
for (const index of orbitFrameSet(CAR_EXCURSION)) {
  jobs.push([frameUrl("landscape", index), frameUrl("portrait", index), false]);
}
const wide = warmLayerUrls("landscape");
const tall = warmLayerUrls("portrait");
wide.forEach((url, index) => jobs.push([url, tall[index], false]));
for (const [chapterId, parts] of Object.entries(mattes)) {
  if (chapterId.startsWith("_")) continue;
  for (const file of Object.values(parts)) {
    const name = file.split("?")[0];
    // Masks are read for their alpha only, and a lossy edge would shift the
    // cut-out off the part - same as export-part-mattes.mjs.
    jobs.push([matteUrl("landscape", chapterId, name), matteUrl("portrait", chapterId, name), true]);
  }
}

const seen = new Set();
let bytes = { frame: 0, frames: 0, matte: 0, mattes: 0 };
for (const [from, to, lossless] of jobs) {
  if (seen.has(to)) continue;
  seen.add(to);
  const source = join(PUBLIC, from);
  const target = join(PUBLIC, to);
  const { width, height } = await sharp(source).metadata();
  const cropWidth = Math.round((height * 4) / 5);
  mkdirSync(dirname(target), { recursive: true });
  await sharp(source)
    .extract({ left: Math.round((width - cropWidth) / 2), top: 0, width: cropWidth, height })
    .webp(lossless ? { lossless: true } : { quality: QUALITY, effort: 5 })
    .toFile(target);
  const size = statSync(target).size;
  if (lossless) {
    bytes.matte += size;
    bytes.mattes += 1;
  } else {
    bytes.frame += size;
    bytes.frames += 1;
  }
}

const kb = (value) => `${(value / 1024).toFixed(1)} KB`;
console.log(
  `${bytes.frames} frames, ${kb(bytes.frame / bytes.frames)} each on average, ` +
    `${(bytes.frame / 1024 / 1024).toFixed(1)} MB; ${bytes.mattes} masks, ${kb(bytes.matte)}`,
);
console.log(`-> ${join("public", "renders-sr26", "portrait")}`);
