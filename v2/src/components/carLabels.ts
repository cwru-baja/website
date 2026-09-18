import partMattes from "../data/car-part-mattes.json";
import savedLabels from "./carLabels.json";
import { matteUrl, type FrameSourceLike } from "./carSequenceModel";

/** A point in percent of the still a pause shows, so it holds at any display size. */
export interface LabelPoint {
  x: number;
  y: number;
}

/**
 * One pointer: a dot on the part and the far end of its line, where the name
 * sits. Everything in between is derived, so no pair of points draws a broken
 * line - the old callouts stored sides and a route as well, and most of their
 * combinations were invalid.
 */
export interface CarLabel {
  id: string;
  text: string;
  /**
   * The part hovering this label lights up, by its id in car-part-mattes.json.
   * A label without one only points.
   */
  part?: string;
  dot: LabelPoint;
  end: LabelPoint;
}

/** Labels by chapter id, which is the shape carLabels.json is saved in. */
export type CarLabelSet = Record<string, CarLabel[]>;

export type LabelSide = "left" | "right";

export const LABEL_STYLE = {
  stroke: 3,
  dotRadius: 6.5,
  dotRing: 2.5,
  haloRadius: 12,
  /** Gap between the run and the name sitting on top of it. */
  textLift: 7,
  /** How far the run carries on past the name, on the knee side. */
  runPadding: 14,
  maxTextLength: 40,
} as const;

export const CAR_LABELS: CarLabelSet = savedLabels;

/**
 * Mask files by chapter and part, written by artifacts/export-part-mattes.mjs
 * from mattes rendered off the same camera as each pause's still.
 */
export type PartMattes = Record<string, Record<string, string>>;

export const CAR_PART_MATTES = Object.fromEntries(
  Object.entries(partMattes).filter(([key]) => !key.startsWith("_")),
) as PartMattes;

/**
 * A part's mask in the frame set on screen. Both sets name their masks alike, so
 * the manifest's file (and its content hash) serves either one.
 */
export const partMatteUrl = (
  set: FrameSourceLike,
  chapterId: string,
  part: string,
  mattes: PartMattes = CAR_PART_MATTES,
) => {
  const file = mattes[chapterId]?.[part];
  return file ? matteUrl(set, chapterId, file) : null;
};

/** "master-cylinders" reads as "Master cylinders" in the placement tool. */
export const partName = (part: string) =>
  `${part.charAt(0).toUpperCase()}${part.slice(1).replace(/-/g, " ")}`;

export interface LabelBox {
  width: number;
  height: number;
}

export interface PixelPoint {
  x: number;
  y: number;
}

export interface LabelGeometry {
  side: LabelSide;
  dot: PixelPoint;
  knee: PixelPoint;
  end: PixelPoint;
  path: string;
}

export const labelSide = (label: Pick<CarLabel, "dot" | "end">): LabelSide =>
  label.end.x < label.dot.x ? "left" : "right";

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * The hockey stick, in the pixels it is drawn at: a 45 degree rise out of the
 * dot to the end's height, then a straight run out to the end.
 *
 * It has to be worked out in pixels rather than percent - the still is 16:9, so
 * equal percentages are not equal distances and the angle would not be 45. The
 * run is never shorter than the name on it plus a little padding: an end dragged
 * back inside that is pushed out again, so every placement draws a whole line.
 */
export const labelGeometry = (
  label: Pick<CarLabel, "dot" | "end">,
  box: LabelBox,
  textWidth = 0,
): LabelGeometry => {
  const side = labelSide(label);
  const direction = side === "left" ? -1 : 1;
  const dot = {
    x: (label.dot.x / 100) * box.width,
    y: (label.dot.y / 100) * box.height,
  };
  const target = {
    x: (label.end.x / 100) * box.width,
    y: (label.end.y / 100) * box.height,
  };
  const rise = Math.abs(target.y - dot.y);
  const knee = { x: dot.x + direction * rise, y: target.y };
  const run = Math.max(
    direction * (target.x - knee.x),
    textWidth + LABEL_STYLE.runPadding,
  );
  const end = { x: knee.x + direction * run, y: target.y };

  return {
    side,
    dot,
    knee,
    end,
    path: [dot, knee, end]
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"} ${round(point.x)} ${round(point.y)}`,
      )
      .join(" "),
  };
};

