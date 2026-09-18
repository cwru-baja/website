import { describe, expect, it } from "vitest";
import { homography, project, toMatrix3d, type Quad } from "./homography";
import screen from "./screen.json";

const box = (w: number, h: number): Quad => [[0, 0], [w, 0], [w, h], [0, h]];

describe("homography", () => {
  it("sends each corner to its partner", () => {
    const dst: Quad = [[512, 300], [806, 322], [792, 505], [528, 476]];
    const h = homography(box(320, 180), dst);
    box(320, 180).forEach(([x, y], i) => {
      const [u, v] = project(h, x, y);
      expect(u).toBeCloseTo(dst[i][0], 6);
      expect(v).toBeCloseTo(dst[i][1], 6);
    });
  });

  it("is truly projective: the box's centre is not the quad's centroid", () => {
    const dst: Quad = [[0, 0], [100, 10], [100, 90], [0, 100]];
    const [u] = project(homography(box(100, 100), dst), 50, 50);
    expect(Math.abs(u - 50)).toBeGreaterThan(1);
  });

  it("inverts by swapping the corners", () => {
    const q = screen.textureCorners as unknown as Quad;
    const fwd = homography(box(480, 272), q);
    const back = homography(q, box(480, 272));
    for (const [x, y] of [[0, 0], [240, 136], [480, 272], [37, 251]] as const) {
      const [u, v] = project(fwd, x, y);
      const [x2, y2] = project(back, u, v);
      expect(x2).toBeCloseTo(x, 6);
      expect(y2).toBeCloseTo(y, 6);
    }
  });

  it("rejects corners that collapse to a line", () => {
    expect(() => homography(box(10, 10), [[0, 0], [5, 5], [10, 10], [2, 2]])).toThrow(/degenerate/);
  });

  it("writes matrix3d column by column with an identity z", () => {
    const h = homography(box(1, 1), [[2, 3], [5, 3], [5, 7], [2, 7]]); // plain scale + translate
    const n = toMatrix3d(h).slice("matrix3d(".length, -1).split(",").map(Number);
    expect(n).toHaveLength(16);
    expect(n[0]).toBeCloseTo(3); //  x scale
    expect(n[5]).toBeCloseTo(4); //  y scale
    expect(n[10]).toBe(1); //       z untouched
    expect(n[12]).toBeCloseTo(2); // translate x
    expect(n[13]).toBeCloseTo(3); // translate y
    expect(n[15]).toBe(1);
  });
});
