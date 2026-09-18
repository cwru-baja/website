// Encodes the /car desktop frames to AVIF from lossless masters, beside the
// WebP files the site already ships (which stay as the fallback for Safari and
// for browsers without AVIF).
//
// Masters come from the render scripts run with MASTER="png" into
// artifacts/masters/landscape/{full,layers,layers/brake-arc}/ (git-ignored).
// Each frame is written to public/renders-sr26/<same path>.avif.
//
// Settings (measured 2026-09-18 on lossless orbit renders, scored over the page
// background #0a0a0a): 8-bit 4:4:4, libaom tune=iq on colour, speed 4, q55,
// alpha q95. q55 was the lowest quality that beat the shipped WebP on SSIM, PSNR
// and VMAF at once; 4:4:4 held the livery's colour edges better than 4:2:0 at the
// same size; 10-bit was no smaller here and decodes slower in Chrome. Alpha must
// be set on its own: left alone it follows the colour quality and misses the
// master by up to 44/255, while q95 misses by 4 or less bar a stray edge pixel.
//
// Every frame is gated, colour and alpha separately. Colour: the AVIF must score
// at least as well as the shipped WebP against the master on SSIM, PSNR and VMAF,
// or it goes 5 quality steps up. Alpha: at most 0.01% of the partly transparent
// pixels may be off by more than 4/255 and none by more than 16, or alpha goes
// to q98, then lossless. A lone edge pixel is invisible; drift across a
// dissolving wheel is not, and that is what the count catches.
//
//   node artifacts/export-frames.mjs                 every master
//   node artifacts/export-frames.mjs layers cockpit  only paths containing these
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const MASTERS = path.join(ROOT, "artifacts/masters/landscape");
const PUBLIC = path.join(ROOT, "public/renders-sr26");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "export-frames-"));
const BG = "#0a0a0a";
const QUALITY = [55, 60, 65, 70, 75];
const ALPHA_QUALITY = [95, 98, 100];
const avifArgs = (q, qa) => [
  "-d", "8", "-y", "444", "-a", "c:tune=iq", "-s", "4",
  "-q", String(q), "--qalpha", String(qa), "-j", "1",
];

const filters = process.argv.slice(2);
const masters = ["full", "layers", "layers/brake-arc"].flatMap((dir) =>
  fs.existsSync(path.join(MASTERS, dir))
    ? fs
        .readdirSync(path.join(MASTERS, dir))
        .filter((f) => f.endsWith(".png"))
        .map((f) => path.join(dir, f))
    : [],
).filter((rel) => filters.every((f) => rel.includes(f)));

const flatten = (input, file) =>
  sharp(input).flatten({ background: BG }).png({ compressionLevel: 1 }).toFile(file);

async function score(reference, candidate) {
  const stderr = async (args) => {
    try {
      const { stderr: out } = await run("ffmpeg", ["-hide_banner", ...args, "-f", "null", "-"]);
      return out;
    } catch (error) {
      return String(error.stderr ?? error);
    }
  };
  const ssim = await stderr(["-i", candidate, "-i", reference, "-lavfi", "ssim"]);
  const vmaf = await stderr([
    "-i", candidate, "-i", reference, "-lavfi",
    "[0:v]format=yuv444p[d];[1:v]format=yuv444p[r];[d][r]libvmaf=n_threads=1",
  ]);
  const [a, b] = await Promise.all([reference, candidate].map((f) => sharp(f).raw().toBuffer()));
  let se = 0;
  for (let i = 0; i < a.length; i += 1) se += (a[i] - b[i]) ** 2;
  return {
    ssim: Number(ssim.match(/All:([0-9.]+)/)[1]),
    psnr: 10 * Math.log10((255 * 255) / (se / a.length)),
    vmaf: Number(vmaf.match(/VMAF score: ([0-9.]+)/)[1]),
  };
}

async function alphaError(master, decoded) {
  const [a, b] = await Promise.all(
    [master, decoded].map((f) => sharp(f).ensureAlpha().extractChannel(3).raw().toBuffer()),
  );
  let max = 0;
  let off = 0;
  let soft = 0;
  for (let i = 0; i < a.length; i += 1) {
    const d = Math.abs(a[i] - b[i]);
    max = Math.max(max, d);
    if (d > 4) off += 1;
    if (a[i] > 0 && a[i] < 255) soft += 1;
  }
  return { max, off, passed: max <= 16 && off <= Math.max(1, soft * 1e-4) };
}

