// Draws the competition dot map on one <canvas>. It used to be 4,555 SVG
// circles, and rewriting every circle's radius on each mousemove kept the main
// thread busy with style recalc (60 fps at best on a 120 Hz screen, ~17 fps at
// 4x CPU throttle). Here the dots are one path per colour, the finished map is
// cached in an offscreen layer, and a hover redraws only the rectangle around
// the cursor.

export type Dot = [x: number, y: number, isVenue: 0 | 1];

export const BASE_R = 0.22;
export const MAX_R = 0.38;
export const HOVER_RADIUS = 6; // viewBox units
const FADE_MS = 300;
const STAGGER_MS = 800;
// Fade alpha is bucketed so each frame is a few dozen fills, not thousands.
const ALPHA_LEVELS = 16;
const DOT_FILL = "rgba(255,255,255,0.5)";
const TAU = Math.PI * 2;

/** Radius of a dot `dist` viewBox units from the cursor. */
export function dotRadius(dist: number): number {
  return dist < HOVER_RADIUS
    ? BASE_R + (MAX_R - BASE_R) * (1 - dist / HOVER_RADIUS)
    : BASE_R;
}

/** A dot's opacity `elapsed` ms into the fade, given its start delay (power2.out). */
export function fadeAlpha(elapsed: number, delay: number): number {
  const p = Math.min(1, Math.max(0, (elapsed - delay) / FADE_MS));
  return 1 - (1 - p) * (1 - p);
}

/**
 * The device-pixel rectangle holding every dot a cursor at (cx, cy) device px
 * can enlarge, snapped outward to whole pixels and clamped to the canvas.
 */
export function bulgeRect(
  cx: number,
  cy: number,
  scale: number,
  width: number,
  height: number,
): [x: number, y: number, w: number, h: number] | null {
  const ext = (HOVER_RADIUS + MAX_R) * scale + 2;
  const x0 = Math.max(0, Math.floor(cx - ext));
  const y0 = Math.max(0, Math.floor(cy - ext));
  const x1 = Math.min(width, Math.ceil(cx + ext));
  const y1 = Math.min(height, Math.ceil(cy + ext));
  return x1 > x0 && y1 > y0 ? [x0, y0, x1 - x0, y1 - y0] : null;
}

interface Options {
  dots: Dot[];
  viewBox: [x: number, y: number, w: number, h: number];
  /** Fill for venue dots. */
  venueFill: string;
}

export interface DotMapCanvas {
  /** Fades the dots in with a random stagger. Only the first call counts. */
  startFade(): void;
  /** Cursor in viewBox units, or null when it leaves the map. */
  setCursor(x: number | null, y: number | null): void;
  dispose(): void;
}

