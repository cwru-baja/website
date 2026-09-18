/**
 * Feeds the wheel buttons on /car (src/components/dashPong/WheelButtons.tsx) and /lab/button.
 *
 *   node artifacts/export-button-press.mjs [--convert]
 *
 * --convert: turns the button-press crops from artifacts/render-dash-screen.py
 * (108x108 PNGs, one per button per travel step, with the dash screen on and off)
 * into lossless WebP: public/renders-sr26/press/ for screen-on, press/off/ for
 * screen-off. Without it, leaves the WebPs alone.
 *
 * Either way it rebuilds src/components/dashPong/sprites.json from the WebPs on disk:
 *   - a content hash per file, like the part mattes, because replacing a file in
 *     public/ otherwise serves stale;
 *   - each button's hit shape, measured off its rest sprite, so only the blue
 *     dome is clickable and the shape follows the sprites if they are re-rendered.
 *
 * The screen-off set is what the site shows while the dash is running the game:
 * the dash lights the corners of the crops nearest it by up to 35/255, which
 * would paste a lit square onto the screen-off plate.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const CONVERT = process.argv.includes("--convert");
const RENDERS = "artifacts/dash-screen";
const OUT = "public/renders-sr26/press";
const SETS = [
  { key: "on", src: `${RENDERS}/press-on`, dir: "" },
  { key: "off", src: `${RENDERS}/press-off`, dir: "off/" },
];

// Projected from the .blend through the final cockpit-dive camera
// (look_at(CEN - E0*0.62, CEN, E1), 43mm) — not measured by eye.
// x0/y0 is the crop's top-left in the 1920x1080 frame; cx/cy the dome centre.
const BUTTONS = [
  { i: 0, x0: 632,  y0: 352, cx: 685.9,  cy: 405.7 },
  { i: 1, x0: 1182, y0: 352, cx: 1235.7, cy: 406.0 },
  { i: 2, x0: 518,  y0: 368, cx: 572.0,  cy: 422.2 },
  { i: 3, x0: 1296, y0: 369, cx: 1349.6, cy: 422.6 },
  { i: 4, x0: 658,  y0: 475, cx: 712.2,  cy: 529.0 },
  { i: 5, x0: 1155, y0: 475, cx: 1209.4, cy: 529.1 },
  { i: 6, x0: 683,  y0: 650, cx: 737.0,  cy: 704.1 },
  { i: 7, x0: 1131, y0: 650, cx: 1184.6, cy: 704.1 },
];
const TRAVEL = [0, 0.5, 1.0, 1.5, 2.5];   // mm of dome descent
const SPRITE = 108;

const tagOf = (i, mm) => `b${i}-t${String(Math.round(mm * 10)).padStart(3, "0")}`;

if (CONVERT) {
  for (const set of SETS) {
    mkdirSync(`${OUT}/${set.dir}`, { recursive: true });
    for (const b of BUTTONS) {
      for (const mm of TRAVEL) {
        const tag = tagOf(b.i, mm);
        writeFileSync(`${OUT}/${set.dir}${tag}.webp`, await sharp(`${set.src}/${tag}.png`).webp({ lossless: true, effort: 6 }).toBuffer());
      }
    }
  }
}

/**
 * The visible blue disc on a rest sprite, as an axis-aligned ellipse in frame px.
 *
 * Keyed on colour (blue clearly above red and green) and limited to 32px from the
 * projected centre so the livery-blue cage tubes at a crop's edge can't join in.
 * The dome's edge is crisp: the fit moves by under 0.1px between thresholds of
 * 0.12 and 0.3, except that 0.12 picks up a stray on the bottom-left button.
 * Semi-axes come from the second moments along x and y (a filled ellipse has
 * variance a^2/4 along each axis), so antialiased edge pixels count once, not
 * as outliers. The discs are within ~1px of circular, so any rotation is noise;
 * the IoU against the blue pixels is the real check and stops the export if the
 * axis-aligned ellipse ever stops describing the dome.
 */
async function hitShape(b) {
  const { data, info } = await sharp(`${OUT}/${tagOf(b.i, 0)}.webp`).raw().toBuffer({ resolveWithObject: true });
  const ox = b.cx - b.x0, oy = b.cy - b.y0;
  const blue = new Uint8Array(info.width * info.height);
  let n = 0, sx = 0, sy = 0, sxx = 0, syy = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (Math.hypot(x - ox, y - oy) > 32) continue;
      const k = (y * info.width + x) * info.channels;
      const r = data[k] / 255, g = data[k + 1] / 255, bl = data[k + 2] / 255;
      if (!(bl > 0.2 && bl > r * 1.5 && bl > g * 1.1)) continue;
      blue[y * info.width + x] = 1;
      n++; sx += x; sy += y; sxx += x * x; syy += y * y;
    }
  }
  if (n < 1000) throw new Error(`button ${b.i}: only ${n} blue px on its rest sprite — wrong crop?`);
  const mx = sx / n, my = sy / n;
  const rx = 2 * Math.sqrt(sxx / n - mx * mx), ry = 2 * Math.sqrt(syy / n - my * my);
  let both = 0, either = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const inside = ((x - mx) / rx) ** 2 + ((y - my) / ry) ** 2 <= 1;
      const isBlue = blue[y * info.width + x] === 1;
      if (inside && isBlue) both++;
      if (inside || isBlue) either++;
    }
  }
  const iou = both / either;
  if (iou < 0.95) throw new Error(`button ${b.i}: hit ellipse only matches the blue at IoU ${iou.toFixed(3)}`);
  const round = (v) => Math.round(v * 10) / 10;
  return {
    // +0.5: pixel (x, y) covers [x, x+1), so its centre is x + 0.5
    cx: round(b.x0 + mx + 0.5), cy: round(b.y0 + my + 0.5),
    rx: round(rx), ry: round(ry),
    iou: Math.round(iou * 1000) / 1000,
  };
}

const files = {}, filesOff = {};
let bytes = 0;
for (const set of SETS) {
  for (const b of BUTTONS) {
    for (const mm of TRAVEL) {
      const tag = tagOf(b.i, mm);
      const webp = readFileSync(`${OUT}/${set.dir}${tag}.webp`);
      (set.key === "on" ? files : filesOff)[tag] = `${set.dir}${tag}.webp?v=${createHash("sha1").update(webp).digest("hex").slice(0, 8)}`;
      bytes += webp.length;
    }
  }
}
const buttons = [];
for (const b of BUTTONS) buttons.push({ ...b, hit: await hitShape(b) });

writeFileSync(
  "src/components/dashPong/sprites.json",
  `${JSON.stringify({ frame: { w: 1920, h: 1080 }, sprite: SPRITE, travel: TRAVEL, buttons, files, filesOff }, null, 2)}\n`,
);
console.log(`${Object.keys(files).length} sprites x 2 screens, ${(bytes / 1024).toFixed(0)} KB total`);
for (const { i, hit } of buttons) {
  console.log(`  b${i}  centre (${hit.cx}, ${hit.cy})  rx ${hit.rx}  ry ${hit.ry}  IoU vs blue ${hit.iou}`);
}
