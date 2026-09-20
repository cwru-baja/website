#!/usr/bin/env node
/**
 * Web masks for the /car hover highlight, from render-part-mattes.py's mattes.
 *
 *   node artifacts/export-part-mattes.mjs            the desktop set
 *   node artifacts/export-part-mattes.mjs portrait   the phone set
 *
 * Reads  artifacts/part-mattes/<pause>/<part>.png   (1920x1080, coverage in alpha)
 * Writes public/renders-sr26/mattes/<pause>/<part>.webp
 *        src/data/car-part-mattes.json               (which parts each pause has)
 *
 * With "portrait" it reads artifacts/part-mattes-portrait/ (1080x1350), writes
 * public/renders-sr26/portrait/mattes/ and src/data/car-part-mattes-portrait.json,
 * so each set's masks carry their own content hashes.
 *
 * The site only uses a mask's alpha (CSS mask-image in alpha mode), so the colour
 * is dropped to flat white and the file is lossless WebP: a lossy edge would
 * shift the cut-out off the part. The manifest carries a content hash per mask,
 * because replacing a file in public/ is otherwise served stale.
 */

import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORTRAIT = process.argv[2] === "portrait";
const SRC = join(ROOT, PORTRAIT ? "artifacts/part-mattes-portrait" : "artifacts/part-mattes");
const OUT = join(ROOT, PORTRAIT ? "public/renders-sr26/portrait/mattes" : "public/renders-sr26/mattes");
const MANIFEST = join(ROOT, PORTRAIT ? "src/data/car-part-mattes-portrait.json" : "src/data/car-part-mattes.json");

const manifest = {
  _generated: `artifacts/export-part-mattes.mjs${PORTRAIT ? " portrait" : ""} - do not edit`,
};

for (const pause of readdirSync(SRC).sort()) {
  const parts = readdirSync(join(SRC, pause))
    .filter((file) => file.endsWith(".png") && file !== "check.png")
    .map((file) => file.slice(0, -4))
    .sort();
  if (!parts.length) continue;
  mkdirSync(join(OUT, pause), { recursive: true });
  manifest[pause] = {};

  for (const part of parts) {
    const alpha = await sharp(join(SRC, pause, `${part}.png`))
      .extractChannel(3)
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { width, height } = alpha.info;
    const webp = await sharp({
      create: { width, height, channels: 3, background: "#ffffff" },
    })
      .joinChannel(alpha.data, { raw: { width, height, channels: 1 } })
      .webp({ lossless: true, effort: 6 })
      .toBuffer();
    writeFileSync(join(OUT, pause, `${part}.webp`), webp);
    const hash = createHash("sha1").update(webp).digest("hex").slice(0, 8);
    manifest[pause][part] = `${part}.webp?v=${hash}`;
    console.log(`${pause}/${part}.webp  ${(webp.length / 1024).toFixed(1)} KB`);
  }
}

writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`wrote ${MANIFEST}`);
