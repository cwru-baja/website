// The frames /car plays, in order, as paths relative to a render root
// (renders-sr26/ for today's 16:9 set, renders-sr26/portrait-preview/<option>/
// for a portrait preview - both use the same names). Built from the sequence
// model's own data so it follows the real page; the holds are just repeats.
import {
  CAR_CHAPTERS,
  CAR_EXCURSION,
  CAR_REVEALS,
  SEQUENCE_CONFIG,
} from "@/components/carSequenceModel";

export interface LabFrame {
  /** Path under a render root. */
  base: string;
  /** A layer drawn over the base - a part fading in or out - and its opacity. */
  overlay?: { path: string; opacity: number };
  /** What's on screen, for the readout. */
  label: string;
  /** Set on the frames of a pause, with the chapter it belongs to. */
  chapter?: string;
}

const HOLD = 10;
const pad = (n: number) => String(n).padStart(SEQUENCE_CONFIG.filenameDigits, "0");
const ext = SEQUENCE_CONFIG.extension;
const orbit = (index: number) => `full/${pad(index + 1)}.${ext}`;
const leg = (prefix: string, index: number) => `layers/${prefix}-${pad(index + 1)}.${ext}`;
const layer = (name: string) => `layers/${name}.${ext}`;
const chapterAt = (frame: number) =>
  CAR_CHAPTERS.find((chapter) => chapter.pauseFrame === frame)?.label;

function hold(frames: LabFrame[], frame: LabFrame, chapter?: string) {
  for (let i = 0; i < HOLD; i += 1) frames.push({ ...frame, chapter });
}

export function labSequence(): LabFrame[] {
  const frames: LabFrame[] = [];
  const brakes = CAR_REVEALS.find((reveal) => reveal.id === "brakes");
  const frameBeat = CAR_REVEALS.find((reveal) => reveal.id === "frame");
  const suspension = CAR_REVEALS.find((reveal) => reveal.id === "suspension-side");

  // Head-on, then the brake arc in, its still, and the arc back out to the side.
  frames.push({ base: orbit(0), label: "Orbit 0 (head-on)" });
  const push = brakes?.push;
  if (push) {
    for (let i = 0; i < push.count; i += 1) {
      frames.push({
        base: leg(push.base, i),
        overlay:
          i < push.partCount
            ? { path: leg(push.part, i), opacity: 1 - i / Math.max(push.partCount - 1, 1) }
            : undefined,
        label: `Brake arc ${i + 1}/${push.count}`,
      });
    }
    hold(frames, { base: leg(push.base, push.count - 1), label: "Brake still" }, chapterAt(0));
    const exit = push.exit;
    if (exit) {
      for (let i = 0; i < exit.count; i += 1) {
        frames.push({
          base: leg(exit.base, i),
          overlay:
            i < exit.partCount
              ? { path: leg(exit.part, i), opacity: i / Math.max(exit.partCount - 1, 1) }
              : undefined,
          label: `Brake exit ${i + 1}/${exit.count}`,
        });
      }
    }
  }

  // The side profile and its frame-tube isolate.
  const side = frameBeat?.frame ?? 31;
  frames.push({ base: orbit(side), label: `Orbit ${side} (side)` });
  if (frameBeat?.isolate) {
    hold(frames, { base: layer(frameBeat.isolate), label: "Frame isolate" }, chapterAt(side));
  }

  // The cockpit run: crane up, drivetrain overhead, roll, dive, the wheel, out
  // onto the suspension corner.
  let last: LabFrame | undefined;
  for (const step of CAR_EXCURSION.steps) {
    if (step.kind === "move") {
      for (let i = 0; i < step.count; i += 1) {
        last = { base: leg(step.prefix, i), label: `${step.prefix} ${i + 1}/${step.count}` };
        frames.push(last);
      }
    } else if (step.kind === "isolate") {
      hold(frames, { base: layer(step.layer), label: step.layer }, chapterAt(step.frame));
    } else if (last) {
      hold(frames, { ...last, label: `Hold on ${last.label}` }, chapterAt(step.frame));
    }
  }

  // The suspension beat is landed: it opens on the closeup and plays only the
  // way back out, the wheels returning, onto the orbit it hands back to.
  const corner = suspension?.push;
  if (corner) {
    hold(frames, { base: leg(corner.base, corner.count - 1), label: "Suspension still" }, chapterAt(suspension.frame));
    for (let i = corner.count - 1; i >= 0; i -= 1) {
      frames.push({
        base: leg(corner.base, i),
        overlay:
          i < corner.partCount
            ? { path: leg(corner.part, i), opacity: 1 - i / Math.max(corner.partCount - 1, 1) }
            : undefined,
        label: `Suspension out ${corner.count - i}/${corner.count}`,
      });
    }
  }
  const from = suspension?.frame ?? CAR_EXCURSION.toFrame;
  for (let index = from; index < SEQUENCE_CONFIG.frameCount; index += 1) {
    frames.push({ base: orbit(index), label: `Orbit ${index}` });
  }
  return frames;
}
