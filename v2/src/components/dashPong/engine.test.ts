import { describe, expect, it } from "vitest";
import { interceptY } from "./ai";
import {
  H,
  TUNING,
  W,
  createGame,
  paddleFront,
  paddleRange,
  returnVelocity,
  speedLevel,
  step,
  type Ball,
  type GameEvent,
  type GameOptions,
  type GameState,
  type PaddleInput,
  type Side,
} from "./engine";
import {
  DIGITS,
  DIGIT_COLS,
  DIGIT_ROWS,
  DIGIT_SEGMENTS,
  SEGMENTS,
} from "./font";

type Inputs = [PaddleInput, PaddleInput];

const NONE: Inputs = [{ kind: "none" }, { kind: "none" }];
const R = TUNING.ballSize / 2;
const REACH = TUNING.paddleHeight / 2 + R;
const LEFT_FACE = paddleFront(TUNING, 0) + R;

/** A game mid-rally, with the ball and paddles wherever the test needs them. */
const inPlay = (
  ball: Partial<Ball>,
  paddles: [number, number] = [H / 2, H / 2],
  options: GameOptions & { rally?: number } = {},
): GameState => {
  const game = createGame(options);
  return {
    ...game,
    phase: "play",
    timer: 0,
    rally: options.rally ?? 0,
    ball: { x: W / 2, y: H / 2, vx: 0, vy: 0, ...ball },
    paddles: [
      { y: paddles[0], vy: 0 },
      { y: paddles[1], vy: 0 },
    ],
  };
};

/** Steps until `done` or `limit` frames, collecting every event. */
const run = (
  state: GameState,
  frames: number,
  inputs: Inputs | ((state: GameState) => Inputs) = NONE,
  dt = 1 / 60,
  done: (state: GameState, events: GameEvent[]) => boolean = () => false,
) => {
  const events: GameEvent[] = [];
  let current = state;
  for (let i = 0; i < frames && !done(current, events); i++) {
    const result = step(
      current,
      dt,
      typeof inputs === "function" ? inputs(current) : inputs,
    );
    events.push(...result.events);
    current = result.state;
  }
  return { state: current, events };
};

const perfect = (state: GameState, side: Side): PaddleInput => ({
  kind: "target",
  y: interceptY(state, side) ?? H / 2,
});

const bothPerfect = (state: GameState): Inputs => [
  perfect(state, 0),
  perfect(state, 1),
];

const ofType = <T extends GameEvent["type"]>(events: GameEvent[], type: T) =>
  events.filter(
    (event): event is Extract<GameEvent, { type: T }> => event.type === type,
  );

describe("createGame", () => {
  it("opens on a serve from the net, 0-0, paddles centred, towards the player", () => {
    const game = createGame();
    expect(game.phase).toBe("serve");
    expect(game.timer).toBe(TUNING.serveDelay);
    expect(game.score).toEqual([0, 0]);
    expect(game.winScore).toBe(5);
    expect(game.serveTo).toBe(0);
    expect(game.ball.x).toBe(W / 2);
    expect(Math.abs(game.ball.y - H / 2)).toBeLessThanOrEqual(
      (TUNING.serveBand * H) / 2,
    );
    expect(game.paddles.map((paddle) => paddle.y)).toEqual([H / 2, H / 2]);
  });

  it("keeps the winning score a whole number of at least one", () => {
    expect(createGame({ winScore: 0 }).winScore).toBe(1);
    expect(createGame({ winScore: 3.7 }).winScore).toBe(3);
  });
});

