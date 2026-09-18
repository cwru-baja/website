// Four-point projective maps, for putting a flat canvas onto the dash screen.
//
// The screen is a quad seen in slight perspective (its bottom edge is ~1.8%
// wider than its top), so a scaled rectangle lands up to 3px off at the corners.
// A 3x3 homography through the four corners is exact, and CSS matrix3d can carry
// one: the 2D map lives in the x/y/w rows of the 4x4, with z left as identity.

export type Point = readonly [number, number];
/** Corners in the order TL, TR, BR, BL. */
export type Quad = readonly [Point, Point, Point, Point];
/** Row-major 3x3, normalised so the last entry is 1. */
export type Homography = readonly [number, number, number, number, number, number, number, number, number];

function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) throw new Error("homography: corners are degenerate (three in a line?)");
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

/** The map taking each `src` corner to the matching `dst` corner. */
export function homography(src: Quad, dst: Quad): Homography {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i];
    const [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  const h = solve(A, b);
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

export function project(h: Homography, x: number, y: number): Point {
  const w = h[6] * x + h[7] * y + h[8];
  return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w];
}

/**
 * CSS `matrix3d(...)` for an element whose own box starts at 0,0, with
 * `transform-origin: 0 0`. matrix3d takes its 16 numbers column by column, so
 * the 3x3's rows come out transposed around an identity z.
 */
export function toMatrix3d(h: Homography): string {
  const [a, b, c, d, e, f, g, hh, i] = h;
  const n = [a / i, d / i, 0, g / i, b / i, e / i, 0, hh / i, 0, 0, 1, 0, c / i, f / i, 0, 1];
  return `matrix3d(${n.map((v) => +v.toPrecision(10)).join(",")})`;
}

export const scaleQuad = (q: Quad, s: number): Quad =>
  q.map(([x, y]) => [x * s, y * s] as const) as unknown as Quad;
