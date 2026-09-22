import { describe, expect, it } from "vitest";
import {
  CAR_SNAP,
  glideStep,
  keyTravel,
  nextStop,
  readWheel,
  settleTarget,
  snapStops,
  snapTarget,
  wheelPixels,
  type Glide,
  type WheelGesture,
  type WheelPage,
} from "./carSnap";

const PAGE = 900;

describe("snapStops", () => {
  it("rests on both ends and the middle of every pause", () => {
    expect(
      snapStops(
        [
          { from: 4, to: 5 },
          { from: 1, to: 2 },
        ],
        8,
      ),
    ).toEqual([0, 1.5, 4.5, 8]);
  });

  it("drops a pause that coincides with an end, and anything outside", () => {
    expect(snapStops([{ from: 0, to: 0 }, { from: 9, to: 10 }], 8)).toEqual([0, 8]);
  });

  it("uses the start of a pause with no length", () => {
    expect(snapStops([{ from: 3, to: 2 }], 8)).toEqual([0, 3, 8]);
  });
});

describe("nextStop", () => {
  const stops = [100, 500, 900];

  it("finds the next stop either way from between two", () => {
    expect(nextStop(stops, 300, 1)).toBe(500);
    expect(nextStop(stops, 300, -1)).toBe(100);
  });

  it("moves on from a stop the page is resting on, even a pixel off it", () => {
    expect(nextStop(stops, 501, 1)).toBe(900);
    expect(nextStop(stops, 499, -1)).toBe(100);
  });

  it("has nowhere to go past either end", () => {
    expect(nextStop(stops, 900, 1)).toBeNull();
    expect(nextStop(stops, 100, -1)).toBeNull();
  });
});

describe("snapTarget", () => {
  const stops = [1000, 3000, 5000];

  it("goes stop to stop inside the sequence", () => {
    expect(snapTarget(stops, 1000, 1, 40)).toBe(3000);
    expect(snapTarget(stops, 3000, -1, 40)).toBe(1000);
    expect(snapTarget(stops, 4200, -1, 40)).toBe(3000);
  });

  it("lets the page scroll out past either end", () => {
    expect(snapTarget(stops, 5000, 1, 40)).toBeNull();
    expect(snapTarget(stops, 1000, -1, 40)).toBeNull();
  });

  it("leaves the page above and below alone until a move would enter the sequence", () => {
    expect(snapTarget(stops, 400, 1, 100)).toBeNull();
    expect(snapTarget(stops, 400, -1, 100)).toBeNull();
    expect(snapTarget(stops, 950, 1, 100)).toBe(1000);
    expect(snapTarget(stops, 5600, -1, 100)).toBeNull();
    expect(snapTarget(stops, 5060, -1, 100)).toBe(5000);
  });

  it("has nothing to do without stops", () => {
    expect(snapTarget([], 100, 1, 40)).toBeNull();
  });
});

describe("settleTarget", () => {
  const stops = [1000, 3000, 5000];

  it("docks a coast on the end it came in by, however far it flew", () => {
    expect(settleTarget(stops, 1200, 1)).toBe(1000);
    expect(settleTarget(stops, 4000, 1)).toBe(1000);
    expect(settleTarget(stops, 4985, -1)).toBe(5000);
    expect(settleTarget(stops, 2000, -1)).toBe(5000);
  });

  it("leaves a page that is on a stop or outside the sequence", () => {
    expect(settleTarget(stops, 3001, 1)).toBeNull();
    expect(settleTarget(stops, 400, 1)).toBeNull();
    expect(settleTarget(stops, 6000, -1)).toBeNull();
  });
});

describe("wheelPixels and keyTravel", () => {
  it("reads lines and pages as pixels", () => {
    expect(wheelPixels(3, 1, PAGE)).toBe(48);
    expect(wheelPixels(-1, 2, PAGE)).toBe(-PAGE);
    expect(wheelPixels(100, 0, PAGE)).toBe(100);
  });

  it("scrolls with the arrows, page keys and space, and leaves Home and End", () => {
    expect(keyTravel("ArrowDown", false, PAGE)).toBeGreaterThan(0);
    expect(keyTravel("ArrowUp", false, PAGE)).toBeLessThan(0);
    expect(keyTravel(" ", false, PAGE)).toBeGreaterThan(0);
    expect(keyTravel(" ", true, PAGE)).toBeLessThan(0);
    expect(keyTravel("PageUp", false, PAGE)).toBeLessThan(0);
    expect(keyTravel("Home", false, PAGE)).toBe(0);
    expect(keyTravel("End", false, PAGE)).toBe(0);
  });
});