export function createDotMapCanvas(
  canvas: HTMLCanvasElement,
  { dots, viewBox, venueFill }: Options,
): DotMapCanvas {
  const ctx = canvas.getContext("2d");
  if (!ctx) return { startFade() {}, setCursor() {}, dispose() {} };

  const [vx, vy, vw] = viewBox;
  const n = dots.length;
  const xs = new Float32Array(n);
  const ys = new Float32Array(n);
  const venue = new Uint8Array(n);
  const delays = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    [xs[i], ys[i], venue[i]] = dots[i];
    delays[i] = Math.random() * STAGGER_MS;
  }
  const fills = [DOT_FILL, venueFill];

  // Every dot at its base radius and full opacity, the size of the canvas.
  const cache = document.createElement("canvas");
  const cacheCtx = cache.getContext("2d")!;

  let scale = 1; // device px per viewBox unit
  let mx: number | null = null;
  let my: number | null = null;
  let lastRect: ReturnType<typeof bulgeRect> = null;
  let phase: "hidden" | "fading" | "shown" = "hidden";
  let fadeStart = 0;
  let rafId = 0;

  const toUnits = (c: CanvasRenderingContext2D) =>
    c.setTransform(scale, 0, 0, scale, -vx * scale, -vy * scale);

  const radiusAt = (i: number) => {
    if (mx === null || my === null) return BASE_R;
    return dotRadius(Math.hypot(xs[i] - mx, ys[i] - my));
  };

  const addDot = (c: CanvasRenderingContext2D, i: number, r: number) => {
    c.moveTo(xs[i] + r, ys[i]);
    c.arc(xs[i], ys[i], r, 0, TAU);
  };

  const buildCache = () => {
    cache.width = canvas.width;
    cache.height = canvas.height;
    toUnits(cacheCtx);
    for (let v = 0; v < 2; v++) {
      cacheCtx.fillStyle = fills[v];
      cacheCtx.beginPath();
      for (let i = 0; i < n; i++) if (venue[i] === v) addDot(cacheCtx, i, BASE_R);
      cacheCtx.fill();
    }
  };

  const restore = ([x, y, w, h]: NonNullable<typeof lastRect>) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(x, y, w, h);
    ctx.drawImage(cache, x, y, w, h, x, y, w, h);
  };

  // Put the last bulge back from the cache, then clear the new bulge's
  // rectangle and redraw just the dots that touch it.
  const drawBulge = () => {
    if (lastRect) restore(lastRect);
    lastRect = null;
    if (mx === null || my === null) return;
    const rect = bulgeRect(
      (mx - vx) * scale,
      (my - vy) * scale,
      scale,
      canvas.width,
      canvas.height,
    );
    if (!rect) return;
    const [x, y, w, h] = rect;
    // The rectangle in viewBox units, padded by the largest radius.
    const ux0 = x / scale + vx - MAX_R;
    const uy0 = y / scale + vy - MAX_R;
    const ux1 = (x + w) / scale + vx + MAX_R;
    const uy1 = (y + h) / scale + vy + MAX_R;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(x, y, w, h);
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    toUnits(ctx);
    for (let v = 0; v < 2; v++) {
      ctx.fillStyle = fills[v];
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        if (venue[i] !== v || xs[i] < ux0 || xs[i] > ux1 || ys[i] < uy0 || ys[i] > uy1) {
          continue;
        }
        addDot(ctx, i, radiusAt(i));
      }
      ctx.fill();
    }
    ctx.restore();
    lastRect = rect;
  };

  const drawShown = () => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(cache, 0, 0);
    lastRect = null;
    drawBulge();
  };

  // One full frame of the fade, bulge included. Returns whether it finished.
  const buckets: number[][] = Array.from({ length: 2 * ALPHA_LEVELS }, () => []);
  const drawFadeFrame = (elapsed: number) => {
    for (const bucket of buckets) bucket.length = 0;
    let finished = true;
    for (let i = 0; i < n; i++) {
      const alpha = fadeAlpha(elapsed, delays[i]);
      if (alpha < 1) finished = false;
      const level = Math.round(alpha * ALPHA_LEVELS);
      if (level > 0) buckets[venue[i] * ALPHA_LEVELS + level - 1].push(i);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    toUnits(ctx);
    for (let v = 0; v < 2; v++) {
      ctx.fillStyle = fills[v];
      for (let level = 1; level <= ALPHA_LEVELS; level++) {
        const bucket = buckets[v * ALPHA_LEVELS + level - 1];
        if (!bucket.length) continue;
        ctx.globalAlpha = level / ALPHA_LEVELS;
        ctx.beginPath();
        for (const i of bucket) addDot(ctx, i, radiusAt(i));
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    return finished;
  };

  const tick = (now: number) => {
    if (drawFadeFrame(now - fadeStart)) {
      phase = "shown";
      drawShown();
      return;
    }
    rafId = requestAnimationFrame(tick);
  };

  // Backing store = CSS size x devicePixelRatio.
  const resize = () => {
    const { width, height } = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(width * dpr);
    const h = Math.round(height * dpr);
    if (w === canvas.width && h === canvas.height && cache.width === w) return;
    canvas.width = w;
    canvas.height = h;
    scale = w / vw;
    buildCache();
    lastRect = null;
    // A fade redraws on its next frame; a hidden map stays blank.
    if (phase === "shown") drawShown();
  };

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  // Zoom can change devicePixelRatio without changing the CSS size.
  window.addEventListener("resize", resize);
  resize();

  return {
    startFade() {
      if (phase !== "hidden") return;
      phase = "fading";
      rafId = requestAnimationFrame((now) => {
        fadeStart = now;
        tick(now);
      });
    },
    setCursor(x, y) {
      mx = x;
      my = y;
      // A running fade picks the cursor up on its next frame.
      if (phase === "shown") drawBulge();
    },
    dispose() {
      cancelAnimationFrame(rafId);
      observer.disconnect();
      window.removeEventListener("resize", resize);
    },
  };
}