describe("step", () => {
  it("leaves the state it was given alone", () => {
    const game = createGame();
    const before = JSON.stringify(game);
    run(game, 1);
    step(game, 1 / 60, bothPerfect(game));
    expect(JSON.stringify(game)).toBe(before);
  });

  it("replays exactly from the same seed, inputs and frame times", () => {
    // Inputs and frame times come from their own sequence, so both runs are fed
    // the same script without sharing anything with the game.
    const script = (seed: number) => {
      let state = createGame({ seed, winScore: 99 });
      for (let i = 0; i < 4000; i++) {
        const k = Math.imul(i + 1, 2654435761) >>> 0;
        const dir = ((k % 3) - 1) as -1 | 0 | 1;
        const dt = 1 / 144 + ((k >>> 8) % 100) / 3000;
        state = step(state, dt, [
          { kind: "axis", dir },
          perfect(state, 1),
        ]).state;
      }
      return state;
    };

    const first = script(7);
    expect(script(7)).toEqual(first);
    expect(first.points).toBeGreaterThan(3);
    expect(script(8)).not.toEqual(first);
  });

  it("runs whole fixed ticks and carries the remainder", () => {
    const game = createGame();
    const one = step(game, 1 / 60, NONE).state;
    expect(one.time).toBeCloseTo(4 * TUNING.tick, 12);
    expect(one.accumulator).toBeCloseTo(0, 12);

    // 10 ms is 2.4 ticks: the 0.4 is kept and spent later, not lost.
    const { state } = run(game, 100, NONE, 0.01);
    expect(Math.abs(state.time - 1)).toBeLessThan(TUNING.tick);
    expect(state.time + state.accumulator).toBeCloseTo(1, 9);
  });

  it("plays at most maxFrame of a long frame, and nothing of a bad one", () => {
    const game = createGame();
    expect(step(game, 10, NONE).state.time).toBeCloseTo(TUNING.maxFrame, 9);
    expect(step(game, Number.NaN, NONE).state.time).toBe(0);
    expect(step(game, -1, NONE).state.time).toBe(0);
    expect(step(game, Infinity, NONE).state.time).toBeCloseTo(
      TUNING.maxFrame,
      9,
    );
  });

  it("does not teleport the ball on a huge frame", () => {
    const state = inPlay({ vx: -400, vy: 150 });
    const next = step(state, 30, NONE).state;
    const moved = Math.hypot(
      next.ball.x - state.ball.x,
      next.ball.y - state.ball.y,
    );
    expect(moved).toBeLessThanOrEqual(
      Math.hypot(400, 150) * TUNING.maxFrame + 1e-9,
    );
  });

  it("scores a ball leaving on a huge frame exactly once", () => {
    const state = inPlay({ x: 2, vx: -200 }, [40, H / 2]);
    const { state: next, events } = step(state, 5, NONE);
    expect(ofType(events, "score")).toHaveLength(1);
    expect(next.score).toEqual([0, 1]);
    expect(next.phase).toBe("point");
    // Counting down from partway through the frame, not from its end.
    expect(next.timer).toBeLessThan(TUNING.pointDelay);
    expect(next.timer).toBeGreaterThan(TUNING.pointDelay - TUNING.maxFrame);
  });
});

describe("paddles", () => {
  const { min, max } = paddleRange(TUNING);

  it("move at the key speed while a key is held, and stop at the ends", () => {
    const game = createGame();
    const down = step(game, 0.1, [
      { kind: "axis", dir: 1 },
      { kind: "none" },
    ]).state;
    expect(down.paddles[0].y).toBeCloseTo(H / 2 + TUNING.keySpeed * 0.1, 6);
    expect(down.paddles[0].vy).toBeCloseTo(TUNING.keySpeed, 6);
    expect(down.paddles[1].y).toBe(H / 2);

    const pinned = run(game, 120, [
      { kind: "axis", dir: -1 },
      { kind: "axis", dir: 1 },
    ]).state;
    expect(pinned.paddles[0].y).toBe(min);
    expect(pinned.paddles[1].y).toBe(max);
  });

  it("follow a pointer no faster than the pointer speed, or a lower cap", () => {
    const game = createGame();
    const chase = step(game, 0.05, [
      { kind: "target", y: 0 },
      { kind: "target", y: 0, maxSpeed: 100 },
    ]).state;
    expect(chase.paddles[0].y).toBeCloseTo(
      H / 2 - TUNING.pointerSpeed * 0.05,
      6,
    );
    expect(chase.paddles[1].y).toBeCloseTo(H / 2 - 100 * 0.05, 6);

    // A cap above the pointer speed is not a way past it.
    const greedy = step(game, 0.05, [
      { kind: "target", y: 0, maxSpeed: 1e6 },
      { kind: "none" },
    ]).state;
    expect(greedy.paddles[0].y).toBeCloseTo(chase.paddles[0].y, 6);

    const settled = run(game, 30, [
      { kind: "target", y: -500 },
      { kind: "target", y: 900 },
    ]).state;
    expect(settled.paddles[0].y).toBe(min);
    expect(settled.paddles[1].y).toBe(max);
    expect(settled.paddles[0].vy).toBe(0);
  });

  it("stop short of the edges by the reach inset", () => {
    const game = createGame({ tuning: { reachInset: 12 } });
    const pinned = run(game, 120, [
      { kind: "axis", dir: -1 },
      { kind: "none" },
    ]).state;
    expect(pinned.paddles[0].y).toBe(TUNING.paddleHeight / 2 + 12);
  });
});

