/**
 * Streams the portrait frame set a little ahead of the scroll instead of
 * preloading it.
 *
 * The desktop loader fetches every frame the sequence plays up front (~37 MB),
 * which a phone can neither afford on a mobile connection nor hold decoded:
 * a 1080x1350 frame is ~5.8 MB of pixels, and iOS kills a tab that grows too
 * far. So on the portrait set every file is scheduled against the stretch of
 * the scroll timeline it is on screen for, and only what is near the scroll
 * position is fetched and held:
 *
 * - Nearest first, coarse first. An asset's priority is its distance from the
 *   scroll position in timeline units (viewports of scroll), plus a penalty for
 *   its level: every 4th frame of a move is level 0, the frames between those
 *   level 1, and the rest level 2. A fast scroll outrunning the network then
 *   plays a move at a quarter of its frames rather than stalling on one.
 * - Direction matters. Distance behind the direction of travel costs four
 *   times as much, so the window leans the way the page is being scrolled and
 *   lets go of what it has passed almost at once.
 * - Bounded. Only assets inside `loadHorizon` are fetched, and anything past
 *   `keepHorizon` (the gap is hysteresis) is released: the loader drops its
 *   Image and clears its src. The file stays in the HTTP cache, so coming back
 *   costs no network.
 * - Decoded ahead only where it pays. Orbit frames are drawn to a canvas with
 *   drawImage, which decodes synchronously if it has to, so the few nearest are
 *   decoded ahead with decode() - off the main thread in WebKit - and at most
 *   `canvasKeep` of them are held. Layer frames are never decoded here: the
 *   <img> elements decode what they show.
 *
 * Why releasing passed frames quickly is what bounds memory on iOS: WebKit keeps
 * decoded pixels with the cached image, not the element. While anything still
 * holds an image (this loader's Image counts), it is "live", and live decoded
 * data drawn in the last second is never pruned - so a scrub through 50 frames a
 * second would pin ~290 MB of 1080x1350 frames. Once nothing holds it, it is
 * "dead", and dead decoded data is dropped as soon as the dead total passes its
 * cap (32-64 MB on phones), with no such floor. Hence: nothing behind the scroll
 * is held for long, and nothing is held decoded that isn't about to be drawn.
 * See WebKit's MemoryCache::pruneLiveResourcesToSize and pruneDeadResourcesToSize
 * (Source/WebCore/loader/cache/MemoryCache.cpp) and Shared/CacheModel.cpp.
 */

export interface Span {
  from: number;
  to: number;
}

export interface StreamAsset {
  url: string;
  /** Where on the timeline the asset is on screen. */
  spans: Span[];
  /** 0 is fetched first; each level fills in between the one before. */
  level: number;
  /** Set for an orbit frame, which the canvas draws rather than an <img> shows. */
  canvasFrame?: number;
}

export const STREAM_TUNING = {
  /** Timeline units a level adds to an asset's distance. */
  levelStep: 0.35,
  /**
   * Distance against the direction of travel counts this many times over: what
   * the scroll has passed is kept for 0.35 of a viewport at most, which covers
   * a small scroll back without holding a long tail of drawn frames.
   */
  behindWeight: 4,
  /** Fetch anything nearer than this. */
  loadHorizon: 1,
  /** Let go of anything further than this. */
  keepHorizon: 1.4,
  /** Orbit frames held decoded for the canvas, nearest first. */
  canvasKeep: 8,
  maxInFlight: 6,
} as const;

export type StreamTuning = typeof STREAM_TUNING;

/** Frame position in a run of `steps + 1` frames to its level. */
export const frameLevel = (position: number, steps: number) => {
  if (position === 0 || position === steps || position % 4 === 0) return 0;
  return position % 2 === 0 ? 1 : 2;
};

/** Collects what the timeline shows and when, as it is built. */
export class StreamSchedule {
  private assets = new Map<string, StreamAsset>();

  /** One file on screen over a stretch of the timeline. */
  add(url: string, from: number, to: number, level = 0, canvasFrame?: number) {
    const span = { from: Math.min(from, to), to: Math.max(from, to) };
    const known = this.assets.get(url);
    if (known) {
      known.spans.push(span);
      known.level = Math.min(known.level, level);
      return;
    }
    this.assets.set(url, { url, spans: [span], level, canvasFrame });
  }

  /**
   * A run of frames played in order from `fromIndex` to `toIndex` (either way)
   * across `duration` from `start`, as a linear tween of the index does: each
   * frame is on screen for the stretch it rounds to.
   */
  run(
    urlAt: (index: number) => string,
    fromIndex: number,
    toIndex: number,
    start: number,
    duration: number,
    canvas = false,
  ) {
    const steps = Math.abs(toIndex - fromIndex);
    const direction = Math.sign(toIndex - fromIndex);
    const end = start + duration;
    if (!steps) {
      this.add(urlAt(fromIndex), start, end, 0, canvas ? fromIndex : undefined);
      return;
    }
    const half = duration / steps / 2;
    for (let position = 0; position <= steps; position += 1) {
      const index = fromIndex + direction * position;
      const at = start + (duration * position) / steps;
      this.add(
        urlAt(index),
        Math.max(start, at - half),
        Math.min(end, at + half),
        frameLevel(position, steps),
        canvas ? index : undefined,
      );
    }
  }

