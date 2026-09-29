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

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ImageResponse } from "next/og.js";
import sharp from "sharp";
import { decompress } from "wawoff2";
import { CARS, CURRENT_CAR, CURRENT_THEME, SITE_BACKGROUND } from "../src/lib/livery.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const car = CARS[CURRENT_CAR];

// Facebook, LinkedIn, Discord and iMessage all crop toward 1.91:1.
const OG_W = 1200;
const OG_H = 630;
// A livery rule along the bottom edge, so the card reads as ours and not as a
// stray render. Scaled to survive the downscale to a timeline thumbnail.
const RULE_H = 7;
// The margin for the headline (top left) and the logo (bottom left). Keeps
// both clear of the crop platforms apply to the card's edges.
const TEXT_X = 76;
const TEXT_Y = 70;
// The hero's headline. Slack draws the card around 360px wide, where this is
// still ~36px tall.
const HEAD_SIZE = 120;
const LOGO_W = 260;
// The car sits on the right, clear of the headline and of the right edge.
const CAR_W = 640;
const CAR_RIGHT = 40;
// Low enough to clear the headline; the reflection runs off the bottom edge.
const CAR_DY = 25;

// The site's display faces ship as woff2. Satori reads only ttf, otf and
// woff, so they are unpacked here rather than keeping a second copy in the repo.
const loadFont = async (rel) =>
  Buffer.from(await decompress(readFileSync(path.join(root, "public/fonts", rel))));

// Satori takes React elements; this builds the same objects without JSX.
const el = (type, style, children, props = {}) => ({ type, props: { style, children, ...props } });

async function buildOg() {
  const fonts = [
    { name: "Coolvetica", data: await loadFont("coolvetica/Coolvetica-Bold.woff2"), weight: 700 },
    { name: "Brier", data: await loadFont("brier/Brier-Bold.woff2"), weight: 600 },
  ];

  // Downscaled before it goes in as a data URL: the renderer rasterises
  // Satori's SVG through libxml, which refuses a document past ~10 MB.
  const logo = await sharp(path.join(root, "public/logo/team/cwru-motorsports-teal-no-text-logo.png"))
    .resize({ width: LOGO_W * 2 })
    .png()
    .toBuffer();
  const { width: lw, height: lh } = await sharp(logo).metadata();
  const logoH = Math.round((lh / lw) * LOGO_W);

  // The words and the rule, on transparency. The car is composited under
  // them with sharp: inlined into Satori's SVG it hits that same size limit.
  const tree = el("div", { width: OG_W, height: OG_H, display: "flex", position: "relative" }, [
    // Matches the home page hero: Coolvetica over Brier, the second line
    // tucked up into the first.
    el(
      "div",
      { position: "absolute", left: TEXT_X, top: TEXT_Y, display: "flex", flexDirection: "column", lineHeight: 1 },
      [
        el("div", { fontFamily: "Coolvetica", fontWeight: 700, fontSize: HEAD_SIZE, color: "#fff" }, "BUILT"),
        el(
          "div",
          {
            fontFamily: "Brier",
            fontWeight: 600,
            fontSize: HEAD_SIZE,
            color: CURRENT_THEME.liveryPop,
            marginTop: -Math.round(HEAD_SIZE * 0.18),
          },
          "TO WIN.",
        ),
      ],
    ),
    el("img", { position: "absolute", left: TEXT_X, bottom: TEXT_Y, width: LOGO_W, height: logoH }, null, {
      src: `data:image/png;base64,${logo.toString("base64")}`,
      width: LOGO_W,
      height: logoH,
    }),
    el("div", {
      position: "absolute",
      left: 0,
      bottom: 0,
      width: OG_W,
      height: RULE_H,
      background: CURRENT_THEME.livery,
    }),
  ]);
  const words = Buffer.from(
    await new ImageResponse(tree, { width: OG_W, height: OG_H, fonts }).arrayBuffer(),
  );

  // The render carries a wide transparent margin; trimming first means the
  // placement below is measured against the car, not against empty pixels.
  const src = path.join(root, "src/assets", `homepage-car-${CURRENT_CAR}.webp`);
  const { width: srcW, height: srcH } = await sharp(src).metadata();
  const { data: trimmed, info: trim } = await sharp(src).trim().toBuffer({ resolveWithObject: true });
  const fitted = await sharp(trimmed).resize({ width: CAR_W }).toBuffer();
  const { height: fh } = await sharp(fitted).metadata();
  const carLeft = OG_W - CAR_W - CAR_RIGHT;
  const carTop = Math.round((OG_H - RULE_H - fh) / 2) + CAR_DY;

  // The floor is placed in units of the untrimmed render, as the hero does,
  // so this is that render's box on the card.
  const scale = CAR_W / trim.width;
  const full = {
    left: carLeft + trim.trimOffsetLeft * scale,
    top: carTop + trim.trimOffsetTop * scale,
    width: srcW * scale,
    height: srcH * scale,
  };

  await sharp({
    create: { width: OG_W, height: OG_H, channels: 4, background: SITE_BACKGROUND },
  })
    .composite([
      { ...(await showroomFloor(full)), blend: "screen" },
      { input: fitted, left: carLeft, top: carTop },
      { input: words, left: 0, top: 0 },
    ])
    .jpeg({ quality: 88, chromaSubsampling: "4:4:4" })
    .toFile(path.join(root, "public/og.jpg"));
}

// The hero's showroom floor (reflection, contact shadows, teal pool) for a car
// drawn at `full`, the untrimmed render's box. Mirrors FloorInCarBox in
// components/Hero.tsx: the same box from src/data/hero-floor.json, the same
// edge fades, drawn with `screen`. The fades are multiplied into the colour
// rather than put in alpha: screen over black is a no-op, so they are exact.
async function showroomFloor(full) {
  const box = JSON.parse(readFileSync(path.join(root, "src/data/hero-floor.json"), "utf8"));
  const x = Math.round(full.left + box.left * full.width);
  const y = Math.round(full.top + box.top * full.height);
  const w = Math.round(box.width * full.width);
  const h = Math.round(box.height * full.height);

  const { data } = await sharp(path.join(root, `public/homepage-floor-${CURRENT_CAR}@2x.webp`))
    .resize(w, h, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  // Hero.tsx: to right, transparent, black 6%, black 88%, transparent;
  // intersected with to bottom, black 62%, transparent.
  const ramp = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
  for (let py = 0; py < h; py++) {
    const v = 1 - ramp(py / h, 0.62, 1);
    for (let px = 0; px < w; px++) {
      const u = px / w;
      const m = v * Math.min(ramp(u, 0, 0.06), 1 - ramp(u, 0.88, 1));
      const i = (py * w + px) * 3;
      data[i] *= m;
      data[i + 1] *= m;
      data[i + 2] *= m;
    }
  }

  // It overhangs the card on the left and below; composite needs it inside.
  const left = Math.max(0, x);
  const top = Math.max(0, y);
  const input = await sharp(data, { raw: { width: w, height: h, channels: 3 } })
    .extract({
      left: left - x,
      top: top - y,
      width: Math.min(w - (left - x), OG_W - left),
      height: Math.min(h - (top - y), OG_H - top),
    })
    .png()
    .toBuffer();
  return { input, left, top };
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