/**
 * The column an end should snap into, if one is close enough. Names on the same
 * side read as a list when their runs finish at the same x.
 */
export const snapToColumn = (
  value: number,
  columns: number[],
  threshold: number,
): number | null => {
  let best: number | null = null;
  columns.forEach((column) => {
    const distance = Math.abs(column - value);
    if (distance > threshold) return;
    if (best === null || distance < Math.abs(best - value)) best = column;
  });
  return best;
};

interface ChapterRef {
  id: string;
  label: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isPercentPoint = (value: unknown): value is LabelPoint =>
  isRecord(value) &&
  [value.x, value.y].every(
    (coordinate) =>
      typeof coordinate === "number" &&
      Number.isFinite(coordinate) &&
      coordinate >= 0 &&
      coordinate <= 100,
  );

/** Every reason a label set cannot be saved, worded for the placement tool. */
export const validateCarLabels = (
  value: unknown,
  chapters: readonly ChapterRef[],
  mattes: PartMattes = CAR_PART_MATTES,
): string[] => {
  if (!isRecord(value)) return ["Labels must be an object keyed by chapter"];

  const errors: string[] = [];
  const ids = new Set<string>();
  const known = new Map(chapters.map((chapter) => [chapter.id, chapter.label]));

  Object.entries(value).forEach(([chapterId, labels]) => {
    const name = known.get(chapterId);
    if (!name) {
      errors.push(`Unknown chapter: ${chapterId}`);
      return;
    }
    if (!Array.isArray(labels)) {
      errors.push(`${name}: labels must be a list`);
      return;
    }
    labels.forEach((label: unknown, index) => {
      const where = `${name}, label ${index + 1}`;
      if (!isRecord(label)) {
        errors.push(`${where} is not a label`);
        return;
      }
      if (typeof label.id !== "string" || !label.id) {
        errors.push(`${where} has no id`);
      } else if (ids.has(label.id)) {
        errors.push(`${where} reuses the id ${label.id}`);
      } else {
        ids.add(label.id);
      }
      if (typeof label.text !== "string" || !label.text.trim()) {
        errors.push(`${where} has no text`);
      } else if (label.text.trim().length > LABEL_STYLE.maxTextLength) {
        errors.push(
          `${where} is longer than ${LABEL_STYLE.maxTextLength} characters`,
        );
      }
      if (
        label.part !== undefined &&
        (typeof label.part !== "string" || !mattes[chapterId]?.[label.part])
      ) {
        errors.push(
          `${where} highlights ${JSON.stringify(label.part)}, which has no mask on this pause`,
        );
      }
      if (!isPercentPoint(label.dot)) errors.push(`${where} has its dot off the image`);
      if (!isPercentPoint(label.end)) errors.push(`${where} has its end off the image`);
    });
  });

  return errors;
};

/**
 * The saved form: every chapter present and in sequence order, text trimmed, and
 * coordinates at two decimals so a save only changes what was actually moved.
 */
export const normalizeCarLabels = (
  labels: CarLabelSet,
  chapters: readonly ChapterRef[],
): CarLabelSet =>
  Object.fromEntries(
    chapters.map((chapter) => [
      chapter.id,
      (labels[chapter.id] ?? []).map((label) => ({
        id: label.id,
        text: label.text.trim(),
        ...(label.part ? { part: label.part } : {}),
        dot: { x: round(label.dot.x), y: round(label.dot.y) },
        end: { x: round(label.end.x), y: round(label.end.y) },
      })),
    ]),
  );
