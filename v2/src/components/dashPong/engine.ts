/**
 * Pong for the steering wheel's dash screen, as data. Nothing here draws, reads
 * keys or owns a clock: the caller hands `step` a frame time and both paddles'
 * inputs, and draws whatever state comes back.
 *
 * The rules are the 1972 arcade board's, read off its schematics (Edwards,
 * "Reconstructing Pong on an FPGA", 2012; Holden, "Atari Pong E circuit
 * analysis"): a paddle split into eight segments, three ball speeds that step up
 * on a rally's 4th and 12th hits, and a serve from the net towards whoever just
 * missed. Sizes and speeds are rescaled to the panel.
 *
 * `step` is pure - it never touches the state it is given and returns a new one
 * - so a game replays exactly from its seed, its inputs and its frame times.
 *
 * Units are panel pixels and seconds, with y pointing down. Positions are
 * centres: `ball.x/y` is the middle of the ball and `paddles[n].y` the middle of
 * a paddle. Side 0 is the player on the left, side 1 the opponent on the right.
 */

/** The dash panel's native resolution: the playfield is the whole panel. */
export const W = 480;
export const H = 272;

/**
 * Everything worth adjusting. Where a value comes from the arcade board, the
 * board's own figure is given in its units: px (1/375 of its visible width) and
 * lines (1/246 of its visible height), at 60 fields a second.
 */
export const TUNING = {
  // Internal physics rate. At 240 Hz a ball at top speed moves under 2 px a
  // tick, and 60, 120 and 240 Hz displays all get a whole number of ticks.
  tick: 1 / 240,
  // Longest frame `step` will simulate. A tab back from the background hands
  // over seconds at once; this plays 100 ms of them and drops the rest.
  maxFrame: 0.1,

  // The board's ball is 4 px by 4 lines and its paddles 4 px by 15 lines. The
  // ball stays as wide as a paddle; the paddle is twice the board's share of
  // the height, because the panel is shown a few hundred CSS pixels wide and
  // the board's 6% paddle is a hard target at that size.
  ballSize: 6,
  paddleWidth: 6,
  paddleHeight: 36,
  // Open court behind each paddle. The board left ~50 px (13% of its width);
  // this is less, but still shows a miss sail past before the point is given.
  paddleInset: 24,
  // How far short of the top and bottom the paddles stop. The board's never
  // reached the top edge; zero leaves that quirk out.
  reachInset: 0,

  // Horizontal ball speed. The board has three, stepping up on a rally's 4th
  // and 12th hits and back to the first after a point: 2, 3 and 4 px a field.
  // These keep its paddle-to-paddle crossing times, about 2.1, 1.4 and 1.05 s.
  speeds: [200, 300, 400],
  speedUpAt: [4, 12],

  // Vertical speed of a return, by where it met the paddle, listed from the
  // centre out. The board splits the paddle into eight segments: the middle two
  // return flat, the three either side leave at 1, 2 and 3 lines a field. One
  // line a field is about a quarter of the height a second, here as there.
  segmentVy: [0, 66, 132, 198],
  // Not the board's: a return also picks up this share of the paddle's own
  // vertical speed, capped - enough to bend an angle a little, never to aim.
  english: 0.08,
  englishMax: 33,
  // Steepest a ball may leave a paddle, in degrees from horizontal. Only
  // english or an override can get near it, but a ball that bounced wall to
  // wall would stall the rally, so nothing gets past it.
  maxAngle: 55,

  // Pause after a point, then the ball waits at the net before it is served.
  // The board's single 555 serve timer ran about 1.5-1.7 s.
  pointDelay: 0.6,
  serveDelay: 0.8,
  // A serve leaves the net at the first speed, this many degrees off flat,
  // either way. The board kept whatever angle the missed ball had.
  serveAngle: [10, 30],
  // Share of the height, around the middle, the serve can start anywhere in.
  serveBand: 0.5,

  // Paddle speeds. A held key crosses the paddle's whole travel in about
  // 0.65 s; a pointer is followed faster but never more than 3.75 px a tick,
  // under the ball's size, so it cannot jump over a ball.
  keySpeed: 360,
  pointerSpeed: 900,
};

export type Tuning = typeof TUNING;

export type Side = 0 | 1;

/**
 *   serve  the ball waits at the net for `timer` seconds
 *   play   the ball is live
 *   point  a point was just scored; `timer` seconds until the next serve
 *   over   someone reached the winning score; the ball has stopped
 * Paddles move in every phase.
 */