type Wheel = [seconds: number, pixels: number];

/**
 * A trackpad flick as Chrome reports it: whole-pixel deltas at `hz`, fingers
 * that speed up, slow and speed up again on the pad, then momentum dying away
 * over about `coast` seconds. `jitter` wobbles each event's timestamp.
 */
const flick = ({
  start = 0,
  sign = 1,
  peak = 50,
  hz = 60,
  coast = 2,
  jitter = 0,
}: {
  start?: number;
  sign?: number;
  peak?: number;
  hz?: number;
  coast?: number;
  jitter?: number;
} = {}): Wheel[] => {
  const gap = 1 / hz;
  const perEvent = 60 / hz;
  const fingers = [2, 6, 14, 30, 25, 20, 14, 10, 24, 45, 50, 40].map(
    (value) => (value * peak) / 50,
  );
  const events: Wheel[] = [];
  let time = start;
  let wobble = 0.37;
  const push = (value: number) => {
    wobble = (wobble * 7.13 + 0.29) % 1;
    events.push([
      time + (wobble - 0.5) * 2 * jitter,
      sign * Math.max(1, Math.round(value * perEvent)),
    ]);
    time += gap;
  };
  fingers.forEach(push);
  const decay = 0.02 ** (gap / coast);
  for (let value = peak; value * perEvent >= 0.5; value *= decay) push(value);
  return events;
};

/** A mouse wheel: `count` clicks of 100 px, `spacing` seconds apart. */
const notches = (start: number, count: number, spacing: number, sign = 1): Wheel[] =>
  Array.from({ length: count }, (_, index) => [start + index * spacing, sign * 100]);

/**
 * Plays wheel events against a page whose glides take `glide` seconds, the way
 * CarSequence reads them, and returns the direction of every stop it moved.
 */
const play = (events: Wheel[], glide = 1.3) => {
  let gesture: WheelGesture | null = null;
  let page: WheelPage = { moving: null, moved: null, restedAt: -Infinity };
  let landsAt = Infinity;
  const moves: number[] = [];
  [...events]
    .sort((left, right) => left[0] - right[0])
    .forEach(([at, pixels]) => {
      if (page.moving !== null && at >= landsAt) {
        page = { moving: null, moved: page.moving, restedAt: landsAt };
      }
      const read = readWheel(gesture, pixels, at, page);
      gesture = read.gesture;
      if (!read.move) return;
      gesture = { ...gesture, used: true };
      moves.push(gesture.direction);
      page = { ...page, moving: gesture.direction };
      landsAt = at + glide;
    });
  return moves;
};

