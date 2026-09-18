/**
 * Turns render-dash-screen.py's output into what the dash screen needs on the site.
 *
 *   node artifacts/export-dash-screen.mjs
 *
 * Reads artifacts/dash-screen/{agx-lut17.png, dash-texture.png, full-on.png,
 * full-off.png, geometry.json}. Writes:
 *
 *   public/renders-sr26/pong/agx-lut17.bin  the scene's view transform as a 17^3
 *       lookup, 8-bit, red fastest. Anything drawn on the screen goes through it.
 *   public/renders-sr26/pong/plate.webp     the frame with the screen off, only
 *       where the dash was lighting something (see plate() below).
 *   src/components/dashPong/screen.json     geometry, kernel, asset URLs (content-
 *       hashed: a replaced file in public/ otherwise serves stale).
 *
 * The model the site draws with is checked against the lossless full-frame render
 * before anything is written: the dash texture pushed through the homography, the
 * render's pixel filter and the LUT has to reproduce the screen. Colour is judged
 * on flat areas, softness on edges, and the extra blur on top of Cycles' own
 * 1.5px Blackman-Harris filter - the denoiser, which has no albedo to hold the
 * texture's edges against on a pure-emission surface - is fitted here, not guessed.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const SRC = "artifacts/dash-screen";
const OUT = "public/renders-sr26/pong";
const MANIFEST = "src/components/dashPong/screen.json";
const W = 1920, H = 1080;

const geo = JSON.parse(readFileSync(`${SRC}/geometry.json`, "utf8"));
const [TW, TH] = geo.texture;
const CORNERS = ["tl", "tr", "br", "bl"];

// ---- homography ------------------------------------------------------------
function solve(A, b) {
  const n = b.length, M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}
function homography(src, dst) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  return [...solve(A, b), 1];
}
const apply = (h, x, y) => {
  const w = h[6] * x + h[7] * y + h[8];
  return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w];
};
const quadFrame = CORNERS.map((k) => geo.quad[k].frame);
// Texture px, top-down, texel k's centre at k + 0.5. UVs run v-up and overshoot 0..1.
const quadTex = CORNERS.map((k) => [geo.quad[k].uv[0] * TW, (1 - geo.quad[k].uv[1]) * TH]);
const toTex = homography(quadFrame, quadTex);
const toFrame = homography(quadTex, quadFrame);
// Where the texture's own rectangle lands in the frame: the canvas stands in for the
// whole 480x272 image, so this - not the quad - is what the site maps it onto.
const textureFrame = [[0, 0], [TW, 0], [TW, TH], [0, TH]].map(([x, y]) => apply(toFrame, x, y));
const inQuad = (x, y) => {
  let s = 0;
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = quadFrame[i], [bx, by] = quadFrame[(i + 1) % 4];
    if ((bx - ax) * (y - ay) - (by - ay) * (x - ax) < 0) s++;
  }
  return s === 0 || s === 4;
};

// ---- images ------------------------------------------------------------------
async function load16(path) {
  const { data, info } = await sharp(path).toColourspace("rgb16").raw({ depth: "ushort" }).toBuffer({ resolveWithObject: true });
  const u = new Uint16Array(data.buffer, data.byteOffset, data.length / 2);
  const max = u.reduce((m, v) => (v > m ? v : m), 0) > 255 ? 65535 : 255; // sharp can hand 8-bit values back in a 16-bit buffer
  return { u, w: info.width, h: info.height, c: info.channels, max };
}
const [lutImg, on, off] = await Promise.all([
  load16(`${SRC}/agx-lut17.png`), load16(`${SRC}/full-on.png`), load16(`${SRC}/full-off.png`),
]);
const tex = await sharp(`${SRC}/dash-texture.png`).removeAlpha().raw().toBuffer();
const px = (img, x, y, c) => img.u[(y * img.w + x) * img.c + c] / img.max;

// ---- LUT ---------------------------------------------------------------------
const N = Math.round(Math.cbrt(lutImg.w * lutImg.h));
const lut = new Float32Array(N * N * N * 3);
for (let row = 0; row < N; row++) {
  for (let x = 0; x < N * N; x++) {
    const g = N - 1 - row, r = x % N, b = Math.floor(x / N); // PNG is top-down; Blender's rows run bottom-up
    for (let c = 0; c < 3; c++) lut[((b * N + g) * N + r) * 3 + c] = px(lutImg, x, row, c);
  }
}
function applyLut(r, g, b) {
  const f = (v) => Math.min(N - 1 - 1e-9, Math.max(0, v * (N - 1)));
  const fr = f(r), fg = f(g), fb = f(b), r0 = fr | 0, g0 = fg | 0, b0 = fb | 0;
  const dr = fr - r0, dg = fg - g0, db = fb - b0, out = [0, 0, 0];
  for (let i = 0; i < 8; i++) {
    const ir = i & 1, ig = (i >> 1) & 1, ib = (i >> 2) & 1;
    const w = (ir ? dr : 1 - dr) * (ig ? dg : 1 - dg) * (ib ? db : 1 - db);
    const k = (((b0 + ib) * N + (g0 + ig)) * N + (r0 + ir)) * 3;
    for (let c = 0; c < 3; c++) out[c] += w * lut[k + c];
  }
  return out;
}

// ---- the model: texture -> pixel filter in linear light -> LUT ----------------
const s2l = (s) => (s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4);
const l2s = (l) => (l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055);
const texel = (x, y, c) => { // bilinear with REPEAT, as the image node samples
  x -= 0.5; y -= 0.5;
  const x0 = Math.floor(x), y0 = Math.floor(y), dx = x - x0, dy = y - y0;
  const at = (i, j) => tex[((((j % TH) + TH) % TH) * TW + (((i % TW) + TW) % TW)) * 3 + c] / 255;
  return (at(x0, y0) * (1 - dx) + at(x0 + 1, y0) * dx) * (1 - dy) + (at(x0, y0 + 1) * (1 - dx) + at(x0 + 1, y0 + 1) * dx) * dy;
};
// Cycles' default pixel filter: Blackman-Harris over 1.5px, separable.
const FILTER_WIDTH = 1.5;
const bh = (t) => {
  if (Math.abs(t) > FILTER_WIDTH / 2) return 0;
  const x = (t + FILTER_WIDTH / 2) / FILTER_WIDTH;
  return 0.35875 - 0.48829 * Math.cos(2 * Math.PI * x) + 0.14128 * Math.cos(4 * Math.PI * x) - 0.01168 * Math.cos(6 * Math.PI * x);
};
function kernel(sigma, taps = 24) {
  const R = FILTER_WIDTH / 2 + 3 * sigma, o = [], w = [];
  for (let i = 0; i < taps; i++) {
    const t = -R + ((i + 0.5) * 2 * R) / taps;
    let v = 0;
    for (let s = -FILTER_WIDTH / 2; s <= FILTER_WIDTH / 2 + 1e-9; s += 0.025) {
      v += bh(s) * (sigma > 0 ? Math.exp(-((t - s) ** 2) / (2 * sigma * sigma)) : Math.abs(t - s) < 0.0125 ? 1 : 0);
    }
    o.push(t); w.push(v);
  }
  return { o, w };
}
function model(x, y, K) {
  const acc = [0, 0, 0];
  let sum = 0;
  for (let j = 0; j < K.o.length; j++) for (let i = 0; i < K.o.length; i++) {
    const w = K.w[i] * K.w[j];
    if (w <= 0) continue;
    const [u, v] = apply(toTex, x + 0.5 + K.o[i], y + 0.5 + K.o[j]);
    for (let c = 0; c < 3; c++) acc[c] += w * s2l(texel(u, v, c));
    sum += w;
  }
  return applyLut(...acc.map((a) => l2s(a / sum)));
}
const interior = (x, y) => [[0, 0], [-3, 0], [3, 0], [0, -3], [0, 3]].every(([a, b]) => inQuad(x + 0.5 + a, y + 0.5 + b));
const flat = (x, y) => [[-1, 0], [1, 0], [0, -1], [0, 1]].every(([a, b]) =>
  [0, 1, 2].every((c) => Math.abs(px(on, x + a, y + b, c) - px(on, x, y, c)) * 255 < 6));
const flatPx = [], edgePx = [];
const xs = quadFrame.map((p) => p[0]), ys = quadFrame.map((p) => p[1]);
for (let y = Math.floor(Math.min(...ys)); y < Math.ceil(Math.max(...ys)); y++) {
  for (let x = Math.floor(Math.min(...xs)); x < Math.ceil(Math.max(...xs)); x++) {
    if (!interior(x, y)) continue;
    (flat(x, y) ? flatPx : edgePx).push([x, y]);
  }
}
function rmse(points, K) {
  let se = 0, n = 0;
  for (const [x, y] of points) {
    const p = model(x, y, K);
    for (let c = 0; c < 3; c++) { const e = (p[c] - px(on, x, y, c)) * 255; se += e * e; n++; }
  }
  return Math.sqrt(se / n);
}
const edges = edgePx.filter((_, i) => i % 3 === 0), flats = flatPx.filter((_, i) => i % 7 === 0);
let best = null;
for (let sigma = 0.3; sigma <= 0.4501; sigma += 0.025) {
  const e = rmse(edges, kernel(sigma));
  if (!best || e < best.edge) best = { sigma: Math.round(sigma * 1000) / 1000, edge: e };
}
const flatErr = rmse(flats, kernel(best.sigma));
console.log(`model vs lossless render: flat ${flatErr.toFixed(2)}/255 (colour), edge ${best.edge.toFixed(2)}/255 at sigma ${best.sigma}px`);
if (flatErr > 1.5) throw new Error(`colour model is ${flatErr.toFixed(2)}/255 off on flat areas — LUT or texture changed?`);
if (best.edge > 4) throw new Error(`edge model is ${best.edge.toFixed(2)}/255 off — filter or denoiser changed?`);

// ---- plate -------------------------------------------------------------------
/**
 * The frame with the screen off, but only where turning it off changes anything.
 * Spill is on - off, max over channels, in display /255.
 *
 * Most of it is one block - the screen, its bezel and the LED cover - but the
 * dash also reflects in the top knob's glass rim (15/255), the nose deck above
 * the wheel (~10) and a 17px glint on the left cage tube (32). Those go dark
 * with the screen too, so they are kept. What is dropped is the scatter of
 * specks that never reach 3/255 anywhere: invisible, and keeping them would
 * stretch the plate over the whole frame.
 *
 * Alpha ramps from 0 at 1.2/255 to 1 at 2.5/255, is 1 over the screen, and gets
 * a grown-and-blurred skirt so its edge never lands on a visible step. The skirt
 * only ever adds: max(raw, skirt), so a strong isolated pixel keeps alpha 1
 * instead of being diluted by the blur and leaving its spill behind.
 */
