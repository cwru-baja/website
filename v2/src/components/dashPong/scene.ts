// What the dash screen shows for a game state, as boxes for raster.ts.
//
// Livery colours for what you play with - the car's teal on both paddles, its
// magenta on the ball - and the dash's own white for the score, so only the
// things that move are in colour. Colours are the livery's sRGB values; the
// screen's view transform is applied later, in raster.ts, as it is to the dash.
//
// The ball is the livery's contrast-safe magenta, not the raw paint: through
// the screen's transform the paint lands at 3.6:1 on the black panel, too dim
// to follow a few-pixel ball, where the site's `liveryPop` reaches 5.9:1.

// Relative, not "@/": vitest has no alias config, and this module is pure enough to test.
import { CARS, CURRENT_CAR, CURRENT_THEME } from "../../lib/livery";
import { ballRect, H, paddleRect, W, type GameState, type Side } from "./engine";
import { DIGIT_COLS, DIGITS } from "./font";
import { hexRgb, type Rect, type Rgb } from "./raster";

const PADDLE = hexRgb(CARS[CURRENT_CAR].livery.lead);
const BALL = hexRgb(CURRENT_THEME.liveryPop);
const SCORE: Rgb = [1, 1, 1];
// Dim, so the ball never gets lost against it on its way across.
const NET: Rgb = [0.3, 0.3, 0.3];
const BANNER: Rgb = [1, 1, 1];

/** Who sits on the right, for the end banner. */
export type Opponent = "cpu" | "p2";

// The board's digits are 16 px of its 375 wide; 5 texels a cell keeps that share.
const CELL = 5;
const SCORE_TOP = 14;
const SCORE_GAP = 44; // from the net to each score's inner edge
const NET_W = 3, NET_DASH = 8, NET_GAP = 8;

/** Merge each row's run of lit cells into one box: fewer boxes, no seams inside a run. */
function cells(grid: readonly (readonly (0 | 1)[])[], x: number, y: number, cell: number, color: Rgb, out: Rect[]) {
  grid.forEach((row, r) => {
    let start = -1;
    for (let c = 0; c <= row.length; c++) {
      const lit = c < row.length && row[c] === 1;
      if (lit && start < 0) start = c;
      if (!lit && start >= 0) {
        out.push({ x: x + start * cell, y: y + r * cell, w: (c - start) * cell, h: cell, color });
        start = -1;
      }
    }
  });
}

/** A score as the board drew it: no leading zero, a tens digit is its "1". */
function score(value: number, side: Side, out: Rect[]) {
  const digits = String(Math.max(0, Math.min(99, value))).split("").map(Number);
  const width = digits.length * DIGIT_COLS * CELL + (digits.length - 1) * CELL;
  let x = side === 0 ? W / 2 - SCORE_GAP - width : W / 2 + SCORE_GAP;
  for (const d of digits) {
    cells(DIGITS[d], x, SCORE_TOP, CELL, SCORE, out);
    x += (DIGIT_COLS + 1) * CELL;
  }
}

// 5-row letters for the banner, variable width; only the ones it needs.
const LETTERS: Record<string, readonly string[]> = {
  Y: ["#.#", "#.#", ".#.", ".#.", ".#."],
  O: ["###", "#.#", "#.#", "#.#", "###"],
  U: ["#.#", "#.#", "#.#", "#.#", "###"],
  W: ["#...#", "#...#", "#.#.#", "#.#.#", ".#.#."],
  I: ["###", ".#.", ".#.", ".#.", "###"],
  N: ["#..#", "##.#", "#.##", "#..#", "#..#"],
  S: ["###", "#..", "###", "..#", "###"],
  C: ["###", "#..", "#..", "#..", "###"],
  P: ["###", "#.#", "###", "#..", "#.."],
  "1": [".#.", "##.", ".#.", ".#.", "###"],
  "2": ["###", "..#", "###", "#..", "###"],
  " ": ["..", "..", "..", "..", ".."],
};
const glyph = (ch: string) => LETTERS[ch].map((row) => [...row].map((c) => (c === "#" ? 1 : 0)) as (0 | 1)[]);

function banner(text: string, cell: number, out: Rect[]) {
  const glyphs = [...text].map(glyph);
  const width = glyphs.reduce((sum, g) => sum + g[0].length * cell, 0) + (glyphs.length - 1) * cell;
  let x = W / 2 - width / 2;
  const y = H / 2 - (5 * cell) / 2;
  for (const g of glyphs) {
    cells(g, x, y, cell, BANNER, out);
    x += (g[0].length + 1) * cell;
  }
}

export function winnerText(winner: Side, opponent: Opponent) {
  if (opponent === "cpu") return winner === 0 ? "YOU WIN" : "CPU WINS";
  return winner === 0 ? "P1 WINS" : "P2 WINS";
}

export function scene(state: GameState, opponent: Opponent): Rect[] {
  const out: Rect[] = [];
  const over = state.phase === "over";

  // The net goes with the result: the banner sits across it and they'd tangle.
  for (let y = NET_GAP / 2; !over && y < H; y += NET_DASH + NET_GAP) {
    out.push({ x: W / 2 - NET_W / 2, y, w: NET_W, h: Math.min(NET_DASH, H - y), color: NET });
  }
  score(state.score[0], 0, out);
  score(state.score[1], 1, out);
  for (const side of [0, 1] as const) out.push({ ...paddleRect(state, side), color: PADDLE });

  if (over && state.winner !== null) {
    banner(winnerText(state.winner, opponent), 5, out);
    return out;
  }
  // Straight after a point the ball has gone off the edge; then it waits at the
  // net, blinking, until it's served.
  if (state.phase === "point") return out;
  if (state.phase === "play" || Math.floor(state.time * 4) % 2 === 0) {
    const ball = ballRect(state);
    // The frame time left over after the last whole tick, so motion is even on
    // displays whose refresh doesn't divide the 240 Hz tick.
    const ahead = state.phase === "play" ? state.accumulator : 0;
    out.push({ ...ball, x: ball.x + state.ball.vx * ahead, y: ball.y + state.ball.vy * ahead, color: BALL });
  }
  return out;
}
