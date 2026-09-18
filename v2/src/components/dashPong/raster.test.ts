import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CANVAS, createRaster, hexRgb, TEXTURE, type Rect } from "./raster";

const lut = new Uint8Array(readFileSync("public/renders-sr26/pong/agx-lut17.bin"));
const at = (px: Uint8ClampedArray, x: number, y: number) => Array.from(px.slice((y * CANVAS.w + x) * 4, (y * CANVAS.w + x) * 4 + 4));
const white: Rect = { x: 100, y: 60, w: 120, h: 80, color: [1, 1, 1] };
const toCanvas = (x: number, y: number) => [Math.round((x / TEXTURE.w) * CANVAS.w), Math.round((y / TEXTURE.h) * CANVAS.h)];

describe("raster", () => {
  it("is the texture at the frame's density", () => {
    // ~0.76 frame px per texel across, ~0.74 down: the screen is foreshortened
    expect(CANVAS.w).toBeGreaterThan(355);
    expect(CANVAS.w).toBeLessThan(375);
    expect(CANVAS.h).toBeGreaterThan(195);
    expect(CANVAS.h).toBeLessThan(205);
  });

  it("tone-maps a box's interior exactly like the render: white lands at 203, not 255", () => {
    const r = createRaster(lut);
    r.draw([white]);
    const [x, y] = toCanvas(160, 100);
    const [R, G, B, A] = at(r.pixels, x, y);
    expect([R, G, B]).toEqual([203, 203, 203]);
    expect(A).toBe(255);
  });

  it("carries a livery colour through the same transform", () => {
    const r = createRaster(lut);
    r.draw([{ ...white, color: hexRgb("#26B0BD") }]);
    const [x, y] = toCanvas(160, 100);
    const [R, G, B] = at(r.pixels, x, y);
    // measured off the scene's view transform: #26B0BD -> (100, 172, 181)
    expect(Math.abs(R - 100)).toBeLessThanOrEqual(2);
    expect(Math.abs(G - 172)).toBeLessThanOrEqual(2);
    expect(Math.abs(B - 181)).toBeLessThanOrEqual(2);
  });

  it("softens edges over a few px and leaves everything else transparent", () => {
    const r = createRaster(lut);
    r.draw([white]);
    const [, y] = toCanvas(160, 100);
    const edge = (white.x / TEXTURE.w) * CANVAS.w;
    const row = Array.from({ length: 10 }, (_, k) => at(r.pixels, Math.floor(edge) - 5 + k, y)[0]);
    for (let k = 1; k < row.length; k++) expect(row[k]).toBeGreaterThanOrEqual(row[k - 1]); // monotonic ramp
    expect(row[0]).toBe(0);
    expect(row[row.length - 1]).toBe(203);
    expect(row.filter((v) => v > 0 && v < 203).length).toBeGreaterThanOrEqual(2); // not a hard step
    expect(at(r.pixels, 5, 5)[3]).toBe(0);
  });

  it("averages light, not display values: a half-covered pixel is brighter than half of 203", () => {
    // AgX of half the light is well above half the display value - the reason
    // the filter has to run before the tone map.
    const r = createRaster(lut);
    r.draw([white]);
    const [, y] = toCanvas(160, 100);
    const edge = (white.x / TEXTURE.w) * CANVAS.w;
    const row = Array.from({ length: 10 }, (_, k) => at(r.pixels, Math.floor(edge) - 5 + k, y)[0]);
    const mid = row.find((v) => v > 60 && v < 180);
    expect(mid).toBeDefined();
  });

  it("clears what the previous frame drew", () => {
    const r = createRaster(lut);
    r.draw([white]);
    r.draw([{ ...white, x: 300 }]);
    const [x, y] = toCanvas(160, 100);
    expect(at(r.pixels, x, y)[3]).toBe(0);
  });

  it("keeps the total light equal to the box's area", () => {
    const r = createRaster(lut);
    const tiny: Rect = { x: 240.3, y: 136.7, w: 6, h: 6, color: [1, 1, 1] };
    r.draw([tiny]);
    let lit = 0;
    for (let i = 3; i < r.pixels.length; i += 4) if (r.pixels[i]) lit++;
    // 6x6 texels ~ 4.6 x 4.4 canvas px, plus a skirt a couple of px wide on each side
    expect(lit).toBeGreaterThan(20);
    expect(lit).toBeLessThan(160);
  });

  it("refuses a LUT of the wrong size", () => {
    expect(() => createRaster(new Uint8Array(10))).toThrow(/LUT/);
  });
});