describe("reading the wheel", () => {
  it("moves one stop for one flick, momentum and all", () => {
    expect(play(flick())).toEqual([1]);
    expect(play(flick({ sign: -1 }))).toEqual([-1]);
  });

  it("moves one stop however hard the flick or however long it coasts", () => {
    expect(play(flick({ peak: 120, coast: 3.5 }))).toEqual([1]);
    expect(play(flick({ peak: 120, coast: 3.5 }), 0.3)).toEqual([1]);
  });

  it("never moves more than one stop for a single flick, across a wide range of them", () => {
    const failures: string[] = [];
    [20, 50, 90, 150].forEach((peak) =>
      [0.6, 1.5, 3, 4.5].forEach((coast) =>
        [60, 120].forEach((hz) =>
          [0, 0.002, 0.006].forEach((jitter) =>
            [0.3, 0.8, 1.3, 2.6].forEach((glide) => {
              const moves = play(flick({ peak, coast, hz, jitter }), glide);
              if (moves.length !== 1) {
                failures.push(`peak ${peak} coast ${coast} ${hz}Hz jitter ${jitter} glide ${glide}: ${moves.length}`);
              }
            }),
          ),
        ),
      ),
    );
    expect(failures).toEqual([]);
  });

  it("moves one stop at 120 Hz, and with uneven timestamps", () => {
    expect(play(flick({ hz: 120 }))).toEqual([1]);
    expect(play(flick({ hz: 120, jitter: 0.003 }), 0.3)).toEqual([1]);
    expect(play(flick({ jitter: 0.005 }), 0.3)).toEqual([1]);
  });

  it("does not read events the browser merged as a burst of speed", () => {
    // Now and then three events arrive as one - three times the pixels over
    // three times the gap - the way Chrome merges them when the page is busy.
    const events = flick({ coast: 3 }).filter(
      (_, index) => index < 14 || index % 5 === 0 || index % 5 > 2,
    );
    const merged: Wheel[] = events.map(([at, pixels], index) =>
      index >= 14 && index % 3 === 0 ? [at, pixels * 3] : [at, pixels],
    );
    expect(play(merged, 0.3)).toEqual([1]);
  });

  it("ignores the twitch the other way as the fingers lift", () => {
    const events = flick();
    const lift = events[11][0];
    events.splice(12, 0, [lift + 0.004, -3], [lift + 0.008, -2]);
    expect(play(events)).toEqual([1]);
  });

  it("swallows a second flick while the page is still moving", () => {
    // Fingers back on the pad stop the last flick's momentum dead.
    const first = flick().filter(([at]) => at < 0.6);
    expect(play([...first, ...flick({ start: 0.6 })])).toEqual([1]);
  });

  it("moves again for a flick once the page has landed, even into the last one's momentum", () => {
    // The first flick coasts for 3 s; the page lands at 1.3 s.
    const first = flick({ coast: 3 }).filter(([at]) => at < 2);
    expect(play([...first, ...flick({ start: 2 })])).toEqual([1, 1]);
  });

  it("turns round for a real scroll the other way, even mid-glide", () => {
    const down = flick().filter(([at]) => at < 0.5);
    expect(play([...down, ...flick({ start: 0.55, sign: -1 })])).toEqual([1, -1]);
  });

  it("moves one stop for a mouse wheel spun without a pause, and again after one", () => {
    expect(play(notches(0, 20, 0.05))).toEqual([1]);
    expect(play([...notches(0, 3, 0.05), ...notches(2, 1, 0.05)])).toEqual([1, 1]);
  });

  it("swallows notches clicked while the page is moving", () => {
    expect(play(notches(0, 4, 0.3))).toEqual([1]);
    expect(play(notches(0, 3, 0.8))).toEqual([1, 1]);
  });
});

/** Runs a glide at 60 fps until it lands, recording every tick. */
const run = (from: number, target: number, velocity = 0) => {
  let glide: Glide = { position: from, velocity };
  const ticks: Glide[] = [];
  for (let tick = 0; tick < 2000; tick += 1) {
    const step = glideStep(glide, target, 1 / 60, PAGE);
    ticks.push(step);
    glide = step;
    if (step.done) break;
  }
  return ticks;
};

describe("glideStep", () => {
  it("lands exactly on the stop and stops there", () => {
    const ticks = run(0, 2 * PAGE);
    const last = ticks[ticks.length - 1];
    expect(last.position).toBe(2 * PAGE);
    expect(last.velocity).toBe(0);
    expect(ticks.every((tick) => tick.position <= 2 * PAGE)).toBe(true);
  });

  it("never passes its cruising speed, and takes about as long as that implies", () => {
    const ticks = run(0, 3 * PAGE);
    const top = Math.max(...ticks.map((tick) => Math.abs(tick.velocity)));
    expect(top).toBeLessThanOrEqual(CAR_SNAP.speed * PAGE + 1e-9);
    const expected = 3 / CAR_SNAP.speed + CAR_SNAP.speed / CAR_SNAP.accel;
    expect(ticks.length / 60).toBeCloseTo(expected, 0);
  });

  it("starts from rest and eases in", () => {
    const [first] = run(0, PAGE);
    expect(first.position).toBeLessThan(2);
  });

  it("carries its speed on to a target further along", () => {
    const moving: Glide = { position: 1000, velocity: CAR_SNAP.speed * PAGE };
    const step = glideStep(moving, 1000 + 3 * PAGE, 1 / 60, PAGE);
    expect(step.velocity).toBeCloseTo(CAR_SNAP.speed * PAGE);
  });

  it("slows down before turning round", () => {
    const moving: Glide = { position: 1000, velocity: CAR_SNAP.speed * PAGE };
    const ticks = run(1000, 0, moving.velocity);
    expect(ticks[0].velocity).toBeGreaterThan(0);
    expect(Math.max(...ticks.map((tick) => tick.position))).toBeGreaterThan(1000);
    expect(ticks[ticks.length - 1].position).toBe(0);
  });
});