describe("walls", () => {
  it("reflect the ball off the top and bottom", () => {
    const top = run(inPlay({ y: R + 1, vx: 200, vy: -150 }), 1);
    expect(top.state.ball.vy).toBe(150);
    expect(top.state.ball.y).toBeGreaterThanOrEqual(R);
    expect(ofType(top.events, "wall")).toEqual([
      expect.objectContaining({ wall: "top" }),
    ]);

    const bottom = run(inPlay({ y: H - R - 1, vx: 200, vy: 150 }), 1);
    expect(bottom.state.ball.vy).toBe(-150);
    expect(bottom.state.ball.y).toBeLessThanOrEqual(H - R);
    expect(ofType(bottom.events, "wall")[0]).toMatchObject({ wall: "bottom" });
  });

  it("keep the ball inside the field through a long game", () => {
    let state = createGame({ seed: 3, winScore: 99 });
    let walls = 0;
    for (let i = 0; i < 60 * 120; i++) {
      // A sloppy player on the left keeps the points coming.
      const sloppy: PaddleInput = { kind: "axis", dir: i % 90 < 45 ? -1 : 1 };
      const result = step(state, 1 / 60, [sloppy, perfect(state, 1)]);
      walls += ofType(result.events, "wall").length;
      state = result.state;
      expect(state.ball.y).toBeGreaterThanOrEqual(R);
      expect(state.ball.y).toBeLessThanOrEqual(H - R);
    }
    expect(walls).toBeGreaterThan(10);
    expect(state.points).toBeGreaterThan(5);
  });
});

describe("returnVelocity", () => {
  const offsets = Array.from({ length: 201 }, (_, i) => -1 + i / 100);
  const angle = (offset: number, paddleVy = 0) => {
    const { vx, vy } = returnVelocity(TUNING, 1, offset, paddleVy);
    return Math.atan2(vy, vx);
  };

  it("returns a centre hit flat and steepens towards the tips", () => {
    expect(returnVelocity(TUNING, 1, 0).vy).toBe(0);
    expect(returnVelocity(TUNING, 1, 0.24).vy).toBe(0);
    expect(returnVelocity(TUNING, 1, -0.24).vy).toBe(0);
    expect(returnVelocity(TUNING, 1, 1).vy).toBe(TUNING.segmentVy[3]);
    expect(returnVelocity(TUNING, 1, -1).vy).toBe(-TUNING.segmentVy[3]);
  });

  it("never turns back as the hit moves along the paddle", () => {
    const angles = offsets.map((offset) => angle(offset));
    angles.slice(1).forEach((value, i) => {
      expect(value).toBeGreaterThanOrEqual(angles[i]);
    });
  });

  it("mirrors the top half of the paddle onto the bottom", () => {
    offsets.forEach((offset) => {
      expect(angle(offset) + angle(-offset)).toBeCloseTo(0, 12);
    });
  });

  it("splits the paddle into the board's eight segments", () => {
    // Two flat segments in the middle share an angle, so eight make seven.
    const distinct = new Set(
      offsets.map((offset) => returnVelocity(TUNING, 1, offset).vy),
    );
    expect(distinct.size).toBe(7);
  });

  it("adds a little english from the paddle, never enough to aim with", () => {
    const still = returnVelocity(TUNING, 1, 0.5).vy;
    const dragged = returnVelocity(TUNING, 1, 0.5, TUNING.keySpeed).vy;
    expect(dragged).toBeGreaterThan(still);
    expect(dragged - still).toBeLessThanOrEqual(TUNING.englishMax);
    expect(returnVelocity(TUNING, 1, 0, -TUNING.pointerSpeed).vy).toBe(
      -TUNING.englishMax,
    );
  });

  it("never sends a ball out steeper than the max angle", () => {
    const wild = {
      ...TUNING,
      segmentVy: [0, 400, 900, 2000],
      englishMax: 1000,
      english: 5,
    };
    const limit = (TUNING.maxAngle * Math.PI) / 180;
    for (const rally of [0, 5, 20]) {
      offsets.forEach((offset) => {
        const { vx, vy } = returnVelocity(wild, rally, offset, 900);
        expect(Math.abs(Math.atan2(vy, vx))).toBeLessThanOrEqual(limit + 1e-12);
      });
    }
    // The defaults get nowhere near it.
    const steepest = returnVelocity(TUNING, 0, 1, TUNING.pointerSpeed);
    expect(Math.atan2(steepest.vy, steepest.vx)).toBeLessThan(limit);
  });
});

