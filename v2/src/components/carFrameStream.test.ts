import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FrameStream,
  STREAM_TUNING,
  StreamSchedule,
  assetDistance,
  assetPriority,
  frameLevel,
  nearestReady,
  planStream,
  type StreamAsset,
} from "./carFrameStream";

const url = (index: number) => `/f/${index}.webp`;

describe("car frame stream", () => {
  it("fetches every 4th frame of a move first, then halves the gaps", () => {
    const levels = Array.from({ length: 11 }, (_, position) => frameLevel(position, 10));
    expect(levels).toEqual([0, 2, 1, 2, 0, 2, 1, 2, 0, 2, 0]);
  });

  it("schedules a run frame by frame across the stretch it plays over", () => {
    const schedule = new StreamSchedule();
    schedule.run(url, 0, 4, 1, 2);
    const assets = schedule.build();
    expect(assets.map((asset) => asset.url)).toEqual([0, 1, 2, 3, 4].map(url));
    // Each frame owns the stretch it rounds to, clipped to the run.
    expect(assets[0].spans).toEqual([{ from: 1, to: 1.25 }]);
    expect(assets[2].spans).toEqual([{ from: 1.75, to: 2.25 }]);
    expect(assets[4].spans).toEqual([{ from: 2.75, to: 3 }]);
    expect(assets.map((asset) => asset.level)).toEqual([0, 2, 1, 2, 0]);
  });

  it("schedules a run played backwards from its last frame", () => {
    const schedule = new StreamSchedule();
    schedule.run(url, 4, 0, 0, 1);
    const [first] = schedule.build();
    // The frame the run opens on is the one it is on at its start.
    expect(first.url).toBe(url(4));
    expect(first.spans).toEqual([{ from: 0, to: 0.125 }]);
  });

  it("merges a file shown twice into one asset at its most urgent level", () => {
    const schedule = new StreamSchedule();
    schedule.run(url, 0, 4, 0, 1);
    schedule.add(url(1), 5, 6, 0);
    const asset = schedule.build().find((item) => item.url === url(1));
    expect(asset?.spans).toHaveLength(2);
    expect(asset?.level).toBe(0);
  });

  it("marks orbit frames so the canvas can draw them", () => {
    const schedule = new StreamSchedule();
    schedule.run(url, 108, 110, 0, 1, true);
    expect(schedule.build().map((asset) => asset.canvasFrame)).toEqual([108, 109, 110]);
  });

  it("measures distance ahead as is, and behind at a cost", () => {
    const spans = [{ from: 2, to: 3 }];
    expect(assetDistance(spans, 2.5, 1)).toBe(0);
    expect(assetDistance(spans, 1.5, 1)).toBe(0.5);
    expect(assetDistance(spans, 3.5, 1)).toBe(0.5 * STREAM_TUNING.behindWeight);
    // Scrolling up, what is above the scroll position is ahead.
    expect(assetDistance(spans, 3.5, -1)).toBe(0.5);
    expect(assetDistance(spans, 1.5, -1)).toBe(0.5 * STREAM_TUNING.behindWeight);
  });

  it("puts a coarse frame further ahead before a fine frame nearby", () => {
    const keyframe: StreamAsset = { url: "a", spans: [{ from: 0.5, to: 0.5 }], level: 0 };
    const between: StreamAsset = { url: "b", spans: [{ from: 0.2, to: 0.2 }], level: 2 };
    expect(assetPriority(keyframe, 0, 1)).toBeLessThan(assetPriority(between, 0, 1));
  });

  it("loads inside the load horizon, holds inside the keep horizon, and drops the rest", () => {
    const at = (name: string, time: number): StreamAsset => ({
      url: name,
      spans: [{ from: time, to: time }],
      level: 0,
    });
    const assets = [at("far", 3), at("near", 0.5), at("kept", 1.2), at("here", 0)];
    const plan = planStream(assets, 0, 1);
    expect(plan.load).toEqual(["here", "near"]);
    expect([...plan.keep].sort()).toEqual(["here", "kept", "near"]);
  });

  it("holds only the nearest few orbit frames, however many are close", () => {
    const schedule = new StreamSchedule();
    schedule.run(url, 0, 19, 0, 0.5, true);
    const plan = planStream(schedule.build(), 0, 1);
    const held = [...plan.keep];
    expect(held).toHaveLength(STREAM_TUNING.canvasKeep);
    expect(held).toContain(url(0));
  });

  it("falls back to the nearest ready frame, lower first on a tie", () => {
    const ready = new Set([2, 6]);
    expect(nearestReady(4, 10, (index) => ready.has(index))).toBe(2);
    expect(nearestReady(5, 10, (index) => ready.has(index))).toBe(6);
    expect(nearestReady(6, 10, (index) => ready.has(index))).toBe(6);
    expect(nearestReady(40, 10, (index) => ready.has(index))).toBe(6);
    expect(nearestReady(3, 10, () => false)).toBeNull();
  });
});