export type Phase = "serve" | "play" | "point" | "over";

/**
 * What drives a paddle for a step. A target is followed at up to the pointer
 * speed, or a lower `maxSpeed` - the computer opponent's way of staying
 * beatable.
 */
export type PaddleInput =
  | { kind: "axis"; dir: -1 | 0 | 1 }
  | { kind: "target"; y: number; maxSpeed?: number }
  | { kind: "none" };

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface Paddle {
  y: number;
  // Speed over the last tick; a return picks up its english from it.
  vy: number;
}

export interface GameState {
  tuning: Tuning;
  winScore: number;
  seed: number;
  phase: Phase;
  // Seconds left in a serve or point pause; 0 otherwise.
  timer: number;
  score: [number, number];
  ball: Ball;
  paddles: [Paddle, Paddle];
  // Who the next (or current) serve goes to.
  serveTo: Side;
  // Paddle returns so far this point.
  rally: number;
  // Points played so far.
  points: number;
  winner: Side | null;
  // Seconds simulated since the game was created.
  time: number;
  // Frame time not yet simulated, under one tick. A renderer can extrapolate
  // the ball by this much if it wants motion smoother than the tick rate.
  accumulator: number;
  rng: number;
}

/** What happened during a step, in order, stamped with the simulated time. */
export type GameEvent =
  | { type: "serve"; to: Side; time: number }
  | {
      type: "hit";
      side: Side;
      rally: number;
      level: number;
      speed: number;
      time: number;
    }
  // The ball clipped the top or bottom of a paddle it had already got past.
  | { type: "edge"; side: Side; time: number }
  | { type: "wall"; wall: "top" | "bottom"; time: number }
  | { type: "score"; side: Side; score: [number, number]; time: number }
  | { type: "over"; winner: Side; time: number };

export interface StepResult {
  state: GameState;
  events: GameEvent[];
}

