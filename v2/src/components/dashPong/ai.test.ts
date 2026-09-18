import { describe, expect, it } from "vitest";
import { AI_TUNING, aiInput, interceptY, noise } from "./ai";
import {
  H,
  TUNING,
  W,
  createGame,
  paddleFront,
  paddleRange,
  step,
  type Ball,
  type GameState,
  type PaddleInput,
} from "./engine";

const R = TUNING.ballSize / 2;
const REACH = TUNING.paddleHeight / 2 + R;
const RIGHT_FACE = paddleFront(TUNING, 1) - R;
const COURT = paddleFront(TUNING, 1) - paddleFront(TUNING, 0);

const inPlay = (
  ball: Partial<Ball>,
  paddles: [number, number] = [H / 2, H / 2],
): GameState => ({
  ...createGame(),
  phase: "play",
  timer: 0,
  ball: { x: W / 2, y: H / 2, vx: 0, vy: 0, ...ball },
  paddles: [
    { y: paddles[0], vy: 0 },
    { y: paddles[1], vy: 0 },
  ],
});

// Ball x once it has covered `share` of the court towards the right paddle.
const coveredX = (share: number) => paddleFront(TUNING, 0) + share * COURT;

/**
 * A left player that never misses and hits each ball at a different spot on
 * the paddle, so the AI faces every angle the paddle can produce.
 */
const perfectAim = (state: GameState): PaddleInput => {
  const y = interceptY(state, 0);
  if (y === null) return { kind: "target", y: H / 2 };
  const aim = noise(state.seed, 99, state.points, state.rally) * 0.9;
  return { kind: "target", y: y - aim * REACH };
};

/** How the AI on the right fares against perfectAim, by the speed it faced. */
const versusPerfect = (difficulty: number, seeds = 20, points = 20) => {
  const returned = [0, 0, 0];
  const missed = [0, 0, 0];
  let perfectMissed = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    let state = createGame({ seed, winScore: 99, firstServe: 1 });
    let level = 0;
    // The time cap only matters at difficulty 1, where rallies run long.
    while (state.points < points && state.time < 600) {
      const result = step(state, 1 / 60, [
        perfectAim(state),
        aiInput(state, 1, { difficulty }),
      ]);
      for (const event of result.events) {
        if (event.type === "serve") level = 0;
        if (event.type === "hit" && event.side === 0) level = event.level;
        if (event.type === "hit" && event.side === 1) returned[level] += 1;
        if (event.type === "score" && event.side === 0) missed[level] += 1;
        if (event.type === "score" && event.side === 1) perfectMissed += 1;
      }
      state = result.state;
    }
  }
  const rate = (hits: number, misses: number) => hits / (hits + misses);
  const total = rate(
    returned.reduce((sum, value) => sum + value),
    missed.reduce((sum, value) => sum + value),
  );
  return {
    returnRate: total,
    byLevel: returned.map((hits, level) => rate(hits, missed[level])),
    perfectMissed,
  };
};

describe("interceptY", () => {
  it("finds where the ball will meet the paddle, walls and all", () => {
    for (const vy of [-330, -120, 0, 90, 260]) {
      // The right paddle hides at the top or bottom, away from the ball.
      const start = inPlay({ x: 100, y: 120, vx: 300, vy });
      const predicted = interceptY(start, 1)!;
      const state = {
        ...start,
        paddles: [
          start.paddles[0],
          { y: predicted > H / 2 ? 18 : H - 18, vy: 0 },
        ] as GameState["paddles"],
      };

      let current = state;
      while (current.ball.x < RIGHT_FACE) {
        current = step(current, TUNING.tick, [
          { kind: "none" },
          { kind: "none" },
        ]).state;
      }
      // Within the last tick's travel of the face.
      expect(Math.abs(current.ball.y - predicted)).toBeLessThanOrEqual(
        Math.abs(vy) * TUNING.tick + 1e-6,
      );
    }
  });

  it("has nothing to say about a ball going the other way", () => {
    expect(interceptY(inPlay({ vx: -200 }), 1)).toBeNull();
    expect(interceptY(inPlay({ vx: 200 }), 0)).toBeNull();
  });
});