  build(): StreamAsset[] {
    return [...this.assets.values()];
  }
}

/** Timeline distance from `time` to the nearest moment an asset is on screen. */
export const assetDistance = (
  spans: readonly Span[],
  time: number,
  direction: number,
  behindWeight: number = STREAM_TUNING.behindWeight,
) => {
  let best = Infinity;
  spans.forEach(({ from, to }) => {
    let distance = 0;
    if (time < from) distance = (from - time) * (direction < 0 ? behindWeight : 1);
    else if (time > to) distance = (time - to) * (direction < 0 ? 1 : behindWeight);
    if (distance < best) best = distance;
  });
  return best;
};

export const assetPriority = (
  asset: StreamAsset,
  time: number,
  direction: number,
  tuning: StreamTuning = STREAM_TUNING,
) =>
  assetDistance(asset.spans, time, direction, tuning.behindWeight) +
  asset.level * tuning.levelStep;

export interface StreamPlan {
  /** Fetch these, most urgent first. */
  load: string[];
  /** Hold these; let go of anything else. */
  keep: Set<string>;
}

export const planStream = (
  assets: readonly StreamAsset[],
  time: number,
  direction: number,
  tuning: StreamTuning = STREAM_TUNING,
): StreamPlan => {
  const ranked = assets
    .map((asset) => ({ asset, priority: assetPriority(asset, time, direction, tuning) }))
    .sort((left, right) => left.priority - right.priority);
  const keep = new Set<string>();
  const load: string[] = [];
  let canvasFrames = 0;
  ranked.forEach(({ asset, priority }) => {
    if (priority > tuning.keepHorizon) return;
    if (asset.canvasFrame !== undefined) {
      if (canvasFrames >= tuning.canvasKeep) return;
      canvasFrames += 1;
    }
    keep.add(asset.url);
    if (priority <= tuning.loadHorizon) load.push(asset.url);
  });
  return { load, keep };
};

/**
 * The nearest index to `requested` whose files are all ready, lower index first
 * on a tie - the same rule the canvas uses for orbit frames. Null if none are.
 */
export const nearestReady = (
  requested: number,
  count: number,
  ready: (index: number) => boolean,
) => {
  const start = Math.min(Math.max(Math.round(requested), 0), count - 1);
  for (let distance = 0; distance < count; distance += 1) {
    const lower = start - distance;
    const upper = start + distance;
    if (lower >= 0 && ready(lower)) return lower;
    if (distance && upper < count && ready(upper)) return upper;
  }
  return null;
};

interface Entry {
  image: HTMLImageElement;
  ready: boolean;
  asset: StreamAsset;
}

export interface FrameStreamEvents {
  /** An asset has loaded (and, for an orbit frame, decoded). */
  onReady: (asset: StreamAsset, image: HTMLImageElement) => void;
  /** An asset the stream held has been let go of. */
  onRelease: (asset: StreamAsset) => void;
  /** An asset could not be loaded. */
  onError?: (asset: StreamAsset) => void;
}

/** How long an orbit frame waits on decode() before counting as loaded anyway. */
const DECODE_TIMEOUT_MS = 1200;

export class FrameStream {
  private assets = new Map<string, StreamAsset>();
  private entries = new Map<string, Entry>();
  private queue: string[] = [];
  private inFlight = 0;
  private time = 0;
  private direction = 1;
  private primes = new Map<string, HTMLImageElement[]>();
  private retries = new Map<HTMLElement, { urls: string[]; retry: () => void }>();
  private replanQueued = false;
  private disposed = false;

  constructor(
    private readonly events: FrameStreamEvents,
    private readonly tuning: StreamTuning = STREAM_TUNING,
  ) {}

  setSchedule(assets: readonly StreamAsset[]) {
    this.assets = new Map(assets.map((asset) => [asset.url, asset]));
    this.replan();
  }

  /** Where the scroll is, in timeline units, and which way it last moved. */
  seek(time: number, direction: number) {
    const heading = direction < 0 ? -1 : 1;
    if (Math.abs(time - this.time) < 0.01 && heading === this.direction) return;
    this.time = time;
    this.direction = heading;
    this.replan();
  }

  isReady(url: string) {
    return this.entries.get(url)?.ready === true;
  }

  /**
   * Gives an element its first src once that file is here. An element's first
   * frame has to be the one its beat opens on (see revealBaseSrc), and on the
   * portrait set nothing is requested before the stream asks for it.
   */
  prime(element: HTMLImageElement | null | undefined, url: string) {
    if (!element || element.hasAttribute("src")) return;
    if (this.isReady(url)) {
      element.src = url;
      return;
    }
    const waiting = this.primes.get(url) ?? [];
    waiting.push(element);
    this.primes.set(url, waiting);
  }