export interface GameOptions {
  winScore?: number;
  seed?: number;
  // Who receives the first serve. The board just carried on from its attract
  // mode; here the player gets the ball first.
  firstServe?: Side;
  tuning?: Partial<Tuning>;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const clamp = (value: number, min: number, max: number) =>
  value < min ? min : value > max ? max : value;

const radians = (degrees: number) => (degrees * Math.PI) / 180;

// mulberry32: small, fast, and the same sequence on every JS engine.
const random = (state: GameState) => {
  state.rng = (state.rng + 0x6d2b79f5) | 0;
  let a = state.rng;
  a = Math.imul(a ^ (a >>> 15), a | 1);
  a ^= a + Math.imul(a ^ (a >>> 7), a | 61);
  return ((a ^ (a >>> 14)) >>> 0) / 4294967296;
};

/** x of the face a paddle meets the ball with. */
export const paddleFront = (tuning: Tuning, side: Side) =>
  side === 0
    ? tuning.paddleInset + tuning.paddleWidth
    : W - tuning.paddleInset - tuning.paddleWidth;

/** Where a paddle's centre can go. */
export const paddleRange = (tuning: Tuning) => {
  const half = tuning.paddleHeight / 2 + tuning.reachInset;
  return { min: half, max: H - half };
};

export const paddleRect = (state: GameState, side: Side): Rect => {
  const { paddleWidth: w, paddleHeight: h } = state.tuning;
  const front = paddleFront(state.tuning, side);
  return {
    x: side === 0 ? front - w : front,
    y: state.paddles[side].y - h / 2,
    w,
    h,
  };
};

export const ballRect = (state: GameState): Rect => {
  const size = state.tuning.ballSize;
  return {
    x: state.ball.x - size / 2,
    y: state.ball.y - size / 2,
    w: size,
    h: size,
  };
};

/** Which of the speeds a rally of `rally` returns is played at. */
export const speedLevel = (tuning: Tuning, rally: number) =>
  Math.min(
    tuning.speedUpAt.filter((hits) => rally >= hits).length,
    tuning.speeds.length - 1,
  );

/**
 * The velocity a return leaves with, as magnitudes heading away from the paddle
 * (`vx` > 0; the caller points it at the other side). `offset` is where the ball
 * met the paddle: -1 is the top tip, 1 the bottom, 0 dead centre, counted over
 * the reach of the paddle plus half the ball, so a ball caught on its corner
 * reads as the tip. Segments are equal slices of that reach, split by |offset|
 * so that the top and bottom halves mirror exactly.
 */
export const returnVelocity = (
  tuning: Tuning,
  rally: number,
  offset: number,
  paddleVy = 0,
) => {
  const vx = tuning.speeds[speedLevel(tuning, rally)];
  const o = clamp(offset, -1, 1);
  const segments = tuning.segmentVy.length;
  const segment = Math.min(segments - 1, Math.floor(Math.abs(o) * segments));
  const english = clamp(
    paddleVy * tuning.english,
    -tuning.englishMax,
    tuning.englishMax,
  );
  const limit = vx * Math.tan(radians(tuning.maxAngle));
  const vy = clamp(
    Math.sign(o) * tuning.segmentVy[segment] + english,
    -limit,
    limit,
  );
  return { vx, vy };
};

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

// A paddle grown by half the ball on every side, so the ball can be swept as a
// single point against it.
const reachBox = (state: GameState, side: Side): Box => {
  const t = state.tuning;
  const r = t.ballSize / 2;
  const front = paddleFront(t, side);
  const left = side === 0 ? front - t.paddleWidth : front;
  const half = t.paddleHeight / 2;
  const y = state.paddles[side].y;
  return {
    left: left - r,
    right: left + t.paddleWidth + r,
    top: y - half - r,
    bottom: y + half + r,
  };
};

// When within `limit` seconds the ball's centre first enters the box, and
// through which pair of faces. A ball already inside is left to resolveOverlap.
const sweep = (ball: Ball, box: Box, limit: number) => {
  let enter = -Infinity;
  let exit = Infinity;
  let axis: "x" | "y" = "x";

  if (ball.vx === 0) {
    if (ball.x < box.left || ball.x > box.right) return null;
  } else {
    const a = (box.left - ball.x) / ball.vx;
    const b = (box.right - ball.x) / ball.vx;
    enter = Math.min(a, b);
    exit = Math.max(a, b);
  }

  if (ball.vy === 0) {
    if (ball.y < box.top || ball.y > box.bottom) return null;
  } else {
    const a = (box.top - ball.y) / ball.vy;
    const b = (box.bottom - ball.y) / ball.vy;
    // Strictly later, so a ball arriving exactly on a corner counts as a front
    // hit rather than a graze.
    if (Math.min(a, b) > enter) {
      enter = Math.min(a, b);
      axis = "y";
    }
    exit = Math.min(exit, Math.max(a, b));
  }

  if (enter > exit || enter < 0 || enter > limit || exit <= 0) return null;
  return { t: enter, axis };
};

type Contact =
  | { t: number; kind: "wall"; wall: "top" | "bottom" }
  | { t: number; kind: "front"; side: Side }
  | { t: number; kind: "edge"; side: Side; above: boolean };

const firstContact = (state: GameState, limit: number): Contact | null => {
  const { ball } = state;
  const r = state.tuning.ballSize / 2;
  const contacts: Contact[] = [];

  if (ball.vy < 0) {
    contacts.push({
      t: Math.max(0, (r - ball.y) / ball.vy),
      kind: "wall",
      wall: "top",
    });
  } else if (ball.vy > 0) {
    contacts.push({
      t: Math.max(0, (H - r - ball.y) / ball.vy),
      kind: "wall",
      wall: "bottom",
    });
  }

  for (const side of [0, 1] as const) {
    const hit = sweep(ball, reachBox(state, side), limit);
    if (!hit) continue;
    const intoFront = side === 0 ? ball.vx < 0 : ball.vx > 0;
    if (hit.axis === "x" && intoFront) {
      contacts.push({ t: hit.t, kind: "front", side });
    } else {
      const above =
        hit.axis === "y" ? ball.vy > 0 : ball.y < state.paddles[side].y;
      contacts.push({ t: hit.t, kind: "edge", side, above });
    }
  }

  let best: Contact | null = null;
  for (const contact of contacts) {
    if (contact.t <= limit && (!best || contact.t < best.t)) best = contact;
  }
  return best;
};

const returnBall = (state: GameState, side: Side, events: GameEvent[]) => {
  const t = state.tuning;
  const { ball } = state;
  const paddle = state.paddles[side];
  const box = reachBox(state, side);
  state.rally += 1;
  const reach = (box.bottom - box.top) / 2;
  const { vx, vy } = returnVelocity(
    t,
    state.rally,
    (ball.y - paddle.y) / reach,
    paddle.vy,
  );
  ball.x = side === 0 ? box.right : box.left;
  ball.vx = side === 0 ? vx : -vx;
  ball.vy = vy;
  events.push({
    type: "hit",
    side,
    rally: state.rally,
    level: speedLevel(t, state.rally),
    speed: Math.hypot(vx, vy),
    time: state.time,
  });
};

// A ball that got past the front face and then met the top or bottom of the
// paddle - by falling onto it or by the paddle moving onto it - is knocked off
// that face and keeps going: it was already a miss. The board would have sent
// it back, but a paddle scooping balls from behind reads as a glitch.
const deflect = (
  state: GameState,
  side: Side,
  above: boolean,
  events: GameEvent[],
) => {
  const t = state.tuning;
  const { ball } = state;
  const r = t.ballSize / 2;
  const box = reachBox(state, side);
  const y = above ? box.top : box.bottom;
  // Pinned between the paddle and a wall: leave it to roll out behind.
  if (y < r || y > H - r) return;
  const away = above ? -1 : 1;
  const push = away * state.paddles[side].vy;
  const limit = Math.abs(ball.vx) * Math.tan(radians(t.maxAngle));
  ball.y = y;
  ball.vy = away * Math.min(limit, Math.max(Math.abs(ball.vy), push));
  events.push({ type: "edge", side, time: state.time });
};

// A paddle that moved onto the ball. Only a ball already past the front face
// can be inside a paddle - one in front would have been swept into it - so this
// is the paddle catching it late. If it is barely past the face it counts as
// returned; otherwise it is knocked off the top or bottom.
const resolveOverlap = (state: GameState, events: GameEvent[]) => {
  const { ball } = state;
  for (const side of [0, 1] as const) {
    const box = reachBox(state, side);
    const inside =
      ball.x > box.left &&
      ball.x < box.right &&
      ball.y > box.top &&
      ball.y < box.bottom;
    if (!inside) continue;
    const pastFront = side === 0 ? box.right - ball.x : ball.x - box.left;
    const toTop = ball.y - box.top;
    const toBottom = box.bottom - ball.y;
    const heading = side === 0 ? ball.vx < 0 : ball.vx > 0;
    if (heading && pastFront <= Math.min(toTop, toBottom)) {
      returnBall(state, side, events);
    } else {
      deflect(state, side, toTop < toBottom, events);
    }
  }
};

const moveBall = (state: GameState, dt: number, events: GameEvent[]) => {
  const { ball } = state;
  resolveOverlap(state, events);

  // Walk the tick from contact to contact, so nothing is passed through however
  // far the ball travels in it. The cap only guards against a degenerate loop.
  let remaining = dt;
  for (let i = 0; i < 8 && remaining > 0; i++) {
    const contact = firstContact(state, remaining);
    const advance = contact ? contact.t : remaining;
    ball.x += ball.vx * advance;
    ball.y += ball.vy * advance;
    remaining -= advance;
    if (!contact) break;

    if (contact.kind === "wall") {
      const r = state.tuning.ballSize / 2;
      ball.y = contact.wall === "top" ? r : H - r;
      ball.vy = -ball.vy;
      events.push({ type: "wall", wall: contact.wall, time: state.time });
    } else if (contact.kind === "front") {
      returnBall(state, contact.side, events);
    } else {
      deflect(state, contact.side, contact.above, events);
    }
  }
};

const other = (side: Side): Side => (side === 0 ? 1 : 0);

const startServe = (state: GameState) => {
  const t = state.tuning;
  const r = t.ballSize / 2;
  state.phase = "serve";
  state.timer = t.serveDelay;
  state.ball = {
    x: W / 2,
    y: clamp(H / 2 + (random(state) - 0.5) * t.serveBand * H, r, H - r),
    vx: 0,
    vy: 0,
  };
};

const launch = (state: GameState, events: GameEvent[]) => {
  const t = state.tuning;
  const [low, high] = t.serveAngle;
  const angle = radians(low + (high - low) * random(state));
  const up = random(state) < 0.5 ? -1 : 1;
  const speed = t.speeds[0];
  state.phase = "play";
  state.timer = 0;
  state.ball.vx = state.serveTo === 0 ? -speed : speed;
  state.ball.vy = up * speed * Math.tan(angle);
  events.push({ type: "serve", to: state.serveTo, time: state.time });
};

const scorePoint = (state: GameState, scorer: Side, events: GameEvent[]) => {
  state.score[scorer] += 1;
  state.rally = 0;
  state.points += 1;
  // Served to whoever missed, as the board did.
  state.serveTo = other(scorer);
  state.ball.vx = 0;
  state.ball.vy = 0;
  events.push({
    type: "score",
    side: scorer,
    score: [state.score[0], state.score[1]],
    time: state.time,
  });
  if (state.score[scorer] >= state.winScore) {
    state.phase = "over";
    state.timer = 0;
    state.winner = scorer;
    events.push({ type: "over", winner: scorer, time: state.time });
  } else {
    state.phase = "point";
    state.timer = state.tuning.pointDelay;
  }
};

const movePaddles = (
  state: GameState,
  dt: number,
  inputs: readonly [PaddleInput, PaddleInput],
) => {
  const t = state.tuning;
  const { min, max } = paddleRange(t);
  for (const side of [0, 1] as const) {
    const paddle = state.paddles[side];
    const input = inputs[side];
    let y = paddle.y;
    if (input.kind === "axis") {
      y += clamp(input.dir, -1, 1) * t.keySpeed * dt;
    } else if (input.kind === "target" && Number.isFinite(input.y)) {
      const speed =
        input.maxSpeed !== undefined && input.maxSpeed >= 0
          ? Math.min(input.maxSpeed, t.pointerSpeed)
          : t.pointerSpeed;
      const reach = speed * dt;
      y += clamp(clamp(input.y, min, max) - y, -reach, reach);
    }
    y = clamp(y, min, max);
    paddle.vy = (y - paddle.y) / dt;
    paddle.y = y;
  }
};

// Timers count down in whole ticks; this absorbs the float error of the sums.
const EPSILON = 1e-9;

const tick = (
  state: GameState,
  dt: number,
  inputs: readonly [PaddleInput, PaddleInput],
  events: GameEvent[],
) => {
  state.time += dt;
  movePaddles(state, dt, inputs);

  if (state.phase === "serve") {
    state.timer -= dt;
    if (state.timer <= EPSILON) launch(state, events);
  } else if (state.phase === "point") {
    state.timer -= dt;
    if (state.timer <= EPSILON) startServe(state);
  } else if (state.phase === "play") {
    moveBall(state, dt, events);
    const r = state.tuning.ballSize / 2;
    if (state.ball.x < -r) scorePoint(state, 1, events);
    else if (state.ball.x > W + r) scorePoint(state, 0, events);
  }
};

const cloneState = (state: GameState): GameState => ({
  ...state,
  score: [state.score[0], state.score[1]],
  ball: { ...state.ball },
  paddles: [{ ...state.paddles[0] }, { ...state.paddles[1] }],
});

export const createGame = (options: GameOptions = {}): GameState => {
  const tuning: Tuning = { ...TUNING, ...options.tuning };
  const seed = (options.seed ?? 1972) >>> 0;
  const state: GameState = {
    tuning,
    winScore: Math.max(1, Math.floor(options.winScore ?? 5)),
    seed,
    phase: "serve",
    timer: 0,
    score: [0, 0],
    ball: { x: W / 2, y: H / 2, vx: 0, vy: 0 },
    paddles: [
      { y: H / 2, vy: 0 },
      { y: H / 2, vy: 0 },
    ],
    serveTo: options.firstServe ?? 0,
    rally: 0,
    points: 0,
    winner: null,
    time: 0,
    accumulator: 0,
    rng: seed,
  };
  startServe(state);
  return state;
};

/**
 * Advances the game by `dt` seconds of frame time, run as whole fixed ticks;
 * the remainder carries over in `accumulator`. `dt` is capped at `maxFrame`,
 * and a negative or NaN one simulates nothing. Returns a new state and leaves
 * `state` untouched. Both inputs are held for every tick of the frame.
 */
export const step = (
  state: GameState,
  dt: number,
  inputs: readonly [PaddleInput, PaddleInput],
): StepResult => {
  const next = cloneState(state);
  const events: GameEvent[] = [];
  const tickLength = next.tuning.tick;
  // NaN fails the comparison too; an infinite frame is just a long one.
  const frame = dt > 0 ? Math.min(dt, next.tuning.maxFrame) : 0;

  const pending = next.accumulator + frame;
  const ticks = Math.floor(pending / tickLength + 1e-6);
  next.accumulator = Math.max(0, pending - ticks * tickLength);
  for (let i = 0; i < ticks; i++) tick(next, tickLength, inputs, events);

  return { state: next, events };
};
