import { describe, expect, it } from "vitest";
import {
  SCRUB_PAGE,
  SCRUB_STEP,
  clampProgress,
  progressForKey,
  progressFromPointer,
  scrollForProgress,
  scrubPercent,
} from "./carScrubber";

const RAIL = { left: 100, width: 800 };

describe("progressFromPointer", () => {
  it("reads a pointer as a fraction of the rail", () => {
    expect(progressFromPointer(500, RAIL)).toBeCloseTo(0.5);
    expect(progressFromPointer(300, RAIL)).toBeCloseTo(0.25);
  });

  it("clamps a pointer dragged off either end", () => {
    expect(progressFromPointer(-40, RAIL)).toBe(0);
    expect(progressFromPointer(4000, RAIL)).toBe(1);
  });

  it("reports the start rather than NaN before the rail has a width", () => {
    expect(progressFromPointer(500, { left: 0, width: 0 })).toBe(0);
  });
});

describe("scrollForProgress", () => {
  it("maps the ends of the rail onto the ends of the pin", () => {
    expect(scrollForProgress(0, 1200, 9200)).toBe(1200);
    expect(scrollForProgress(1, 1200, 9200)).toBe(9200);
  });

  it("lands on a whole pixel in between", () => {
    expect(scrollForProgress(0.5, 1200, 9201)).toBe(5201);
  });

  it("clamps a progress from outside the rail", () => {
    expect(scrollForProgress(-2, 1200, 9200)).toBe(1200);
    expect(scrollForProgress(9, 1200, 9200)).toBe(9200);
  });
});

describe("progressForKey", () => {
  it("steps left and right by one step", () => {
    expect(progressForKey("ArrowRight", 0.5)).toBeCloseTo(0.5 + SCRUB_STEP);
    expect(progressForKey("ArrowLeft", 0.5)).toBeCloseTo(0.5 - SCRUB_STEP);
  });

  it("pages by the larger step", () => {
    expect(progressForKey("PageUp", 0.5)).toBeCloseTo(0.5 + SCRUB_PAGE);
    expect(progressForKey("PageDown", 0.5)).toBeCloseTo(0.5 - SCRUB_PAGE);
  });

  it("jumps to the bounds", () => {
    expect(progressForKey("Home", 0.5)).toBe(0);
    expect(progressForKey("End", 0.5)).toBe(1);
  });

  it("stops at the bounds rather than running past them", () => {
    expect(progressForKey("ArrowLeft", 0)).toBe(0);
    expect(progressForKey("ArrowRight", 1)).toBe(1);
  });

  it("leaves up and down to the page, which scrubs by scrolling anyway", () => {
    expect(progressForKey("ArrowUp", 0.5)).toBeNull();
    expect(progressForKey("ArrowDown", 0.5)).toBeNull();
    expect(progressForKey("Tab", 0.5)).toBeNull();
    expect(progressForKey(" ", 0.5)).toBeNull();
  });
});

describe("scrubPercent", () => {
  it("rounds to a whole percent for the value it announces", () => {
    expect(scrubPercent(0)).toBe(0);
    expect(scrubPercent(0.333)).toBe(33);
    expect(scrubPercent(1)).toBe(100);
  });
});

describe("clampProgress", () => {
  it("holds the playhead inside the sequence", () => {
    expect(clampProgress(-1)).toBe(0);
    expect(clampProgress(2)).toBe(1);
    expect(clampProgress(0.4)).toBe(0.4);
  });
});