  /**
   * Calls `retry` once any of `urls` arrives. A layer that had to stand in a
   * neighbouring frame for one that wasn't here asks for this, so it catches up
   * even if the timeline never touches it again - a hold, say, which shows
   * whatever its element was last given. A newer request for the same element
   * replaces an older one.
   *
   * If the element is on screen, what it waits on jumps the queue, wherever the
   * plan put it. That is judged after the timeline has finished rendering: a
   * render can pass through an element's frames while briefly showing it - a
   * scrub back past where it appears, ScrollTrigger measuring the page - and
   * none of that is on screen.
   */
  retryWhenReady(element: HTMLElement, urls: string[], retry: () => void) {
    this.retries.set(element, { urls, retry });
    if (urls.some((url) => !this.entries.has(url))) this.replanSoon();
  }

  /** Drops a pending retry: the element got what it asked for. */
  settle(element: HTMLElement) {
    this.retries.delete(element);
  }

  /** What is held right now, for measuring. */
  counts() {
    let ready = 0;
    let canvas = 0;
    this.entries.forEach((entry) => {
      if (!entry.ready) return;
      ready += 1;
      if (entry.asset.canvasFrame !== undefined) canvas += 1;
    });
    return { ready, canvas, inFlight: this.inFlight };
  }

  dispose() {
    this.disposed = true;
    [...this.entries.keys()].forEach((url) => this.release(url));
    this.queue = [];
    this.primes.clear();
    this.retries.clear();
  }

  private replanSoon() {
    if (this.replanQueued) return;
    this.replanQueued = true;
    queueMicrotask(() => {
      this.replanQueued = false;
      this.replan();
    });
  }

  private replan() {
    if (this.disposed) return;
    const plan = planStream([...this.assets.values()], this.time, this.direction, this.tuning);
    // Anything an element is waiting on is wanted now, whatever the plan says.
    const waiting = [...this.retries]
      .filter(([element]) => element.style.visibility !== "hidden")
      .flatMap(([, pending]) => pending.urls);
    waiting.forEach((url) => plan.keep.add(url));
    [...this.entries.keys()].forEach((url) => {
      if (!plan.keep.has(url)) this.release(url);
    });
    this.queue = [...new Set([...waiting, ...plan.load])].filter(
      (url) => !this.entries.has(url),
    );
    this.pump();
  }

  private pump() {
    while (!this.disposed && this.inFlight < this.tuning.maxInFlight && this.queue.length) {
      const url = this.queue.shift();
      if (!url || this.entries.has(url)) continue;
      this.start(this.assets.get(url) ?? { url, spans: [], level: 0 });
    }
  }

  private start(asset: StreamAsset) {
    const image = new Image();
    image.decoding = "async";
    const entry: Entry = { image, ready: false, asset };
    this.entries.set(asset.url, entry);
    this.inFlight += 1;
    let settled = false;

    const finish = (loaded: boolean) => {
      if (settled) return;
      settled = true;
      image.onload = null;
      image.onerror = null;
      // Released while it was on its way: release() has already done the rest.
      if (this.entries.get(asset.url) !== entry) return;
      this.inFlight -= 1;
      if (loaded) {
        entry.ready = true;
        this.events.onReady(asset, image);
        this.primes.get(asset.url)?.forEach((element) => {
          if (!element.hasAttribute("src")) element.src = asset.url;
        });
        this.primes.delete(asset.url);
        [...this.retries].forEach(([key, pending]) => {
          if (!pending.urls.includes(asset.url)) return;
          this.retries.delete(key);
          pending.retry();
        });
      } else {
        this.entries.delete(asset.url);
        this.events.onError?.(asset);
      }
      this.pump();
    };

    image.onload = () => {
      if (asset.canvasFrame === undefined || typeof image.decode !== "function") {
        finish(Boolean(image.naturalWidth));
        return;
      }
      // drawImage decodes on the spot if it has to, so orbit frames are decoded
      // before they count as here - but a tab that isn't being painted can
      // leave decode() pending, so it only gets so long.
      const timer = window.setTimeout(() => finish(Boolean(image.naturalWidth)), DECODE_TIMEOUT_MS);
      void image.decode().then(
        () => {
          window.clearTimeout(timer);
          finish(true);
        },
        () => {
          window.clearTimeout(timer);
          finish(Boolean(image.naturalWidth));
        },
      );
    };
    image.onerror = () => finish(false);
    image.src = asset.url;
  }

  private release(url: string) {
    const entry = this.entries.get(url);
    if (!entry) return;
    this.entries.delete(url);
    if (!entry.ready) this.inFlight -= 1;
    entry.image.onload = null;
    entry.image.onerror = null;
    // Dropping the loader's reference is what lets the browser discard the
    // decoded pixels; clearing src also cancels a fetch still under way.
    entry.image.removeAttribute("src");
    if (entry.ready) this.events.onRelease(entry.asset);
  }
}