describe("paddle hits", () => {
  it("send the ball back at the segment's angle", () => {
    // 10 px below centre is 0.48 of the reach: the second segment down.
    const state = inPlay({ x: 60, y: 130, vx: -200 }, [120, H / 2]);
    const { state: next, events } = run(state, 30, NONE, 1 / 60, (_, seen) =>
      seen.some((event) => event.type === "hit"),
    );
    expect(ofType(events, "hit")[0]).toMatchObject({
      side: 0,
      rally: 1,
      level: 0,
    });
    expect(next.ball.vx).toBe(TUNING.speeds[0]);
    expect(next.ball.vy).toBe(TUNING.segmentVy[1]);
  });

  it("pick up english from a moving paddle", () => {
    // Half a pixel from the face, so the hit lands inside the one tick.
    const state = inPlay({ x: LEFT_FACE + 0.5, y: 130, vx: -200 }, [
      120,
      H / 2,
    ]);
    const next = step(state, TUNING.tick, [
      { kind: "axis", dir: 1 },
      { kind: "none" },
    ]).state;
    const english = Math.min(
      TUNING.englishMax,
      TUNING.keySpeed * TUNING.english,
    );
    expect(next.ball.vy).toBeCloseTo(TUNING.segmentVy[1] + english, 6);
  });

  it("never let the ball through, however fast it goes or long the frame", () => {
    const checks = [
      { tuning: TUNING, speed: TUNING.speeds[2] },
      // Fast enough to cross the whole panel in one frame: 25 px a tick, more
      // than the paddle and ball are wide together.
      { tuning: { ...TUNING, speeds: [6000, 6000, 6000] }, speed: 6000 },
    ];
    for (const { tuning, speed } of checks) {
      for (const slope of [-1.2, -0.6, 0, 0.3, 1.1]) {
        for (const offset of [-0.98, -0.6, -0.2, 0, 0.35, 0.7, 0.98]) {
          const aimed = inPlay(
            { x: 300, y: 100, vx: -speed, vy: slope * speed },
            [H / 2, H / 2],
            {
              tuning,
              rally: 20,
            },
          );
          const at = interceptY(aimed, 0)!;
          const { min, max } = paddleRange(tuning);
          const paddle = Math.min(max, Math.max(min, at - offset * REACH));
          const state = {
            ...aimed,
            paddles: [
              { y: paddle, vy: 0 },
              aimed.paddles[1],
            ] as GameState["paddles"],
          };

          const { events } = run(
            state,
            20,
            NONE,
            0.1,
            (_, seen) =>
              seen.length > 0 &&
              seen.some(
                (event) => event.type === "hit" || event.type === "score",
              ),
          );
          const decisive = events.find(
            (event) => event.type === "hit" || event.type === "score",
          );
          expect(decisive).toMatchObject({ type: "hit", side: 0 });
        }
      }
    }
  });

  it("count a paddle catching a ball just past its face as a return", () => {
    // 0.2 px past the face, 2 px above the paddle's reach; the paddle rises onto it.
    const state = inPlay({ x: LEFT_FACE - 0.2, y: 100, vx: -200 }, [
      100 + REACH + 2,
      H / 2,
    ]);
    const { events } = run(state, 1, [
      { kind: "target", y: 0 },
      { kind: "none" },
    ]);
    expect(ofType(events, "hit")).toHaveLength(1);
    expect(ofType(events, "edge")).toHaveLength(0);
  });

  it("knock a ball already alongside the paddle off its edge, still a miss", () => {
    // Falling onto the paddle's top from above, well past the face.
    const falling = inPlay({ x: LEFT_FACE - 2, y: 120, vx: -200, vy: 300 }, [
      150,
      H / 2,
    ]);
    const fell = run(
      falling,
      60,
      NONE,
      1 / 60,
      (state) => state.phase !== "play",
    );
    expect(ofType(fell.events, "edge")[0]).toMatchObject({ side: 0 });
    expect(ofType(fell.events, "hit")).toHaveLength(0);
    expect(fell.state.score).toEqual([0, 1]);

    // The paddle moving up onto a ball that is level with it.
    const caught = inPlay({ x: LEFT_FACE - 7, y: 100, vx: -200 }, [
      100 + REACH + 2,
      H / 2,
    ]);
    const scooped = run(
      caught,
      60,
      [{ kind: "target", y: 0 }, { kind: "none" }],
      1 / 60,
      (state) => state.phase !== "play",
    );
    expect(ofType(scooped.events, "edge").length).toBeGreaterThan(0);
    expect(ofType(scooped.events, "hit")).toHaveLength(0);
    expect(scooped.state.score).toEqual([0, 1]);
  });
});

