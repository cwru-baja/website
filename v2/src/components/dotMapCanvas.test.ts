import { describe, expect, it } from "vitest";
import { BASE_R, HOVER_RADIUS, MAX_R, bulgeRect, dotRadius, fadeAlpha } from "./dotMapCanvas";

describe("dotRadius", () => {
  it("is largest under the cursor and falls to the base radius at the edge", () => {
    expect(dotRadius(0)).toBe(MAX_R);
    expect(dotRadius(HOVER_RADIUS / 2)).toBeCloseTo((BASE_R + MAX_R) / 2);
    expect(dotRadius(HOVER_RADIUS)).toBe(BASE_R);
    expect(dotRadius(40)).toBe(BASE_R);
  });
});

describe("fadeAlpha", () => {
  it("holds at 0 until the dot's delay, then eases out to 1", () => {
    expect(fadeAlpha(100, 200)).toBe(0);
    expect(fadeAlpha(200, 200)).toBe(0);
    expect(fadeAlpha(350, 200)).toBeCloseTo(0.75); // power2.out at p = 0.5
    expect(fadeAlpha(500, 200)).toBe(1);
    expect(fadeAlpha(5000, 200)).toBe(1);
  });
});

describe("bulgeRect", () => {
  const scale = 25; // device px per viewBox unit
  const reach = (HOVER_RADIUS + MAX_R) * scale;

  it("covers every dot the cursor can enlarge, on whole pixels", () => {
    const [x, y, w, h] = bulgeRect(1000.5, 700.5, scale, 2800, 1500)!;
    expect(Number.isInteger(x) && Number.isInteger(y)).toBe(true);
    expect(x).toBeLessThanOrEqual(1000.5 - reach);
    expect(y).toBeLessThanOrEqual(700.5 - reach);
    expect(x + w).toBeGreaterThanOrEqual(1000.5 + reach);
    expect(y + h).toBeGreaterThanOrEqual(700.5 + reach);
  });

  it("is clamped to the canvas", () => {
    expect(bulgeRect(5, 5, scale, 2800, 1500)!.slice(0, 2)).toEqual([0, 0]);
    const [x, y, w, h] = bulgeRect(2795, 1495, scale, 2800, 1500)!;
    expect([x + w, y + h]).toEqual([2800, 1500]);
  });

  it("is null when the cursor's reach misses the canvas", () => {
    expect(bulgeRect(-1000, 50, scale, 2800, 1500)).toBeNull();
  });
});
