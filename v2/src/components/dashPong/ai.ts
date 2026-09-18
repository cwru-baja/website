/**
 * The computer opponent. It turns what it can see in the game state into a
 * paddle input; it never changes the state and keeps none of its own. What
 * would be its memory - when it last re-planned, which way it guessed wrong -
 * comes from the game's clock and a hash of the game's seed, so a replayed game
 * plays out the same.
 *
 * It is meant to lose sometimes. It only starts tracking a ball once the ball
 * has come some way across, re-plans in steps rather than continuously,
 * misjudges by more the faster the ball is, and moves slower than the steepest
 * fast balls need.
 */
import {
  H,
  paddleFront,
  type GameState,
  type PaddleInput,
  type Side,
} from "./engine";

export interface AiParams {
  // 0 is easiest, 1 hardest.
  difficulty?: number;
}

/**
 * Pairs are [at difficulty 0, at difficulty 1]; difficulties between are
 * interpolated. Tuned against a scripted player that returns every ball at a
 * random angle: at 0.5 the AI returns ~97% of balls at the first speed, ~65% at
 * the second and ~37% at the third.
 */
export const AI_TUNING = {
  // Paddle speed cap, px/s. At the top ball speed the default AI watches the
  // ball for ~0.5 s, enough to move ~100 px - short of the 118 px from the
  // middle to either end, so the steepest fast balls beat it.
  speed: [140, 240],
  // Share of the court, from the far paddle, the ball has to have covered
  // before the AI starts tracking it. Until then it drifts back to the middle.
  react: [0.65, 0.35],
  // Seconds between re-plans. Each takes a fresh guess at the aiming error.
  replan: [0.4, 0.12],
  // Largest aiming error, px, with the ball at the first speed and at the top
  // one; in between it follows the ball's speed. The paddle catches anything
  // within 21 px of its centre.
  errorSlow: [50, 12],
  errorFast: [190, 60],
  // Share of the error the AI has worked out by the time the ball arrives: it
  // reads the ball better as it comes closer, but the late corrections are the
  // ones its speed cap cannot always make.
  settle: 0.5,
  // Share of its speed it drifts back to the middle with.
  drift: 0.5,
};

const clamp = (value: number, min: number, max: number) =>
  value < min ? min : value > max ? max : value;

// murmur3's finaliser: every input bit flips about half the output bits.
const mix = (value: number) => {
  let h = value | 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
};

/** A repeatable number in [-1, 1) for a combination of integer keys. */
export const noise = (...keys: number[]) => {
  let h = 0x9e3779b9;
  for (const key of keys) h = mix(h ^ mix(key));
  return (h / 4294967296) * 2 - 1;
};

// Reflects a straight-line y back into [min, max], as the walls would.
const fold = (y: number, min: number, max: number) => {
  const span = max - min;
  let u = (y - min) % (2 * span);
  if (u < 0) u += 2 * span;
  return min + (u <= span ? u : 2 * span - u);
};

/**
 * Where the ball's centre will be when it reaches a paddle's front face,
 * counting wall bounces on the way. Null when the ball is not heading there.
 */
export const interceptY = (state: GameState, side: Side): number | null => {
  const { ball, tuning } = state;
  const toward = side === 0 ? ball.vx < 0 : ball.vx > 0;
  if (!toward) return null;
  const r = tuning.ballSize / 2;
  const x = paddleFront(tuning, side) + (side === 0 ? r : -r);
  const time = Math.max(0, (x - ball.x) / ball.vx);
  return fold(ball.y + ball.vy * time, r, H - r);
};

export const aiInput = (
  state: GameState,
  side: Side,
  params: AiParams = {},
): PaddleInput => {
  const d = clamp(params.difficulty ?? 0.5, 0, 1);
  const at = ([easy, hard]: number[]) => easy + (hard - easy) * d;
  const speed = at(AI_TUNING.speed);
  const home: PaddleInput = {
    kind: "target",
    y: H / 2,
    maxSpeed: speed * AI_TUNING.drift,
  };
  if (state.phase !== "play") return home;

  const intercept = interceptY(state, side);
  if (intercept === null) return home;

  const { ball, tuning } = state;
  const far = paddleFront(tuning, side === 0 ? 1 : 0);
  const covered = (ball.x - far) / (paddleFront(tuning, side) - far);
  const react = at(AI_TUNING.react);
  if (covered < react) return home;

  const first = tuning.speeds[0];
  const top = tuning.speeds[tuning.speeds.length - 1];
  const pace = Math.max(
    0,
    (Math.hypot(ball.vx, ball.vy) - first) / (top - first),
  );
  const slow = at(AI_TUNING.errorSlow);
  const spread = slow + (at(AI_TUNING.errorFast) - slow) * pace;
  const closing = clamp((covered - react) / (1 - react), 0, 1);
  const plan = Math.floor(state.time / at(AI_TUNING.replan));
  const error =
    noise(state.seed, side, state.points, state.rally, plan) *
    spread *
    (1 - AI_TUNING.settle * closing);

  return { kind: "target", y: intercept + error, maxSpeed: speed };
};