async function exportFrame(rel, worker) {
  const master = path.join(MASTERS, rel);
  const shipped = path.join(PUBLIC, rel.replace(/\.png$/, ".webp"));
  const out = path.join(PUBLIC, rel.replace(/\.png$/, ".avif"));
  if (!fs.existsSync(shipped)) throw new Error(`no shipped WebP beside ${rel}`);
  const tmp = (name) => path.join(TMP, `${worker}-${name}`);

  await flatten(master, tmp("ref.png"));
  await flatten(shipped, tmp("webp.png"));
  const bar = await score(tmp("ref.png"), tmp("webp.png"));

  let qi = 0;
  let ai = 0;
  for (;;) {
    const q = QUALITY[qi];
    const qa = ALPHA_QUALITY[ai];
    await run("avifenc", [...avifArgs(q, qa), master, tmp("out.avif")]);
    await run("avifdec", ["-j", "1", "-d", "8", tmp("out.avif"), tmp("dec.png")]);
    await flatten(tmp("dec.png"), tmp("avif.png"));
    const got = await score(tmp("ref.png"), tmp("avif.png"));
    const alpha = await alphaError(master, tmp("dec.png"));
    const colourOk = got.ssim >= bar.ssim && got.psnr >= bar.psnr && got.vmaf >= bar.vmaf;
    const colourStuck = colourOk || qi === QUALITY.length - 1;
    const alphaStuck = alpha.passed || ai === ALPHA_QUALITY.length - 1;
    if (colourStuck && alphaStuck) {
      fs.copyFileSync(tmp("out.avif"), out);
      return {
        rel, q, qa, passed: colourOk && alpha.passed, alpha,
        webpBytes: fs.statSync(shipped).size,
        avifBytes: fs.statSync(out).size,
        webp: bar, avif: got,
      };
    }
    if (!colourOk) qi += 1;
    if (!alpha.passed) ai += 1;
  }
}

const results = [];
let next = 0;
const workers = Math.max(1, Math.min(os.cpus().length - 2, 12));
await Promise.all(
  Array.from({ length: workers }, async (_, worker) => {
    while (next < masters.length) {
      const rel = masters[next++];
      const result = await exportFrame(rel, worker);
      results.push(result);
      if (results.length % 25 === 0) console.log(`[export] ${results.length}/${masters.length}`);
    }
  }),
);
fs.rmSync(TMP, { recursive: true, force: true });

const mb = (bytes) => (bytes / 1e6).toFixed(2);
const groups = {};
for (const r of results) {
  const group = r.rel.replace(/-?\d{4}\.png$/, "").replace(/\.png$/, "");
  const g = (groups[group] ??= { frames: 0, webp: 0, avif: 0, q: {} });
  g.frames += 1;
  g.webp += r.webpBytes;
  g.avif += r.avifBytes;
  const key = `${r.q}/${r.qa}`;
  g.q[key] = (g.q[key] ?? 0) + 1;
}
for (const [group, g] of Object.entries(groups).sort()) {
  console.log(
    `${group.padEnd(34)} ${String(g.frames).padStart(3)} frames  WebP ${mb(g.webp)} MB -> AVIF ${mb(g.avif)} MB ` +
      `(${Math.round((1 - g.avif / g.webp) * 100)}% smaller)  q/qalpha ${JSON.stringify(g.q)}`,
  );
}
const failed = results.filter((r) => !r.passed);
const webp = results.reduce((s, r) => s + r.webpBytes, 0);
const avif = results.reduce((s, r) => s + r.avifBytes, 0);
console.log(`[export] ${results.length} frames: WebP ${mb(webp)} MB -> AVIF ${mb(avif)} MB; ${failed.length} failed the gate`);
for (const r of failed) console.log(`  FAILED ${r.rel} at q${r.q}/${r.qa}: alpha`, r.alpha, r.avif, "vs", r.webp);
// Merged into what earlier (filtered) runs recorded, so the report covers the set.
const reportFile = path.join(MASTERS, "export-report.json");
const report = new Map(
  (fs.existsSync(reportFile) ? JSON.parse(fs.readFileSync(reportFile, "utf8")) : []).map((r) => [r.rel, r]),
);
results.forEach((r) => report.set(r.rel, r));
fs.writeFileSync(reportFile, JSON.stringify([...report.values()].sort((a, b) => a.rel.localeCompare(b.rel)), null, 1));
if (failed.length) process.exitCode = 1;
