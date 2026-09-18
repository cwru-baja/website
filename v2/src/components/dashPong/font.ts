/**
 * Pong's score digits. The board draws them with a 7448 BCD-to-seven-segment
 * decoder gated onto the screen: each digit is 16 px by 32 lines, built from
 * blocks 4 px wide and 4 lines tall (Edwards, figure 9). So a digit is a 4 x 8
 * grid of square cells here. On the board's screen a cell was a little narrower
 * than tall (about 0.9:1), so its digits read slightly thinner than these.
 *
 * Two things set the look apart from a calculator: the middle bar sits above
 * the halfway line, in the 4th row of 8, and the 7448 draws 6 and 9 without
 * their tails - no top bar on the 6, no bottom bar on the 9. A tens digit is
 * the same "1" (the board feeds the decoder a 1), and a leading zero is blank.
 */

export const DIGIT_COLS = 4;
export const DIGIT_ROWS = 8;

export type Segment = "a" | "b" | "c" | "d" | "e" | "f" | "g";

/** Each segment's cells in the grid: the board's segment map. */
export const SEGMENTS: Record<
  Segment,
  { col: number; row: number; cols: number; rows: number }
> = {
  a: { col: 0, row: 0, cols: 4, rows: 1 },
  b: { col: 3, row: 0, cols: 1, rows: 4 },
  c: { col: 3, row: 4, cols: 1, rows: 4 },
  d: { col: 0, row: 7, cols: 4, rows: 1 },
  e: { col: 0, row: 4, cols: 1, rows: 4 },
  f: { col: 0, row: 0, cols: 1, rows: 4 },
  g: { col: 0, row: 3, cols: 4, rows: 1 },
};

/** Segments the 7448 lights for 0-9. */
export const DIGIT_SEGMENTS: readonly (readonly Segment[])[] = [
  ["a", "b", "c", "d", "e", "f"],
  ["b", "c"],
  ["a", "b", "d", "e", "g"],
  ["a", "b", "c", "d", "g"],
  ["b", "c", "f", "g"],
  ["a", "c", "d", "f", "g"],
  ["c", "d", "e", "f", "g"],
  ["a", "b", "c"],
  ["a", "b", "c", "d", "e", "f", "g"],
  ["a", "b", "c", "f", "g"],
];

// The same digits cell by cell, drawn out so they can be checked by eye.
const ART = [
  ["####", "#..#", "#..#", "#..#", "#..#", "#..#", "#..#", "####"],
  ["...#", "...#", "...#", "...#", "...#", "...#", "...#", "...#"],
  ["####", "...#", "...#", "####", "#...", "#...", "#...", "####"],
  ["####", "...#", "...#", "####", "...#", "...#", "...#", "####"],
  ["#..#", "#..#", "#..#", "####", "...#", "...#", "...#", "...#"],
  ["####", "#...", "#...", "####", "...#", "...#", "...#", "####"],
  ["#...", "#...", "#...", "####", "#..#", "#..#", "#..#", "####"],
  ["####", "...#", "...#", "...#", "...#", "...#", "...#", "...#"],
  ["####", "#..#", "#..#", "####", "#..#", "#..#", "#..#", "####"],
  ["####", "#..#", "#..#", "####", "...#", "...#", "...#", "...#"],
];

/** DIGITS[n][row][col] is 1 where digit n is lit. */
export const DIGITS: readonly (readonly (readonly (0 | 1)[])[])[] = ART.map(
  (rows) => rows.map((row) => [...row].map((cell) => (cell === "#" ? 1 : 0))),
);