const spill = new Float32Array(W * H);
for (let i = 0; i < W * H; i++) {
  let d = 0;
  for (let c = 0; c < 3; c++) d = Math.max(d, (on.u[i * on.c + c] / on.max - off.u[i * off.c + c] / off.max) * 255);
  spill[i] = d;
}
const screen = new Uint8Array(W * H);
let raw = new Float32Array(W * H);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = y * W + x;
  screen[i] = inQuad(x + 0.5, y + 0.5) ? 1 : 0;
  raw[i] = screen[i] ? 1 : Math.min(1, Math.max(0, (spill[i] - 1.2) / 1.3));
}
{ // keep only regions (joined across 3px gaps) that reach 3/255 somewhere
  const near = grow(raw, 3), label = new Int32Array(W * H).fill(-1), keep = [];
  for (let i = 0; i < W * H; i++) {
    if (near[i] <= 0 || label[i] >= 0) continue;
    const id = keep.length, stack = [i];
    let peak = 0, touchesScreen = false;
    label[i] = id;
    while (stack.length) {
      const j = stack.pop(), x = j % W, y = (j / W) | 0;
      peak = Math.max(peak, spill[j]); touchesScreen ||= screen[j] === 1;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const k = yy * W + xx;
        if (near[k] > 0 && label[k] < 0) { label[k] = id; stack.push(k); }
      }
    }
    keep.push(touchesScreen || peak >= 3);
  }
  for (let i = 0; i < W * H; i++) if (label[i] >= 0 && !keep[label[i]]) raw[i] = 0;
}
const skirt = blur(grow(raw, 4), 3);
let alpha = new Float32Array(W * H);
for (let i = 0; i < W * H; i++) alpha[i] = Math.max(raw[i], skirt[i]);
function grow(a, r) { // separable max filter
  const t = new Float32Array(a.length), o = new Float32Array(a.length);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let m = 0; for (let k = -r; k <= r; k++) { const xx = x + k; if (xx >= 0 && xx < W) m = Math.max(m, a[y * W + xx]); } t[y * W + x] = m; }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let m = 0; for (let k = -r; k <= r; k++) { const yy = y + k; if (yy >= 0 && yy < H) m = Math.max(m, t[yy * W + x]); } o[y * W + x] = m; }
  return o;
}
function blur(a, sigma) {
  const R = Math.ceil(sigma * 3), k = [];
  for (let i = -R; i <= R; i++) k.push(Math.exp(-(i * i) / (2 * sigma * sigma)));
  const s = k.reduce((p, q) => p + q, 0), t = new Float32Array(a.length), o = new Float32Array(a.length);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let v = 0; for (let i = -R; i <= R; i++) v += k[i + R] * a[y * W + Math.min(W - 1, Math.max(0, x + i))]; t[y * W + x] = v / s; }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let v = 0; for (let i = -R; i <= R; i++) v += k[i + R] * t[Math.min(H - 1, Math.max(0, y + i)) * W + x]; o[y * W + x] = v / s; }
  return o;
}
let x0 = W, y0 = H, x1 = -1, y1 = -1;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (alpha[y * W + x] > 1 / 255) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
const pw = x1 - x0 + 1, ph = y1 - y0 + 1;
const plate = Buffer.alloc(pw * ph * 4);
let residual = 0;
for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
  const i = (y + y0) * W + (x + x0), o = (y * pw + x) * 4;
  for (let c = 0; c < 3; c++) plate[o + c] = Math.round(px(off, x + x0, y + y0, c) * 255);
  plate[o + 3] = Math.round(alpha[i] * px(off, x + x0, y + y0, 3) * 255);
  residual = Math.max(residual, (1 - alpha[i]) * spill[i]);
}
for (let i = 0; i < W * H; i++) { // spill the plate's crop doesn't reach at all
  const x = i % W, y = (i / W) | 0;
  if (x < x0 || x > x1 || y < y0 || y > y1) residual = Math.max(residual, spill[i]);
}
console.log(`plate: ${pw}x${ph} at (${x0}, ${y0}); largest spill it leaves behind ${residual.toFixed(2)}/255`);