describe("aiInput", () => {
  const speed = (AI_TUNING.speed[0] + AI_TUNING.speed[1]) / 2;
  const react = (AI_TUNING.react[0] + AI_TUNING.react[1]) / 2;
  const home = { kind: "target", y: H / 2, maxSpeed: speed * AI_TUNING.drift };

  it("is a function of the state alone", () => {
    const state = inPlay({ x: coveredX(0.8), vx: 300, vy: 80 });
    const before = JSON.stringify(state);
    expect(aiInput(state, 1)).toEqual(aiInput(state, 1));
    expect(JSON.stringify(state)).toBe(before);
  });

  it("drifts home while the ball is going away, being served, or still far off", () => {
    expect(aiInput(inPlay({ x: coveredX(0.9), vx: -300 }), 1)).toEqual(home);
    expect(aiInput(createGame(), 1)).toEqual(home);
    expect(aiInput(inPlay({ x: coveredX(react - 0.05), vx: 300 }), 1)).toEqual(
      home,
    );
  });

  it("goes for the intercept once the ball is past its reaction line", () => {
    const state = inPlay({
      x: coveredX(react + 0.05),
      y: 100,
      vx: 300,
      vy: 60,
    });
    const input = aiInput(state, 1);
    if (input.kind !== "target") throw new Error("expected a target");
    expect(input.maxSpeed).toBe(speed);
    const slow = (AI_TUNING.errorSlow[0] + AI_TUNING.errorSlow[1]) / 2;
    const fast = (AI_TUNING.errorFast[0] + AI_TUNING.errorFast[1]) / 2;
    expect(Math.abs(input.y - interceptY(state, 1)!)).toBeLessThanOrEqual(
      Math.max(slow, fast),
    );
  });

  it("plays the left side as well as the right", () => {
    const state = inPlay({
      x: W - coveredX(react + 0.1),
      y: 60,
      vx: -300,
      vy: -90,
    });
    const input = aiInput(state, 0);
    expect(input).toMatchObject({ kind: "target", maxSpeed: speed });
    expect(aiInput({ ...state, ball: { ...state.ball, vx: 300 } }, 0)).toEqual(
      home,
    );
  });

  it("is too slow for the steepest balls at the top speed", () => {
    // From the middle to either end of the paddle's travel.
    const needed = paddleRange(TUNING).max - H / 2;
    const top = TUNING.speeds[2];
    const watching = ((1 - react) * COURT) / top;
    expect(speed * watching).toBeLessThan(needed);
    // At the first speed it has time to get anywhere.
    expect((speed * ((1 - react) * COURT)) / TUNING.speeds[0]).toBeGreaterThan(
      needed,
    );

    // The steepest return there is, arriving at the very bottom.
    const vy = TUNING.segmentVy[3] + TUNING.englishMax;
    const x = coveredX(react);
    const y = H - R - vy * ((RIGHT_FACE - x) / top);
    let state = inPlay({ x, y, vx: top, vy }, [H / 2, H / 2]);
    state = { ...state, rally: 12 };
    while (state.phase === "play") {
      state = step(state, 1 / 60, [{ kind: "none" }, aiInput(state, 1)]).state;
    }
    expect(state.score).toEqual([1, 0]);
  });
});

describe("the AI as an opponent", () => {
  // Measured at the default difficulty against perfectAim over these seeds: it
  // returns 78% of balls - 97% at the first speed, 66% at the second, 36% at
  // the top one. The bounds leave room for small retuning while still pinning
  // what matters: it concedes at least a fifth of balls, and nearly all of
  // them to pace rather than whiffing slow ones.
  it("returns most balls but concedes a fair share, more as the rally speeds up", () => {
    const { returnRate, byLevel, perfectMissed } = versusPerfect(0.5);
    expect(perfectMissed).toBe(0);
    expect(returnRate).toBeGreaterThan(0.7);
    expect(returnRate).toBeLessThan(0.8);
    expect(byLevel[0]).toBeGreaterThan(0.9);
    expect(byLevel[1]).toBeGreaterThan(0.5);
    expect(byLevel[1]).toBeLessThan(0.8);
    expect(byLevel[2]).toBeLessThan(0.5);
  });

  it("gets harder with difficulty", () => {
    // Measured: 60%, 78% and 92% of balls returned.
    const rates = [0, 0.5, 1].map(
      (difficulty) => versusPerfect(difficulty, 10).returnRate,
    );
    expect(rates[0]).toBeGreaterThan(0.5);
    expect(rates[1]).toBeGreaterThan(rates[0] + 0.1);
    expect(rates[2]).toBeGreaterThan(rates[1] + 0.1);
    expect(rates[2]).toBeLessThan(0.97);
  });

  it("finishes games against itself, with rallies that end", () => {
    // Measured over these seeds: the longest rally is 14 hits, the longest game
    // two minutes, and each side wins about half.
    const wins = [0, 0];
    let longestRally = 0;
    for (let seed = 1; seed <= 20; seed++) {
      let state = createGame({ seed });
      while (state.phase !== "over" && state.time < 600) {
        const result = step(state, 1 / 60, [
          aiInput(state, 0),
          aiInput(state, 1),
        ]);
        for (const event of result.events) {
          if (event.type === "hit")
            longestRally = Math.max(longestRally, event.rally);
        }
        state = result.state;
      }
      expect(state.phase).toBe("over");
      wins[state.winner!] += 1;
    }
    expect(longestRally).toBeLessThan(40);
    expect(Math.min(...wins)).toBeGreaterThanOrEqual(5);
  });
});
