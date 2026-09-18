/* Screenshot the /car scroll sequence as it actually paints.
 *
 * Drives headless Brave over the DevTools Protocol to a *production* build,
 * walks the scroll to the cockpit-susp leg and shoots the frames the tire
 * dissolve plays on. Three things this has to work around:
 *
 *   - The Claude Code Browser pane runs its tab document.hidden, so rAF never
 *     fires, ScrollTrigger never pins, and screenshots composite stale frames.
 *     There is no way to verify this page from inside it.
 *   - Against `next dev` the page loads and never hydrates, so the sequence sits
 *     on "Loading vehicle" forever. Point this at `next build && next start`.
 *   - Headless Chromium reports prefers-reduced-motion: reduce, which makes /car
 *     bail out before it pins. Emulation.setEmulatedMedia clears it.
 *
 *   npm run build && npx next start -p 3099
 *   FRAMES=27,29,31,33,35,37,40 node artifacts/shoot-car.mjs
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PORT = Number(process.env.CDP_PORT ?? 9333);
const URL_ = process.env.CAR_URL ?? "http://127.0.0.1:3099/car";
const OUT = process.env.OUT ?? "/private/tmp/claude-501/-Users-aretelew-Developer-baja-baja-website-v2/6b36643d-fe14-4d47-bda7-9f493b0f9d48/scratchpad/shots";
const WANT = (process.env.FRAMES ?? "29,31,33,35,37,38").split(",").map(Number);
fs.mkdirSync(OUT, { recursive: true });

const profile = fs.mkdtempSync(path.join(os.tmpdir(), "brave-cdp-"));
const brave = spawn("/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
   "--no-first-run", "--disable-gpu", "--force-device-scale-factor=2", "about:blank"],
  { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0;
const pending = new Map();
const send = (method, params = {}) =>
  new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej });
    ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + " " + (r.exceptionDetails.exception?.description ?? ""));
  return r.result.value;
};

try {
  let list;
  for (let i = 0; i < 60; i++) {
    try { list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); if (list.length) break; } catch {}
    await sleep(250);
  }
  const target = list.find((t) => t.type === "page");
  ws = new WebSocket(target.webSocketDebuggerUrl);
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id);
      m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); }
  };
  await new Promise((r) => (ws.onopen = r));

  await send("Page.enable");
  await send("Runtime.enable");
  // Headless Chromium claims prefers-reduced-motion: reduce, and /car bails out
  // of pinning when it sees that.
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false });
  await send("Page.navigate", { url: URL_ });

  for (let i = 0; i < 120; i++) {
    const ok = await evaluate(`(() => {
      const el = document.querySelector('[data-car-sequence]');
      if (!el) return false;
      const k = Object.keys(el).find((k) => k.startsWith('__reactFiber$'));
      return Boolean(k) && document.readyState === 'complete';
    })()`).catch(() => false);
    if (ok) break;
    await sleep(500);
  }
  await sleep(2500);

  const height = await evaluate("document.documentElement.scrollHeight");
  console.log("doc height", height);

  const read = async (y) => {
    await evaluate(`window.scrollTo(0, ${y})`);
    await sleep(140);
    return evaluate(`(() => {
      const img = document.querySelector('img[data-excursion-leg="cockpit-susp"]');
      if (!img) return null;
      const cs = getComputedStyle(img);
      const m = (img.getAttribute('src') || '').match(/cockpit-susp-(\\d+)/);
      return { frame: m ? Number(m[1]) : null, vis: cs.visibility, op: Number(cs.opacity) };
    })()`);
  };

  // Find the stretch of scroll the leg owns, coarsely.
  let lo = null, hi = null;
  for (let y = 0; y < height; y += 60) {
    const s = await read(y);
    if (s && s.frame && s.vis !== "hidden" && s.op > 0.9) { if (lo === null) lo = y; hi = y; }
  }
  console.log("leg owns scroll", lo, "-", hi);

  // ScrollTrigger scrubs with smoothing, so which frame a given y lands on is
  // not exactly repeatable - shoot first, then label by what was on screen.
  const got = new Set();
  for (let y = lo - 60; y <= hi + 60; y += 12) {
    const st = await read(y);
    if (!st || !st.frame || st.vis === "hidden" || st.op < 0.9) continue;
    if (!WANT.includes(st.frame) || got.has(st.frame)) continue;
    await sleep(260);
    const again = await evaluate(`(() => {
      const img = document.querySelector('img[data-excursion-leg="cockpit-susp"]');
      const m = (img.getAttribute('src') || '').match(/cockpit-susp-(\\d+)/);
      return m ? Number(m[1]) : null;
    })()`);
    if (again !== st.frame) continue;      // still settling
    const shot = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(OUT, `car-leg-${String(st.frame).padStart(4, "0")}.png`), Buffer.from(shot.data, "base64"));
    got.add(st.frame);
    console.log("shot frame", st.frame, "at y", y);
  }
  console.log("missed:", WANT.filter((f) => !got.has(f)).join(",") || "none");
} finally {
  try { ws?.close(); } catch {}
  brave.kill();
}