describe("speed", () => {
  it("steps up on a rally's 4th and 12th hits", () => {
    expect(
      [0, 1, 3, 4, 11, 12, 40].map((rally) => speedLevel(TUNING, rally)),
    ).toEqual([0, 0, 0, 1, 1, 2, 2]);
  });

  it("ramps through a long rally, never past the cap, and resets after a point", () => {
    const game = createGame({ seed: 11 });
    const rally = run(
      game,
      60 * 60,
      bothPerfect,
      1 / 60,
      (state) => state.rally >= 20,
    );
    const hits = ofType(rally.events, "hit");
    expect(hits).toHaveLength(20);

    const cap = TUNING.speeds[2] / Math.cos((TUNING.maxAngle * Math.PI) / 180);
    hits.forEach((hit) => {
      expect(hit.level).toBe(speedLevel(TUNING, hit.rally));
      expect(hit.speed).toBeGreaterThanOrEqual(TUNING.speeds[hit.level]);
      expect(hit.speed).toBeLessThanOrEqual(cap);
    });
    expect(Math.abs(rally.state.ball.vx)).toBe(TUNING.speeds[2]);

    // Now the right side stops returning; the next serve is back at the first speed.
    const after = run(
      rally.state,
      60 * 10,
      (state) => [
        perfect(state, 0),
        { kind: "target", y: state.ball.y > H / 2 ? 0 : H },
      ],
      1 / 60,
      (state) => state.points === 1 && state.phase === "play",
    );
    expect(after.state.rally).toBe(0);
    expect(Math.abs(after.state.ball.vx)).toBe(TUNING.speeds[0]);
  });
});

