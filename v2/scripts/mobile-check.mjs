#!/usr/bin/env node
/**
 * Checks every page at phone and tablet sizes in headless Chromium.
 *
 *   npm run build && npx next start -p 3099      (or the "baja-v2-prod" launch config)
 *   npm run mobile-check                          # every route at every size
 *   npm run mobile-check -- --sizes 320x568 --checks overflow
 *
 * Run it against a production build. The dev server never hydrates in a headless
 * browser, so no client code would run.
 *
 * Touch is emulated for real: DevTools' and agent-browser's device presets still
 * report a mouse, so `(hover: hover)` would match. Reduced motion is switched off,
 * because headless Chromium turns it on by default. The logo intro is marked as
 * seen, so every size measures the same page. Each page loads, settles, scrolls
 * to the bottom and back so scroll-in content has mounted, and is then checked:
 *
 *   overflow  Any element that reaches past the screen edge. html and body don't
 *             count as clipping, since their overflow-x: clip is only a safety
 *             net. The outermost element that sticks out is reported. Fixed
 *             elements count only while they're visible. Collapsed sections
 *             (aria-expanded="false" outside the nav) are opened one at a time
 *             and scanned too: the results ledger only exists once a season is
 *             open.
 *   targets   Anything tappable smaller than 44x44 px. Links inside a sentence
 *             are exempt, as in WCAG 2.5.8.
 *   errors    Uncaught exceptions, console.error, failed requests and HTTP
 *             errors, except /_vercel/ (analytics only exist on Vercel).
 *   cls       Cumulative layout shift above 0.1 during load, before any
 *             scrolling, as Lighthouse measures it. Shifts during the scroll-through
 *             go in report.json as scrollCls but don't fail the run: a GSAP pin
 *             switches its element to position: fixed, which Chrome logs as a shift
 *             the size of the whole stage (0.36 on /car) although on screen it
 *             moves 13px.
 *
 * Every check is always reported. The ones named in --checks (default: all) set
 * the exit code. Screenshots and report.json go to --out.
 *
 * Options:
 *   --base <url>       server to test (default http://127.0.0.1:3099)
 *   --routes a,b       paths (default: every page)
 *   --sizes WxH,...    viewports (default: see SIZES)
 *   --checks a,b       checks that fail the run (default overflow,targets,errors,cls)
 *   --out <dir>        output directory (default .mobile-check)
 *   --reduced-motion   run with prefers-reduced-motion: reduce
 *   --no-shots         skip screenshots
 *   CHROME_PATH        browser binary, if none of the usual ones is found
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const ROUTES = ["/", "/team", "/competition", "/sponsors", "/support", "/contact", "/car"];
// Small and common phones, a big phone, portrait and landscape tablets, and a
// phone held sideways.
const SIZES = ["320x568", "360x780", "390x844", "430x932", "768x1024", "1024x768", "844x390"];
const CHECKS = ["overflow", "targets", "errors", "cls"];
const MIN_TARGET = 44;
const MAX_CLS = 0.1;
const IGNORED_URLS = [/\/_vercel\//];
const BROWSERS = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];

const args = parseArgs(process.argv.slice(2));
const base = (args.base ?? "http://127.0.0.1:3099").replace(/\/$/, "");
const routes = list(args.routes) ?? ROUTES;
const sizes = (list(args.sizes) ?? SIZES).map(parseSize);
const failOn = list(args.checks) ?? CHECKS;
const outDir = path.resolve(ROOT, args.out ?? ".mobile-check");
const shots = !args["no-shots"];
const reducedMotion = Boolean(args["reduced-motion"]);

for (const check of failOn) {
  if (!CHECKS.includes(check)) fail(`Unknown check "${check}". Pick from ${CHECKS.join(", ")}.`);
}
try {
  await fetch(base, { method: "HEAD" });
} catch {
  fail(`Nothing answered at ${base}. Start a production build first:\n  npm run build && npx next start -p 3099`);
}
fs.mkdirSync(outDir, { recursive: true });

const browser = await launchBrowser();
const results = [];
try {
  const page = await browser.newPage();
  // The intro plays once per session; marking it seen keeps every size alike.
  await page.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `try { sessionStorage.setItem("mIntroSeen", "1"); } catch {}\n(${watchLayoutShifts})();`,
  });
  await page.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: reducedMotion ? "reduce" : "no-preference" }],
  });
  await page.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });

  console.log(
    `mobile-check  ${base}  ${routes.length} routes x ${sizes.length} sizes  ` +
      `(touch on, reduced motion ${reducedMotion ? "on" : "off"}, failing on ${failOn.join(", ")})\n`,
  );
  for (const route of routes) {
    console.log(route);
    for (const size of sizes) {
      const result = await checkPage(page, route, size);
      results.push(result);
      printResult(result);
    }
    console.log("");
  }
} finally {
  await browser.close();
}

fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(results, null, 2));
const failed = results.filter((result) => result.failed.length);
console.log(
  failed.length
    ? `${failed.length} of ${results.length} page loads failed. Details in ${path.relative(process.cwd(), outDir)}/report.json`
    : `All ${results.length} page loads passed.`,
);
process.exit(failed.length ? 1 : 0);

async function checkPage(page, route, size) {
  const dpr = size.width < 600 ? 3 : 2;
  await page.send("Emulation.setDeviceMetricsOverride", {
    width: size.width,
    height: size.height,
    deviceScaleFactor: dpr,
    mobile: true,
  });
  page.errors = [];
  await page.navigate(base + route);
  await page.networkIdle({ quietMs: 500, timeoutMs: 8000 });
  await sleep(1000);

  const measured = await page.evaluate(`(${measure})(${size.width}, ${MIN_TARGET})`);
  const result = {
    route,
    size: `${size.width}x${size.height}`,
    env: measured.env,
    overflow: measured.overflow,
    targets: measured.targets,
    errors: [...new Set(page.errors)],
    cls: Number(measured.loadCls.value.toFixed(3)),
    clsSources: measured.loadCls.sources,
    scrollCls: Number(measured.cls.value.toFixed(3)),
    scrollClsSources: measured.cls.sources,
  };
  if (shots) result.screenshot = await screenshot(page, route, size, dpr);
  result.failed = failOn.filter((check) => {
    if (check === "overflow") return result.overflow.length > 0;
    if (check === "targets") return result.targets.length > 0;
    if (check === "errors") return result.errors.length > 0;
    return result.cls > MAX_CLS;
  });
  return result;
}

function printResult(result) {
  const mark = (check, bad) => `${check} ${bad}${result.failed.includes(check) ? "!" : ""}`;
  const summary = [
    mark("overflow", result.overflow.length),
    mark("targets", result.targets.length),
    mark("errors", result.errors.length),
    mark("cls", result.cls.toFixed(2)),
  ].join(" · ");
  console.log(`  ${result.failed.length ? "FAIL" : "ok  "} ${result.size.padEnd(9)} ${summary}`);
  const env = result.env;
  if (env.innerWidth !== Number(result.size.split("x")[0])) {
    console.log(`         layout viewport grew to ${env.innerWidth}px`);
  }
  for (const item of result.overflow) {
    const where = item.states.length ? `  after ${item.states[0]}${item.states.length > 1 ? ` (+${item.states.length - 1} more)` : ""}` : "";
    console.log(`         overflow  ${item.element}  ${item.left}..${item.right}px${item.count > 1 ? `  x${item.count}` : ""}${where}`);
  }
  if (result.failed.includes("targets")) {
    for (const item of result.targets) {
      console.log(`         target    ${item.element}  ${item.width}x${item.height}${item.count > 1 ? `  x${item.count}` : ""}`);
    }
  }
  for (const error of result.errors) console.log(`         error     ${error}`);
  if (result.failed.includes("cls")) {
    for (const source of result.clsSources) console.log(`         shift     ${source}`);
  }
}

async function screenshot(page, route, size, dpr) {
  const { width, height } = await page.evaluate(
    `({ width: innerWidth, height: document.documentElement.scrollHeight })`,
  );
  // Chromium can't capture much past 16k device pixels in one go.
  const scale = Math.min(2 / dpr, 16000 / (height * dpr));
  const { data } = await page.send("Page.captureScreenshot", {
    format: "jpeg",
    quality: 70,
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width, height, scale },
  });
  const name = `${route === "/" ? "home" : route.slice(1).replaceAll("/", "-")}-${size.width}x${size.height}.jpg`;
  fs.writeFileSync(path.join(outDir, name), Buffer.from(data, "base64"));
  return name;
}

// Runs in the page, as a string, so it can't close over anything here.
async function measure(width, minTarget) {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const root = document.documentElement;
  const shifts = window.__mobileCheck ?? { value: 0, sources: [] };
  const loadCls = { value: shifts.value, sources: [...shifts.sources] };

  // Scroll through once so lazy and scroll-triggered content has mounted.
  const step = Math.round(innerHeight * 0.6);
  for (let y = 0; y < root.scrollHeight; y += step) {
    scrollTo(0, y);
    await sleep(80);
  }
  scrollTo(0, root.scrollHeight);
  await sleep(500);
  scrollTo(0, 0);
  await sleep(700);

  const describe = (el) => {
    const classes = typeof el.className === "string" ? el.className : el.getAttribute("class") ?? "";
    const data = [...el.attributes].filter((a) => a.name.startsWith("data-")).map((a) => `[${a.name}]`);
    const text = (el.innerText ?? el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 30);
    return (
      el.tagName.toLowerCase() +
      (el.id ? `#${el.id}` : "") +
      classes.split(/\s+/).filter(Boolean).slice(0, 4).map((c) => `.${c}`).join("") +
      data.slice(0, 2).join("") +
      (text ? ` "${text}"` : "")
    );
  };
  // Collapses elements that describe alike, keeping the worst of them and the
  // states they turned up in.
  const group = (items, badness) => {
    const byKey = new Map();
    for (const item of items) {
      const seen = byKey.get(item.element);
      const states = [...new Set([...(seen?.states ?? []), ...(item.state ? [item.state] : [])])];
      if (!seen) byKey.set(item.element, { ...item, states, count: 1 });
      else if (badness(item) > badness(seen)) byKey.set(item.element, { ...item, states, count: seen.count + 1 });
      else Object.assign(seen, { states, count: seen.count + 1 });
    }
    return [...byKey.values()].map((item) => {
      const grouped = { ...item };
      delete grouped.state;
      return grouped;
    });
  };
  const visible = (el) => el.checkVisibility({ opacityProperty: true, visibilityProperty: true });

  // Overflow: elements that stick out past either edge and aren't inside
  // something that clips them (html and body aside).
  const clipsX = (el) => {
    const style = getComputedStyle(el);
    return style.overflowX !== "visible" || /paint|strict|content/.test(style.contain);
  };
  const scanOverflow = (state) => {
  const offenders = new Set();
  for (const el of document.body.querySelectorAll("*")) {
    const rect = el.getBoundingClientRect();
    // 1px boxes are screen-reader-only text, hung off the edge on purpose.
    if (rect.width <= 1 || rect.height <= 1) continue;
    if (rect.left >= -0.5 && rect.right <= width + 0.5) continue;
    let contained = false;
    let fixed = false;
    for (let node = el; node && node !== document.body; node = node.parentElement) {
      if (node !== el && clipsX(node)) contained = true;
      if (getComputedStyle(node).position === "fixed") fixed = true;
    }
    if (contained) continue;
    if (fixed && !visible(el)) continue;
    offenders.add(el);
  }
  return [...offenders]
    .filter((el) => !offenders.has(el.parentElement))
    .map((el) => {
      const rect = el.getBoundingClientRect();
      return { element: describe(el), left: Math.round(rect.left), right: Math.round(rect.right), state };
    });
  };
  const found = scanOverflow();
  const toggles = [...document.querySelectorAll('button[aria-expanded="false"]')].filter(
    (toggle) => !toggle.closest("nav") && visible(toggle),
  );
  for (const toggle of toggles) {
    const label = (toggle.innerText || toggle.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ");
    toggle.click();
    await sleep(350);
    found.push(...scanOverflow(`opened "${label.slice(0, 24)}"`));
    if (toggle.getAttribute("aria-expanded") === "true") {
      toggle.click();
      await sleep(150);
    }
  }
  scrollTo(0, 0);
  await sleep(300);
  const overflow = group(found, (item) => Math.max(-item.left, item.right - width));

  // Touch targets.
  const tappable = document.querySelectorAll(
    'a[href], button, input:not([type="hidden"]), select, textarea, summary, ' +
      '[role="button"], [role="link"], [role="slider"], [role="tab"], [role="checkbox"], ' +
      '[role="switch"], [role="menuitem"], [tabindex]:not([tabindex="-1"])',
  );
  const small = [];
  for (const el of tappable) {
    if (!visible(el)) continue;
    const style = getComputedStyle(el);
    if (style.pointerEvents === "none") continue;
    const rect = el.getBoundingClientRect();
    if (!rect.width || rect.right <= 0 || rect.left >= width) continue;
    // A link inside a sentence is exempt: its size is the text's.
    const ownText = (el.innerText ?? "").trim().length;
    const parentText = (el.parentElement?.innerText ?? "").trim().length;
    if (style.display === "inline" && parentText > ownText + 1) continue;
    if (rect.width < minTarget || rect.height < minTarget) {
      small.push({ element: describe(el), width: Math.round(rect.width), height: Math.round(rect.height) });
    }
  }

  return {
    env: {
      innerWidth,
      scrollWidth: root.scrollWidth,
      hover: matchMedia("(hover: hover)").matches,
      coarsePointer: matchMedia("(pointer: coarse)").matches,
      reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
    },
    overflow,
    targets: group(small, (item) => -Math.min(item.width, item.height)),
    loadCls,
    cls: shifts,
  };
}

// Installed before any page script runs. Tracks CLS the way Core Web Vitals
// does: shifts less than 1 s apart form a session window capped at 5 s, and the
// largest window is the score.
function watchLayoutShifts() {
  const state = { value: 0, sources: [] };
  window.__mobileCheck = state;
  let windowValue = 0;
  let windowStart = 0;
  let last = 0;
  try {
    new PerformanceObserver((entries) => {
      for (const entry of entries.getEntries()) {
        if (entry.hadRecentInput) continue;
        if (windowValue && entry.startTime - last < 1000 && entry.startTime - windowStart < 5000) {
          windowValue += entry.value;
        } else {
          windowValue = entry.value;
          windowStart = entry.startTime;
        }
        last = entry.startTime;
        state.value = Math.max(state.value, windowValue);
        if (entry.value >= 0.01 && state.sources.length < 5) {
          for (const source of entry.sources ?? []) {
            const node = source.node;
            if (!node || node.nodeType !== 1) continue;
            const classes = (node.getAttribute("class") ?? "").split(/\s+/).slice(0, 3).join(".");
            state.sources.push(`${entry.value.toFixed(3)} ${node.tagName.toLowerCase()}${classes ? "." + classes : ""}`);
          }
        }
      }
    }).observe({ type: "layout-shift", buffered: true });
  } catch {}
}

async function launchBrowser() {
  const executable = [process.env.CHROME_PATH, ...BROWSERS].find((candidate) => candidate && fs.existsSync(candidate));
  if (!executable) fail("No Chromium-based browser found. Set CHROME_PATH to one.");
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "mobile-check-"));
  const child = spawn(
    executable,
    [
      "--headless=new",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--hide-scrollbars",
      "--mute-audio",
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  const endpoint = await new Promise((resolve, reject) => {
    let log = "";
    const timer = setTimeout(() => reject(new Error(`${executable} didn't start:\n${log}`)), 20000);
    child.stderr.on("data", (chunk) => {
      log += chunk;
      const match = log.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
    child.on("exit", () => reject(new Error(`${executable} exited:\n${log}`)));
  });

  const socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });
  let nextId = 0;
  const pending = new Map();
  const listeners = new Set();
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id !== undefined) {
      const call = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) call?.reject(new Error(`${call.method}: ${message.error.message}`));
      else call?.resolve(message.result);
    } else {
      for (const listener of listeners) listener(message);
    }
  };
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject, method });
      socket.send(JSON.stringify({ id, method, params, sessionId }));
    });

  return {
    async newPage() {
      const { targetId } = await send("Target.createTarget", { url: "about:blank" });
      const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
      const page = {
        errors: [],
        send: (method, params) => send(method, params, sessionId),
        inflight: new Set(),
        lastActivity: Date.now(),
      };
      const loaded = new Set();
      const urls = new Map();
      listeners.add(({ method, params, sessionId: from }) => {
        if (from !== sessionId) return;
        const ignored = (url) => IGNORED_URLS.some((pattern) => pattern.test(url ?? ""));
        switch (method) {
          case "Page.loadEventFired":
            for (const resolve of loaded) resolve();
            loaded.clear();
            break;
          case "Network.requestWillBeSent":
            page.inflight.add(params.requestId);
            urls.set(params.requestId, params.request.url);
            page.lastActivity = Date.now();
            break;
          case "Network.responseReceived":
            if (params.response.status >= 400 && !ignored(params.response.url)) {
              page.errors.push(`HTTP ${params.response.status} ${params.response.url.replace(base, "")}`);
            }
            break;
          case "Network.loadingFinished":
            page.inflight.delete(params.requestId);
            page.lastActivity = Date.now();
            break;
          case "Network.loadingFailed": {
            page.inflight.delete(params.requestId);
            page.lastActivity = Date.now();
            const url = urls.get(params.requestId);
            // Aborted requests are the page cancelling its own work (and every
            // pending frame when the next route loads), not failures.
            if (!params.canceled && params.errorText !== "net::ERR_ABORTED" && !ignored(url)) {
              page.errors.push(`${params.errorText} ${url?.replace(base, "")}`);
            }
            break;
          }
          case "Runtime.exceptionThrown":
            page.errors.push(
              `exception ${params.exceptionDetails.exception?.description?.split("\n")[0] ?? params.exceptionDetails.text}`,
            );
            break;
          case "Runtime.consoleAPICalled":
            if (params.type === "error" || params.type === "assert") {
              const text = params.args.map((arg) => arg.value ?? arg.description ?? "").join(" ");
              if (!IGNORED_URLS.some((pattern) => pattern.test(text))) page.errors.push(`console ${text.slice(0, 160)}`);
            }
            break;
        }
      });
      await page.send("Page.enable");
      await page.send("Runtime.enable");
      await page.send("Network.enable");
      page.navigate = async (url) => {
        const load = new Promise((resolve) => loaded.add(resolve));
        page.inflight.clear();
        await page.send("Page.navigate", { url });
        await Promise.race([load, sleep(20000)]);
      };
      page.networkIdle = async ({ quietMs, timeoutMs }) => {
        const started = Date.now();
        while (Date.now() - started < timeoutMs) {
          if (!page.inflight.size && Date.now() - page.lastActivity >= quietMs) return;
          await sleep(100);
        }
      };
      page.evaluate = async (expression) => {
        const { result, exceptionDetails } = await page.send("Runtime.evaluate", {
          expression,
          awaitPromise: true,
          returnByValue: true,
        });
        if (exceptionDetails) {
          throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
        }
        return result.value;
      };
      return page;
    },
    async close() {
      const exited = new Promise((resolve) => child.once("exit", resolve));
      await send("Browser.close").catch(() => {});
      await Promise.race([exited, sleep(5000)]);
      child.kill();
      // The browser can still be flushing its profile for a moment after exit.
      try {
        fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      } catch {}
    },
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) fail(`Unexpected argument "${arg}".`);
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (next !== undefined && !next.startsWith("--")) {
      parsed[key] = next;
      index += 1;
    } else {
      parsed[key] = true;
    }
  }
  return parsed;
}

function list(value) {
  return typeof value === "string" ? value.split(",").map((item) => item.trim()).filter(Boolean) : undefined;
}

function parseSize(value) {
  const match = /^(\d+)x(\d+)$/.exec(value);
  if (!match) fail(`Sizes look like 390x844, not "${value}".`);
  return { width: Number(match[1]), height: Number(match[2]) };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fail(message) {
  console.error(message);
  process.exit(2);
}
