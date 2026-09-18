import { describe, expect, it } from "vitest";
import { CARS, CURRENT_CAR, CURRENT_THEME } from "../../lib/livery";
import { createGame, step, W, type GameState } from "./engine";
import { hexRgb } from "./raster";
import { scene, winnerText } from "./scene";

const same = (a: readonly number[], b: readonly number[]) => a.every((v, i) => Math.abs(v - b[i]) < 1e-9);
const PADDLE = hexRgb(CARS[CURRENT_CAR].livery.lead);
const BALL = hexRgb(CURRENT_THEME.liveryPop);
const inPlay = (): GameState => {
  let s = createGame({ seed: 7 });
  while (s.phase !== "play") s = step(s, 1 / 60, [{ kind: "none" }, { kind: "none" }]).state;
  return s;
};

describe("scene", () => {
  it("draws the paddles in the livery's lead and the ball in its contrast-safe pop", () => {
    const rects = scene(inPlay(), "cpu");
    expect(rects.filter((r) => same(r.color, PADDLE))).toHaveLength(2);
    expect(rects.filter((r) => same(r.color, BALL))).toHaveLength(1);
  });

  it("has a dashed net down the middle during play", () => {
    const net = scene(inPlay(), "cpu").filter((r) => Math.abs(r.x + r.w / 2 - W / 2) < 1e-9 && r.w < 5);
    expect(net.length).toBeGreaterThan(10);
  });

  it("shows no ball straight after a point, while it is off the edge", () => {
    const s = { ...inPlay(), phase: "point" as const };
    expect(scene(s, "cpu").filter((r) => same(r.color, BALL))).toHaveLength(0);
  });

  it("clears the net and the ball for the result", () => {
    const s: GameState = { ...inPlay(), phase: "over", winner: 0, score: [5, 2] };
    const rects = scene(s, "cpu");
    expect(rects.filter((r) => same(r.color, BALL))).toHaveLength(0);
    expect(rects.filter((r) => r.w === 3 && r.h === 8)).toHaveLength(0);
  });

  it("names the winner by who was playing", () => {
    expect(winnerText(0, "cpu")).toBe("YOU WIN");
    expect(winnerText(1, "cpu")).toBe("CPU WINS");
    expect(winnerText(0, "p2")).toBe("P1 WINS");
    expect(winnerText(1, "p2")).toBe("P2 WINS");
  });
});
