// Generates the two brand assets that have to exist as plain files:
//
//   public/og.jpg      the link-preview card. Every social platform fetches a
//                      real image URL, so it cannot be the SVG /icon route.
//   src/app/favicon.ico  bare /favicon.ico requests (crawlers, link unfurlers,
//                      older browsers) never read <link rel="icon">, so the
//                      app/icon.tsx SVG alone leaves them with a 404. It lives
//                      under app/ rather than public/ because that is Next's
//                      file convention: the route and the <link> come free.
//
// Both take their colour from src/lib/livery.ts, so flipping CURRENT_CAR and
// re-running this keeps them in step with the site. They are committed, not
// built by `next build`: rerun `npm run brand-assets` when the car or its
// render changes, or they silently keep showing the old car.
//
// Run: npm run brand-assets

import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { CARS, CURRENT_CAR, CURRENT_THEME, SITE_BACKGROUND } from "../src/lib/livery.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const car = CARS[CURRENT_CAR];

// Facebook, LinkedIn, Discord and iMessage all crop toward 1.91:1.
const OG_W = 1200;
const OG_H = 630;
// Keeps the car clear of the crop platforms apply to the card's edges.
const OG_INSET_X = 64;
const OG_INSET_Y = 34;
// A livery rule along the bottom edge, so the card reads as ours and not as a
// stray render. Scaled to survive the downscale to a timeline thumbnail.
const RULE_H = 7;

async function buildOg() {
  const src = path.join(root, "src/assets", `homepage-car-${CURRENT_CAR}.webp`);
  // The render carries a wide transparent margin; trimming first means the
  // inset below is measured against the car, not against empty pixels.
  const trimmed = await sharp(src).trim().toBuffer();
  const fitted = await sharp(trimmed)
    .resize({
      width: OG_W - OG_INSET_X * 2,
      height: OG_H - OG_INSET_Y * 2 - RULE_H,
      fit: "inside",
      withoutEnlargement: true,
    })
    .toBuffer();
  const { width: fw, height: fh } = await sharp(fitted).metadata();

  const rule = await sharp({
    create: { width: OG_W, height: RULE_H, channels: 4, background: CURRENT_THEME.livery },
  })
    .png()
    .toBuffer();

  await sharp({
    create: { width: OG_W, height: OG_H, channels: 4, background: SITE_BACKGROUND },
  })
    .composite([
      // Centred by hand: passing gravity alongside top/left is ignored, and a
      // left of 0 pins the car to the edge with the card's whole right half
      // empty. Optically centred, so the car sits a few pixels above the
      // middle rather than reading as crowded by the rule.
      {
        input: fitted,
        left: Math.round((OG_W - fw) / 2),
        top: Math.round((OG_H - RULE_H - fh) / 2) - 8,
      },
      { input: rule, top: OG_H - RULE_H, left: 0 },
    ])
    .jpeg({ quality: 88, chromaSubsampling: "4:4:4" })
    .toFile(path.join(root, "public/og.jpg"));
}

// The same M as app/icon.tsx. Duplicated rather than imported because that
// module is a route handler returning a Response; keep the two in sync.
const iconSvg = (fill) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 86 86" width="512" height="512">
  <g fill="${fill}">
    <polygon points="86,26 73,26 53.5,59.8 66.4,59.8"/>
    <polygon points="33.9,59.8 47,59.8 66.5,26 53.4,26"/>
    <polygon points="27.3,37.3 14.3,59.8 27.3,59.8 46.9,26 0,26"/>
  </g>
</svg>`;

// .ico is a container: a 6-byte header, one 16-byte directory entry per size,
// then the images. Every browser that still asks for /favicon.ico accepts PNG
// payloads, so the frames are PNGs rather than raw DIBs.
function packIco(frames) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = icon
  header.writeUInt16LE(frames.length, 4);

  const dir = Buffer.alloc(16 * frames.length);
  let offset = header.length + dir.length;
  frames.forEach(({ size, png }, i) => {
    const e = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, e); // 0 means 256
    dir.writeUInt8(size >= 256 ? 0 : size, e + 1);
    dir.writeUInt8(0, e + 2); // palette size, 0 for truecolour
    dir.writeUInt8(0, e + 3); // reserved
    dir.writeUInt16LE(1, e + 4); // colour planes
    dir.writeUInt16LE(32, e + 6); // bits per pixel
    dir.writeUInt32LE(png.length, e + 8);
    dir.writeUInt32LE(offset, e + 12);
    offset += png.length;
  });

  return Buffer.concat([header, dir, ...frames.map((f) => f.png)]);
}

async function buildFavicon() {
  const svg = Buffer.from(iconSvg(CURRENT_THEME.livery));
  // The M is drawn on transparency, as in the tab icon: a browser that shows
  // favicons on a light chrome then gets the mark, not a black tile.
  const frames = await Promise.all(
    [16, 32, 48].map(async (size) => ({
      size,
      png: await sharp(svg, { density: 384 })
        .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer(),
    })),
  );
  writeFileSync(path.join(root, "src/app/favicon.ico"), packIco(frames));
}

await buildOg();
await buildFavicon();
console.log(`brand assets rebuilt for ${car.name} (${CURRENT_THEME.livery}): public/og.jpg, src/app/favicon.ico`);
