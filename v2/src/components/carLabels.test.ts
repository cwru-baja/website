import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CAR_LABELS,
  CAR_PART_MATTES,
  LABEL_STYLE,
  labelGeometry,
  labelSide,
  normalizeCarLabels,
  partMatteUrl,
  partName,
  snapToColumn,
  validateCarLabels,
} from "./carLabels";
import { CAR_CHAPTERS } from "./carSequenceModel";

const still = { width: 1920, height: 1080 };

describe("car labels", () => {
  it("rises out of the dot at 45 degrees, then runs straight out to the end", () => {
    const geometry = labelGeometry(
      { dot: { x: 50, y: 50 }, end: { x: 80, y: 30 } },
      still,
    );
    expect(geometry.side).toBe("right");
    expect(geometry.knee).toEqual({ x: 1176, y: 324 });
    expect(geometry.end).toEqual({ x: 1536, y: 324 });
    expect(geometry.path).toBe("M 960 540 L 1176 324 L 1536 324");
  });

  it("mirrors to the left when the end is left of the dot", () => {
    const geometry = labelGeometry(
      { dot: { x: 50, y: 50 }, end: { x: 20, y: 70 } },
      still,
    );
    expect(geometry.side).toBe("left");
    expect(geometry.knee).toEqual({ x: 744, y: 756 });
    expect(geometry.end).toEqual({ x: 384, y: 756 });
  });

  it("keeps the angle at 45 degrees at any display size", () => {
    // Percent is not a distance on a 16:9 still, so this is the case that breaks
    // if the geometry is ever worked out before converting to pixels.
    [still, { width: 1024, height: 576 }, { width: 1486, height: 836 }].forEach(
      (box) => {
        const { dot, knee } = labelGeometry(
          { dot: { x: 37, y: 68 }, end: { x: 15, y: 58 } },
          box,
        );
        expect(Math.abs(knee.x - dot.x)).toBeCloseTo(Math.abs(knee.y - dot.y));
      },
    );
  });

  it("pushes the end out when the run is too short for its name", () => {
    // The end sits inside the rise, which would fold the line back over itself.
    const geometry = labelGeometry(
      { dot: { x: 50, y: 50 }, end: { x: 55, y: 30 } },
      still,
      100,
    );
    expect(geometry.side).toBe("right");
    expect(geometry.end.x - geometry.knee.x).toBe(100 + LABEL_STYLE.runPadding);
  });

  it("draws a straight run when the end is level with the dot", () => {
    const geometry = labelGeometry(
      { dot: { x: 40, y: 50 }, end: { x: 70, y: 50 } },
      still,
    );
    expect(geometry.knee).toEqual(geometry.dot);
    expect(geometry.end).toEqual({ x: 1344, y: 540 });
  });

  it("puts an end level with its dot on the right", () => {
    expect(labelSide({ dot: { x: 40, y: 50 }, end: { x: 40, y: 20 } })).toBe(
      "right",
    );
  });

  it("snaps to the nearest column within reach, and to nothing past it", () => {
    expect(snapToColumn(100, [90, 104, 130], 10)).toBe(104);
    expect(snapToColumn(100, [80, 125], 10)).toBeNull();
    expect(snapToColumn(100, [], 10)).toBeNull();
  });

  it("accepts the saved labels and gives every chapter an entry", () => {
    expect(validateCarLabels(CAR_LABELS, CAR_CHAPTERS)).toEqual([]);
    expect(Object.keys(CAR_LABELS)).toEqual(
      CAR_CHAPTERS.map((chapter) => chapter.id),
    );
  });

  it("explains what stops a label set from saving", () => {
    const label = {
      id: "a",
      text: "Caliper",
      dot: { x: 10, y: 10 },
      end: { x: 20, y: 20 },
    };
    expect(validateCarLabels([], CAR_CHAPTERS)).toEqual([
      "Labels must be an object keyed by chapter",
    ]);
    expect(validateCarLabels({ wheels: [] }, CAR_CHAPTERS)).toEqual([
      "Unknown chapter: wheels",
    ]);
    expect(
      validateCarLabels(
        {
          brakes: [
            { ...label, text: "  " },
            { ...label, dot: { x: 120, y: 10 } },
            { ...label, id: "b", text: "x".repeat(41), end: { x: 5 } },
          ],
        },
        CAR_CHAPTERS,
      ),
    ).toEqual([
      "Braking, label 1 has no text",
      "Braking, label 2 reuses the id a",
      "Braking, label 2 has its dot off the image",
      "Braking, label 3 is longer than 40 characters",
      "Braking, label 3 has its end off the image",
    ]);
  });

  it("saves every chapter in order, trimmed and rounded", () => {
    const saved = normalizeCarLabels(
      {
        frame: [
          {
            id: "frame-hoop",
            text: " Roll hoop ",
            dot: { x: 10.12345, y: 20 },
            end: { x: 30, y: 40.006 },
          },
        ],
      },
      CAR_CHAPTERS,
    );
    expect(Object.keys(saved)).toEqual(CAR_CHAPTERS.map((chapter) => chapter.id));
    expect(saved.brakes).toEqual([]);
    expect(saved.frame).toEqual([
      {
        id: "frame-hoop",
        text: "Roll hoop",
        dot: { x: 10.12, y: 20 },
        end: { x: 30, y: 40.01 },
      },
    ]);
  });

  it("only lets a label light up a part that has a mask on its pause", () => {
    const mattes = { brakes: { caliper: "caliper.webp?v=1" } };
    const label = {
      id: "a",
      text: "Caliper",
      dot: { x: 10, y: 10 },
      end: { x: 20, y: 20 },
    };
    expect(
      validateCarLabels({ brakes: [{ ...label, part: "caliper" }] }, CAR_CHAPTERS, mattes),
    ).toEqual([]);
    expect(
      validateCarLabels(
        {
          brakes: [{ ...label, part: "rotor" }],
          frame: [{ ...label, id: "b", part: "caliper" }],
        },
        CAR_CHAPTERS,
        mattes,
      ),
    ).toEqual([
      'Braking, label 1 highlights "rotor", which has no mask on this pause',
      'Frame, label 1 highlights "caliper", which has no mask on this pause',
    ]);
  });

  it("keeps a label's part through a save, and drops an empty one", () => {
    const dot = { x: 10, y: 10 };
    const saved = normalizeCarLabels(
      {
        brakes: [
          { id: "a", text: "Caliper", part: "caliper", dot, end: dot },
          { id: "b", text: "Pedal box", part: "", dot, end: dot },
        ],
      },
      CAR_CHAPTERS,
    );
    expect(saved.brakes[0]).toEqual({
      id: "a",
      text: "Caliper",
      part: "caliper",
      dot,
      end: dot,
    });
    expect(Object.keys(saved.brakes[1])).toEqual(["id", "text", "dot", "end"]);
  });

  it("serves every listed mask from public, versioned by its content", () => {
    Object.entries(CAR_PART_MATTES).forEach(([chapterId, parts]) => {
      Object.keys(parts).forEach((part) => {
        const url = partMatteUrl(chapterId, part);
        expect(url).toMatch(/\.webp\?v=[0-9a-f]{8}$/);
        const file = path.join(process.cwd(), "public", url!.split("?")[0]);
        expect(existsSync(file)).toBe(true);
      });
    });
    expect(partMatteUrl("brakes", "pedal-box")).toBeNull();
    expect(partName("master-cylinders")).toBe("Master cylinders");
  });

  it("lights up each brake label's own part", () => {
    expect(
      CAR_LABELS.brakes.map((label) => [label.text, label.part]),
    ).toEqual([
      ["Caliper", "caliper"],
      ["Rotor", "rotor"],
      ["Master cylinders", "master-cylinders"],
      ["Brake lines", "brake-lines"],
    ]);
  });

  it("lights up each drivetrain label's own part", () => {
    expect(
      CAR_LABELS.drivetrain.map((label) => [label.text, label.part]),
    ).toEqual([
      ["gearbox", "gearbox"],
      ["CVT", "cvt"],
      ["front transfer case", "front-transfer-case"],
      ["engine", "engine"],
      ["load-bearing half shafts", "rear-half-shafts"],
      ["propshaft", "propshaft"],
      ["rear transfer case", "bevel-box"],
      ["torque limiters", "torque-limiter"],
      ["dog clutch", "dog-clutch"],
      ["front hub and spindle", "front-hub-and-spindle"],
      ["rear hub and spindle", "rear-hub-and-spindle"],
    ]);
  });
});
