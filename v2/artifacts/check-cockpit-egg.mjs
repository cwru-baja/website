/* Plays the cockpit easter egg on /car in headless Brave and checks it end to end.
 *
 *   npm run build && npx next start -p 3099      (or the "baja-v2-prod" launch config)
 *   node artifacts/check-cockpit-egg.mjs
 *
 * PASS/FAIL per behaviour: the egg shows only over the cockpit hold and on the
 * still its assets were made against; a click starts Pong; the page holds while it
 * runs (wheel, arrows and space don't scroll it); Esc, a scroll up and a second
 * press each end it and let the page go; outside the hold the buttons can't be
 * hit. Screenshots of the dash go to OUT, including one of the egg at rest and one
 * of the bare still - they should be pixel-identical - and one mid-press.
 *
 * Same traps as shoot-car.mjs: point it at a production build (the dev server
 * never hydrates headless), and headless Chromium claims reduced motion, which
 * /car answers by not pinning at all.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const PORT = 9352, URL_ = process.env.CAR_URL ?? "http://127.0.0.1:3099/car", DPR = Number(process.env.DPR ?? 1);
const OUT = process.env.OUT ?? path.join(os.tmpdir(), "cockpit-egg-check");
fs.mkdirSync(OUT, { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "brave-cdp-"));
const brave = spawn("/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--no-first-run", "--disable-gpu", `--force-device-scale-factor=${DPR}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const pending = new Map(); const logs = [];
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + " " + (r.exceptionDetails.exception?.description ?? "")); return r.result.value; };
const check = (label, ok, detail = "") => console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? "  — " + detail : ""}`);
try {
  let list; for (let i = 0; i < 60; i++) { try { list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); if (list.length) break; } catch {} await sleep(250); }
  ws = new WebSocket(list.find((t) => t.type === "page").webSocketDebuggerUrl);
  ws.onmessage = (e) => { const m = JSON.parse(e.data);
    if (m.method === "Runtime.exceptionThrown") logs.push("EXCEPTION " + (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text));
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") logs.push("error " + m.params.args.map((a) => a.value ?? a.description).join(" "));
    if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); } };
  await new Promise((r) => (ws.onopen = r));
  await send("Page.enable"); await send("Runtime.enable");
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: DPR, mobile: false });
  await send("Page.navigate", { url: URL_ });
  for (let i = 0; i < 120; i++) { const ok = await ev(`(() => { const el = document.querySelector('[data-car-sequence]'); return !!el && Object.keys(el).some((k) => k.startsWith('__reactFiber$')) && document.readyState === 'complete'; })()`).catch(() => false); if (ok) break; await sleep(500); }
  await sleep(2500);
  const egg = () => ev(`(() => { const e = document.querySelector('[data-cockpit-egg]'); if (!e) return null; const cs = getComputedStyle(e);
    return { vis: cs.visibility, op: +cs.opacity, display: cs.display, buttons: e.querySelectorAll('button').length }; })()`);
  const height = await ev("document.documentElement.scrollHeight");
  let lo = null, hi = null;
  for (let y = 0; y < height; y += 150) { await ev(`window.scrollTo(0, ${y})`); await sleep(260); const s = await egg(); if (s && s.vis === "visible" && s.op > 0.99) { lo ??= y; hi = y; } }
  check("egg layer exists on desktop", (await egg()) !== null);
  check("egg shows somewhere in the sequence", lo !== null, `visible over scroll ${lo}..${hi} of ${height}`);
  const mid = Math.round((lo + hi) / 2);
  await ev(`window.scrollTo(0, ${mid})`); await sleep(900);
  const e1 = await egg();
  check("at the cockpit hold: visible, 8 buttons, still is cockpit-dive-0040", e1.vis === "visible" && e1.buttons === 8,
    JSON.stringify(e1) + " leg=" + (await ev(`document.querySelector('img[data-excursion-leg="cockpit-dive"]').getAttribute('src').split('/').pop()`)));
  const geo = await ev(`(() => { const r = document.querySelector('[data-cockpit-egg]').getBoundingClientRect();
    const b = [...document.querySelectorAll('[data-cockpit-egg] button')].map((x) => { const q = x.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; });
    return { x: r.left, y: r.top + scrollY, w: r.width, h: r.height, b }; })()`);
  const clip = { x: geo.x + geo.w * 0.27, y: geo.y + geo.h * 0.27, width: geo.w * 0.46, height: geo.h * 0.5, scale: 1 };
  const shoot = async (name) => { const s = await send("Page.captureScreenshot", { format: "png", clip }); fs.writeFileSync(path.join(OUT, name + ".png"), Buffer.from(s.data, "base64")); };
  // the egg at rest must be invisible against the still
  await shoot("hold-egg"); await ev(`document.querySelector('[data-cockpit-egg]').style.visibility = 'hidden'`); await sleep(120);
  await shoot("hold-no-egg"); await ev(`document.querySelector('[data-cockpit-egg]').style.visibility = 'visible'`); await sleep(120);
  // mid-press: hold the mouse down on a button; outside the dome's disc it must still be the still
  {
    const [bx, by] = geo.b[0], sy = await ev("scrollY");
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: bx, y: by });
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: bx, y: by, button: "left", clickCount: 1 });
    await sleep(220);
    await shoot("pressing");
    fs.writeFileSync(path.join(OUT, "press-geo.json"), JSON.stringify({ cx: bx - clip.x, cy: by + sy - clip.y, rOut: 40 * geo.w / 1920 }));
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: bx, y: by, button: "left", clickCount: 1 });
    await sleep(500);
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await sleep(600);
    await ev(`window.scrollTo(0, ${mid})`); await sleep(900);
  }
  const state = () => ev(`(() => { const c = document.querySelector('[data-cockpit-egg] canvas'); let lit = 0;
    if (c) { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 4) if (d[i]) lit++; }
    const plate = [...document.querySelectorAll('[data-cockpit-egg] img')].find((i) => i.src.includes('plate.webp'));
    return { lit, plate: plate ? +getComputedStyle(plate).opacity : null, y: Math.round(scrollY) }; })()`);
  const click = async ([x, y]) => { for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) { await send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: type === "mouseMoved" ? 0 : 1 }); if (type === "mousePressed") await sleep(90); } };
  const wheel = async (dy, n = 4) => { for (let i = 0; i < n; i++) { await send("Input.dispatchMouseEvent", { type: "mouseWheel", x: 720, y: 450, deltaX: 0, deltaY: dy }); await sleep(60); } };
  const key = async (k, code, vk) => { await send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, windowsVirtualKeyCode: vk }); await sleep(60); await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: vk }); };

  await click(geo.b[0]); await sleep(900);
  let s = await state();
  check("click on a blue button starts the game", s.lit > 500 && s.plate === 1, JSON.stringify(s));
  const yStart = s.y;
  await wheel(+240, 6); await sleep(700); s = await state();
  check("scrolling down is held while playing", Math.abs(s.y - yStart) <= 2 && s.lit > 500, `y ${yStart} -> ${s.y}`);
  await key("ArrowDown", "ArrowDown", 40); await key(" ", "Space", 32); await sleep(300); s = await state();
  check("arrow keys and space don't scroll the page", Math.abs(s.y - yStart) <= 2, `y ${s.y}`);
  await shoot("playing");
  await key("Escape", "Escape", 27); await sleep(500); s = await state();
  check("Esc ends the game", s.lit === 0 && s.plate === 0, JSON.stringify(s));
  await wheel(+120, 3); await sleep(600); const sAfter = await state();
  check("after Esc the page scrolls again", sAfter.y > s.y + 20, `y ${s.y} -> ${sAfter.y}`);

  await ev(`window.scrollTo(0, ${mid})`); await sleep(900);
  await click(geo.b[3]); await sleep(700); s = await state();
  check("second game starts from another button", s.lit > 500, JSON.stringify(s));
  await wheel(-200, 3); await sleep(700); s = await state();
  check("scrolling up ends the game and lets the page go", s.lit === 0 && s.plate === 0 && s.y < mid - 20, JSON.stringify(s));

  await ev(`window.scrollTo(0, ${mid})`); await sleep(900);
  await click(geo.b[5]); await sleep(700);
  await click(geo.b[5]); await sleep(600); s = await state();
  check("pressing a blue button again ends the game", s.lit === 0 && s.plate === 0, JSON.stringify(s));

  for (const [label, y] of [["before the hold", lo - 700], ["after the hold", hi + 700]]) {
    await ev(`window.scrollTo(0, ${y})`); await sleep(900);
    const e = await egg();
    const hit = await ev(`(() => { const el = document.elementFromPoint(${geo.b[0][0]}, ${geo.b[0][1]}); return el ? (el.getAttribute('aria-label') || el.tagName) : null; })()`);
    check(`${label}: egg hidden and its buttons can't be hit`, e.vis === "hidden" && !String(hit).startsWith("Wheel button"), `vis ${e.vis}, element at dome: ${hit}`);
  }
  console.log("console:", logs.length ? logs.join("\n  ") : "clean");
} finally { try { ws?.close(); } catch {} brave.kill(); }