mkdirSync(OUT, { recursive: true });
const hash = (buf) => createHash("sha1").update(buf).digest("hex").slice(0, 8);
const lut8 = Buffer.from(lut.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255)));
writeFileSync(`${OUT}/agx-lut17.bin`, lut8);
const plateWebp = await sharp(plate, { raw: { width: pw, height: ph, channels: 4 } })
  .webp({ quality: 92, alphaQuality: 100, effort: 6, smartSubsample: true }).toBuffer();
writeFileSync(`${OUT}/plate.webp`, plateWebp);
console.log(`agx-lut17.bin ${lut8.length} B, plate.webp ${(plateWebp.length / 1024).toFixed(0)} KB`);

const round3 = (v) => Math.round(v * 1000) / 1000;
writeFileSync(MANIFEST, `${JSON.stringify({
  frame: { w: W, h: H },
  texture: { w: TW, h: TH },
  // Frame px (continuous; 0 = the frame's left edge). `quad` is the lit screen,
  // `textureCorners` where the whole 480x272 image would land - TL, TR, BR, BL.
  quad: quadFrame.map((p) => p.map(round3)),
  textureCorners: textureFrame.map((p) => p.map(round3)),
  kernel: { filter: "blackman-harris", width: FILTER_WIDTH, sigma: best.sigma },
  lut: { n: N, url: `/renders-sr26/pong/agx-lut17.bin?v=${hash(lut8)}` },
  plate: { x: x0, y: y0, w: pw, h: ph, url: `/renders-sr26/pong/plate.webp?v=${hash(plateWebp)}` },
  check: { flatRmse: round3(flatErr), edgeRmse: round3(best.edge), plateResidual: round3(residual) },
}, null, 2)}\n`);
console.log(`wrote ${MANIFEST}`);
