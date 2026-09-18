import { describe, expect, it } from "vitest";

import {
  CARS,
  CURRENT_CAR,
  SITE_BACKGROUND,
  SITE_SURFACE,
  contrastRatio,
  liveryTheme,
  raiseContrast,
} from "./livery";

describe("contrastRatio", () => {
  it("matches WCAG reference values", () => {
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 5);
    expect(contrastRatio("#BC2121", "#0A0A0A")).toBeCloseTo(3.18, 2);
    expect(contrastRatio("#0A0A0A", "#BC2121")).toBeCloseTo(3.18, 2);
  });
});

describe("raiseContrast", () => {
  it("leaves colours that already pass untouched", () => {
    expect(raiseContrast("#26b0bd", SITE_SURFACE, 4.5)).toBe("#26B0BD");
  });

  it("lightens just past the target", () => {
    const lifted = raiseContrast("#AB0472", SITE_SURFACE, 4.5);
    expect(contrastRatio(lifted, SITE_SURFACE)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(lifted, SITE_SURFACE)).toBeLessThan(4.7);
  });
});

// Every car, including ones added next year, has to produce a readable theme.
describe.each(Object.entries(CARS))("%s livery", (_id, car) => {
  const theme = liveryTheme(car.livery);

  it("keeps text on the filled accent readable, hovered or not", () => {
    expect(contrastRatio(theme.onLivery, theme.livery)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(theme.onLivery, theme.liveryHover)).toBeGreaterThanOrEqual(
      contrastRatio(theme.onLivery, theme.livery),
    );
  });

  it("keeps text roles readable on the page and on surfaces", () => {
    for (const bg of [SITE_BACKGROUND, SITE_SURFACE]) {
      expect(contrastRatio(theme.liveryInk, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.liveryPop, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.liverySupport, bg)).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("liveryTheme", () => {
  it("puts dark text on light leads and white text on dark leads", () => {
    expect(liveryTheme({ ...CARS.sr26.livery, lead: "#FFD400" }).onLivery).toBe("#0a0a0a");
    const navy = liveryTheme({ ...CARS.sr26.livery, lead: "#122243" });
    expect(navy.onLivery).toBe("#ffffff");
    expect(contrastRatio(navy.liveryInk, SITE_SURFACE)).toBeGreaterThanOrEqual(4.5);
  });

  it("rejects a mid-tone lead no label colour can sit on", () => {
    expect(() => liveryTheme({ ...CARS.sr26.livery, lead: "#777777" })).toThrow(/mid-tone/);
  });

  it("uses SR26 as the current car", () => {
    expect(CURRENT_CAR).toBe("sr26");
  });
});