describe("scoring and serving", () => {
  it("gives the point to the other side and serves to whoever missed", () => {
    const state = inPlay({ x: 10, vx: -200 }, [40, H / 2]);
    const scored = run(
      state,
      30,
      NONE,
      1 / 60,
      (next) => next.phase !== "play",
    );
    expect(ofType(scored.events, "score")).toEqual([
      expect.objectContaining({ side: 1, score: [0, 1] }),
    ]);
    expect(scored.state.phase).toBe("point");
    expect(scored.state.serveTo).toBe(0);
    expect(scored.state.rally).toBe(0);
    const scoredAt = ofType(scored.events, "score")[0].time;

    // Tick by tick, so the serve can be timed to the tick.
    const served = run(scored.state, 2000, NONE, TUNING.tick, (_, events) =>
      events.some((event) => event.type === "serve"),
    );
    const serve = ofType(served.events, "serve")[0];
    expect(serve.to).toBe(0);
    expect(serve.time - scoredAt).toBeCloseTo(
      TUNING.pointDelay + TUNING.serveDelay,
      2,
    );
    expect(served.state.ball.x).toBe(W / 2);
    expect(served.state.ball.vx).toBe(-TUNING.speeds[0]);

    const angle =
      Math.abs(Math.atan2(served.state.ball.vy, -served.state.ball.vx)) *
      (180 / Math.PI);
    expect(angle).toBeGreaterThanOrEqual(TUNING.serveAngle[0] - 1e-9);
    expect(angle).toBeLessThanOrEqual(TUNING.serveAngle[1] + 1e-9);
  });

  it("holds the ball at the net until the serve", () => {
    const game = createGame();
    const waiting = run(game, 10, NONE, TUNING.tick).state;
    expect(waiting.phase).toBe("serve");
    expect(waiting.ball).toEqual(game.ball);
  });

  it("ends the game exactly at the winning score and stops the ball", () => {
    // The left paddle hides at the top; the right one returns everything.
    const game = createGame({ seed: 5, winScore: 3 });
    const inputs = (state: GameState): Inputs => [
      { kind: "target", y: 0 },
      perfect(state, 1),
    ];
    const played = run(
      game,
      60 * 120,
      inputs,
      1 / 60,
      (state) => state.phase === "over",
    );

    const scores = ofType(played.events, "score");
    const over = ofType(played.events, "over");
    expect(over).toEqual([expect.objectContaining({ winner: 1 })]);
    expect(played.state.winner).toBe(1);
    expect(played.state.score[1]).toBe(3);
    expect(scores).toHaveLength(played.state.score[0] + played.state.score[1]);
    // The deciding score and the end land on the same tick.
    expect(scores.at(-1)).toMatchObject({
      score: played.state.score,
      time: over[0].time,
    });
    expect(played.state.ball.vx).toBe(0);
    expect(played.state.ball.vy).toBe(0);

    const later = run(played.state, 600, inputs);
    expect(later.events).toEqual([]);
    expect(later.state.ball).toEqual(played.state.ball);
    expect(later.state.score).toEqual(played.state.score);
  });
});

describe("score font", () => {
  it("draws every digit on the board's 4 x 8 grid", () => {
    expect(DIGITS).toHaveLength(10);
    DIGITS.forEach((digit) => {
      expect(digit).toHaveLength(DIGIT_ROWS);
      digit.forEach((row) => expect(row).toHaveLength(DIGIT_COLS));
    });
  });

  it("lights exactly the cells of the segments the 7448 lights", () => {
    DIGIT_SEGMENTS.forEach((segments, digit) => {
      const cells = Array.from({ length: DIGIT_ROWS }, () =>
        Array<0 | 1>(DIGIT_COLS).fill(0),
      );
      segments.forEach((segment) => {
        const { col, row, cols, rows } = SEGMENTS[segment];
        for (let y = row; y < row + rows; y++)
          for (let x = col; x < col + cols; x++) cells[y][x] = 1;
      });
      expect(DIGITS[digit]).toEqual(cells);
    });
  });

  it("keeps the 7448's tailless 6 and 9 and its one-sided 1", () => {
    expect(DIGITS[6][0]).toEqual([1, 0, 0, 0]);
    expect(DIGITS[9][7]).toEqual([0, 0, 0, 1]);
    DIGITS[1].forEach((row) => expect(row).toEqual([0, 0, 0, 1]));
  });
});