/** Just enough of an <img> for the stream: loads when the test says so. */
class FakeImage {
  static made: FakeImage[] = [];
  decoding = "";
  naturalWidth = 0;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  attributes = new Map<string, string>();
  constructor() {
    FakeImage.made.push(this);
  }
  set src(value: string) {
    this.attributes.set("src", value);
  }
  get src() {
    return this.attributes.get("src") ?? "";
  }
  hasAttribute(name: string) {
    return this.attributes.has(name);
  }
  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }
  removeAttribute(name: string) {
    this.attributes.delete(name);
  }
  decode() {
    return Promise.resolve();
  }
  load() {
    this.naturalWidth = 864;
    this.onload?.();
  }
}

describe("frame stream", () => {
  beforeEach(() => {
    FakeImage.made = [];
    vi.stubGlobal("Image", FakeImage);
  });
  afterEach(() => vi.unstubAllGlobals());

  const fetching = () =>
    FakeImage.made.filter((image) => image.hasAttribute("src")).map((image) => image.src);
  const loadAll = () => FakeImage.made.forEach((image) => image.hasAttribute("src") && image.load());

  const schedule = () => {
    const built = new StreamSchedule();
    built.run(url, 0, 39, 0, 4);
    return built.build();
  };

  it("fetches nearest first, a few at a time, and stops at the horizon", () => {
    const stream = new FrameStream({ onReady: () => {}, onRelease: () => {} });
    stream.setSchedule(schedule());
    // Six at once, keyframes first: 4 and 8 come before the 1 and 6 between.
    expect(fetching()).toEqual([0, 4, 2, 1, 8, 6].map(url));
    for (let round = 0; round < 20; round += 1) loadAll();
    // One viewport ahead at most, so nothing past frame 10 (time 1.0).
    expect(fetching().length).toBeLessThan(40);
    expect(fetching().every((src) => Number(src.match(/\d+/)![0]) <= 10)).toBe(true);
  });

  it("lets go of what the scroll has passed", () => {
    const released: string[] = [];
    const stream = new FrameStream({
      onReady: () => {},
      onRelease: (asset) => released.push(asset.url),
    });
    stream.setSchedule(schedule());
    for (let round = 0; round < 20; round += 1) loadAll();
    stream.seek(3, 1);
    expect(released).toContain(url(0));
    expect(stream.isReady(url(0))).toBe(false);
  });

  const element = (visibility: string) =>
    ({ style: { visibility } }) as unknown as HTMLElement;

  it("fetches a frame an element on screen is waiting on ahead of the plan", async () => {
    const stream = new FrameStream({ onReady: () => {}, onRelease: () => {} });
    stream.setSchedule(schedule());
    const retry = vi.fn();
    // Frame 39 is far outside the window, but something on screen needs it.
    stream.retryWhenReady(element("inherit"), [url(39)], retry);
    await Promise.resolve();
    // Next in line: it takes the first slot that frees up.
    FakeImage.made[0].load();
    const waiting = FakeImage.made.find((image) => image.src === url(39));
    expect(waiting).toBeDefined();
    waiting!.load();
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("leaves a hidden element's wait to the plan", async () => {
    const stream = new FrameStream({ onReady: () => {}, onRelease: () => {} });
    stream.setSchedule(schedule());
    stream.retryWhenReady(element("hidden"), [url(39)], () => {});
    await Promise.resolve();
    for (let round = 0; round < 20; round += 1) loadAll();
    expect(fetching()).not.toContain(url(39));
  });

  it("gives a primed element its first src once the file is here", () => {
    const stream = new FrameStream({ onReady: () => {}, onRelease: () => {} });
    const element = new FakeImage() as unknown as HTMLImageElement;
    stream.setSchedule(schedule());
    stream.prime(element, url(1));
    expect(element.hasAttribute("src")).toBe(false);
    FakeImage.made.find((image) => image.src === url(1))!.load();
    expect(element.getAttribute("src")).toBe(url(1));
  });
});

