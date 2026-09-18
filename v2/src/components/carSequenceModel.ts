export const SEQUENCE_CONFIG = {
  basePath: "/renders-sr26/full",
  layersPath: "/renders-sr26/layers",
  frameCount: 120,
  filenameDigits: 4,
  extension: "webp",
  nativeWidth: 1920,
  nativeHeight: 1080,
} as const;

export const CHAPTER_TIMING = {
  framesPerViewport: 30,
  minimumRotation: 0.35,
  reveal: 0.22,
  hold: 0.58,
  hide: 0.2,
  // A pushed removal covers ~6x its starting distance, so it needs room to
  // travel: at 24 frames this is about the same scroll-per-frame as the crane.
  push: 0.9,
  // Fraction of the push the part has to be gone by. The renders dissolve the
  // tire's shadow over the first half too, so the light opens up behind it.
  pushPartFade: 0.5,
} as const;

/**
 * Scroll, in viewports, a pause keeps for its labels. The labels are not
 * scrubbed - they play on their own clock (LABEL_MOTION) once the scroll reaches
 * the pause - but the pause still budgets for them: `in` is room while they draw,
 * `read` is room to read them, and `out` is room before the image changes, so a
 * steady scroll has them gone before anything moves. Each further label adds a
 * stagger to `in` and `out`.
 */
export const LABEL_TIMING = {
  in: 0.19,
  inStagger: 0.04,
  out: 0.14,
  outStagger: 0.02,
  read: 0.45,
} as const;

/**
 * Seconds. A label draws out of its part: the dot lands, the line runs out from
 * it, and the name opens along the run as the line gets there. Labels follow one
 * another a stagger apart, and leave by playing it all back `leave` times faster.
 */
export const LABEL_MOTION = {
  dot: 0.3,
  // The line leaves the dot this far into the dot's pop.
  lineAt: 0.15,
  line: 0.55,
  // How far through the line the name starts opening: roughly where the 45 degree
  // stroke turns into the run the name sits on.
  nameAt: 0.55,
  name: 0.4,
  stagger: 0.07,
  leave: 2.2,
  // How long the playhead has to stay on a pause before its labels start.
  settle: 0.12,
} as const;

/** Where on the scroll timeline a pause's labels belong on screen. */
export interface LabelWindow {
  from: number;
  to: number;
}

/**
 * Whether the labels belong up at a point of the timeline. Asked on every update
 * rather than on crossing an edge, so a scroll that jumps clean over a pause
 * never plays its labels at all.
 */
export const labelsUp = ({ from, to }: LabelWindow, time: number) =>
  time >= from && time < to;

/**
 * Scrolling down onto a labelled pause holds the page on it until the labels
 * have drawn and had a moment to be read, so a scroll that never stops still
 * sees them. Seconds, except where noted:
 *   glide   the move onto the pause
 *   anchor  where in the pause's stretch it lands (0 is its start, 1 its end)
 *   read    how long the drawn labels stay held
 *   limit   the longest any hold lasts, whatever the labels are doing
 * Only scrolling the visitor is driving holds: their last wheel, touch or key has
 * to be under `intent` old, and a jump that lands more than `jump` viewports
 * past the pause - a dragged scrollbar, End - goes straight through.
 */
export const LABEL_HOLD = {
  glide: 0.4,
  anchor: 0.3,
  read: 0.3,
  limit: 3,
  intent: 0.3,
  jump: 1,
} as const;

/** Whether the scroll just came down onto a pause from above it. */
export const arrivesGoingDown = (
  { from, to }: LabelWindow,
  previous: number,
  time: number,
) => previous < from && time >= from && time < to + LABEL_HOLD.jump;

export const labelsInDuration = (count: number) =>
  count ? LABEL_TIMING.in + (count - 1) * LABEL_TIMING.inStagger : 0;

export const labelsOutDuration = (count: number) =>
  count ? LABEL_TIMING.out + (count - 1) * LABEL_TIMING.outStagger : 0;

/**
 * How long a beat holds still. The hold was sized for one card; a pause with
 * several labels holds long enough for them to draw in, stay up for `read`, and
 * clear before the camera moves. `still` is scroll either side of the hold where
 * the pose is not moving anyway - an isolate's reveal and hide - which the
 * labels can use as well.
 */
export const beatHold = (labelCount: number, still = 0) =>
  labelCount
    ? Math.max(
        CHAPTER_TIMING.hold,
        labelsInDuration(labelCount) +
          LABEL_TIMING.read +
          labelsOutDuration(labelCount) -
          still,
      )
    : CHAPTER_TIMING.hold;

/** How many labels the pause at a frame has, for sizing its hold. */
export type LabelCount = (frame: number) => number;

const noLabels: LabelCount = () => 0;

// Reveal layers rendered from Blender. Each reveal is pinned to the orbit frame it
// was rendered at - a layer only lines up with the canvas on that exact frame.
//   "remove"  - a base layer stands in for the canvas while a part blurs off it
//   "isolate" - the car blurs away to expose a part rendered underneath
// Anything that leaves the orbit for a viewpoint it cannot reach belongs to the
// excursion below instead, which is a chain of moves rather than one beat.
export type RevealKind = "remove" | "isolate";

export interface CarReveal {
  id: string;
  frame: number;
  kind: RevealKind;
  blur: number;
  base?: string;
  part?: string;
  isolate?: string;
  /**
   * Rendered dolly from the orbit pose into a closeup, played while a "remove"
   * beat runs: `base` and `part` advance together, so the part blurs away as the
   * camera arrives instead of the camera sitting still for it. Frame 1 is the
   * orbit pose, which is what lets the canvas hand over unseen. `partCount` is
   * short because the part is gone long before the camera lands.
   */
  push?: {
    base: string;
    part: string;
    count: number;
    partCount: number;
    /**
     * The beat opens on the closeup instead of travelling to it: the excursion's
     * last leg already lands on the pose this push ends at, so playing the push
     * in would repeat a move the camera has just made. Only the hold and the way
     * back out are played, and that way out is the zoom that hands the orbit back.
     */
    landed?: boolean;
    /**
     * Rendered leg out of the closeup and onto a *different* orbit frame, played
     * instead of backing out the way the push came in. Frame 1 is the pose the
     * push landed on and the last frame is the orbit pose at `toFrame`, which is
     * where the canvas takes over again - so the beat leaves for somewhere else
     * rather than rewinding, and the rotation that would have followed it is not
     * needed. The part fades back in over the leg's first stretch, which is why
     * `partCount` here covers every pose instead of just the opening few: it is
     * still on screen at the last one.
     */
    exit?: {
      base: string;
      part: string;
      count: number;
      partCount: number;
      toFrame: number;
    };
  };
}

export const CAR_REVEALS: CarReveal[] = [
  {
    // Two things are being shown here, not one, and they are 0.75m apart on the
    // car: the rotor and caliper on the near front corner, and the pedal box the
    // nose sits over. So the camera does not dolly straight in from the side any
    // more - it swings to a front-three-quarter and rises to 32 deg, which is the
    // only family of poses that holds both. The angle was measured rather than
    // guessed: azimuth barely changes how much of the brake corner is visible,
    // but elevation drives the pedal box hard (18% of it reads at 15 deg, 31% at
    // 35), and 45/32 is the joint best.
    //
    // What fades is the near tire AND the nose top deck, as one layer - the rotor
    // comes out from behind the wheel while the master cylinders come out from
    // under the lid, on the same scroll. Only the deck goes: at a down-angle you
    // look into the nose from above, so the fascia and the lower side panels cost
    // nothing (0.285 of the pedal box visible with just the deck off, 0.320 with
    // all four front panels off) and keeping them keeps the livery in shot.
    //
    // It opens the sequence: frame 0 is the head-on nose view, so this plays
    // before the orbit has turned anywhere, and the side profile is what the
    // orbit rotates to afterwards for the frame beat. Starting head-on also puts
    // the two front tires side by side instead of one behind the other, so
    // neither ghosts through the other as they dissolve.
    //
    // The layers are the first frame of each sequence - identical images, named
    // for it. See artifacts/render-brake-arc.py; the straight-push layers this
    // replaces are still in layers/ and can be put back by flipping these names.
    id: "brakes",
    frame: 0,
    kind: "remove",
    blur: 18,
    base: "brake-arc/000-brake-arc-0001",
    part: "brake-arc/000-brake-cover-0001",
    push: {
      base: "brake-arc/000-brake-arc",
      part: "brake-arc/000-brake-cover",
      count: 30,
      partCount: 18,
      // Out to the side profile rather than back to the nose: the frame beat
      // plays there, so rewinding to frame 0 only to rotate away again would
      // show the same 45 degrees of orbit twice.
      exit: {
        base: "brake-arc/brake-exit",
        part: "brake-arc/brake-exit-cover",
        count: 30,
        partCount: 30,
        toFrame: 31,
      },
    },
  },
  { id: "frame", frame: 31, kind: "isolate", blur: 14, isolate: "031-frame" },
  {
    // The suspension, close enough to read how one corner is put together: the
    // near-side front corner alone. One corner rather than one side - fitting the
    // rear arm in too costs the closeup, and this is the corner with something to
    // look at. Frame 109 picks the azimuth the closeup ends up looking from, 124
    // deg, with the nose turned toward the viewer.
    //
    // The camera no longer travels here from the orbit: the cockpit run flies
    // straight onto this closeup and dissolves the wheels on the way, so the beat
    // is `landed`. It opens on the pose the push ends at and plays only the way
    // back out - the zoom that hands the orbit back at frame 108, where the push
    // still starts from and the canvas can take over unseen.
    // See artifacts/render-susp-corner.py and artifacts/render-cockpit-susp.py.
    id: "suspension-side",
    frame: 108,
    kind: "remove",
    blur: 18,
    base: "108-susp-corner-0001",
    part: "108-susp-corner-wheels-0001",
    push: {
      base: "108-susp-corner",
      part: "108-susp-corner-wheels",
      count: 24,
      partCount: 14,
      landed: true,
    },
  },
];

/**
 * One leg of a rendered camera move. Every leg's first frame is the pose the
 * previous step left the camera on, which is what lets the site cut between
 * them - and between the canvas and the first leg - without a visible step.
 */
export interface ExcursionMove {
  kind: "move";
  prefix: string;
  count: number;
}

/** The car blurs away at the pose the previous leg landed on, exposing a layer. */
export interface ExcursionIsolate {
  kind: "isolate";
  frame: number;
  layer: string;
  blur: number;
}

/** The pose itself is the reveal; the beat just holds there. */
export interface ExcursionHold {
  kind: "hold";
  frame: number;
}

export type ExcursionStep = ExcursionMove | ExcursionIsolate | ExcursionHold;

/**
 * A chain of rendered camera moves that leaves the orbit, plays a few beats at
 * poses the orbit cannot reach, and rejoins it somewhere else entirely.
 *
 * The orbit is planar and 6 m out. Three of the four things worth showing here
 * are not on it: the drivetrain reads as a chain only from overhead, the wheel
 * only from the driver's seat, and neither is reachable by rotating. So the
 * camera lifts off at `fromFrame`, and everything between there and `toFrame`
 * is rendered rather than orbited. The canvas is switched off for the whole
 * run, with the playhead carried under it so it is already sitting on
 * `toFrame` when the last leg lands.
 *
 * `toFrame` is deliberately most of a turn past `fromFrame`: the run ends on the
 * far side of the car, so the orbit never plays its rear half at all. That is
 * the point of routing through the cockpit rather than craning back down.
 */
export interface CarExcursion {
  id: string;
  /** Orbit frame the camera lifts off from - the previous chapter's pause. */
  fromFrame: number;
  /** Orbit frame the last leg lands on, where the canvas takes over again. */
  toFrame: number;
  steps: ExcursionStep[];
}

export const CAR_EXCURSION: CarExcursion = {
  id: "cockpit-run",
  fromFrame: 31,
  toFrame: 108,
  steps: [
    // Off the side view and straight overhead. See artifacts/render-crane.py.
    { kind: "move", prefix: "059-crane-up", count: 30 },
    // Engine and driveline read as one chain from up here and nowhere else.
    { kind: "isolate", frame: 59, layer: "059-drivetrain-top", blur: 14 },
    // Overhead still, turning the car upright: nose to the top of the page. That
    // is not decoration - it puts screen-right on the car's right side, which is
    // where the wheel's own frame already puts it, so the dive that follows needs
    // no roll of its own and reads as one continuous fall.
    { kind: "move", prefix: "cockpit-roll", count: 20 },
    // Down the corridor between the cage rails and into the driver's seat.
    { kind: "move", prefix: "cockpit-dive", count: 40 },
    // Square on the wheel. Nothing dissolves here - arriving is the reveal.
    { kind: "hold", frame: 76 },
    // Up the same corridor, out over the left side, and down onto the front
    // corner itself - not back out to the orbit. The suspension beat used to be
    // reached by flying 6 m out to frame 108 and immediately pushing back in,
    // which walked the viewer away from the car and then back to it; this leg
    // lands on the pose that push ends at, so the beat opens already there and
    // only its way back out is still played. The old `cockpit-exit` leg is
    // orphaned but kept in layers/. See artifacts/render-cockpit-susp.py.
    { kind: "move", prefix: "cockpit-susp", count: 40 },
  ],
};

/**
 * A place the sequence stops to point things out. Its labels live in
 * carLabels.json, keyed by `id`, which is what the placement tool saves to.
 */
export interface CarChapter {
  id: string;
  label: string;
  pauseFrame: number;
}

export const CAR_CHAPTERS: CarChapter[] = [
  // Frame 0, not 31: the beat opens the sequence from the head-on nose view,
  // and the orbit's first rotation is the one that follows it out to the side
  // profile for the frame beat. The timeline skips a rotation whose target is
  // the frame it is already on, so this costs no scroll.
  { id: "brakes", label: "Braking", pauseFrame: 0 },
  { id: "frame", label: "Frame", pauseFrame: 31 },
  // The overhead view is the only place engine and driveline read as one chain,
  // so they share the pause.
  { id: "drivetrain", label: "Engine & drivetrain", pauseFrame: 59 },
  { id: "electronics", label: "Electronics", pauseFrame: 76 },
  // Labels here sit on the corner closeup the push lands on, not the orbit frame
  // it starts from - see pauseLayerUrl.
  { id: "suspension", label: "Suspension", pauseFrame: 108 },
];

// Frames are indexed 0-based here, but the rendered files are 1-based Blender
// frames, so index i resolves to (i + 1).webp. Reveal layers are named after the
// pauseFrame they belong to and must therefore be RENDERED at pauseFrame + 1 -
// one orbit frame is ~3 degrees, which reads as the layer sitting visibly off to
// one side of the car. See artifacts/render-layers.py.
export const frameUrl = (index: number) =>
  `${SEQUENCE_CONFIG.basePath}/${String(index + 1).padStart(
    SEQUENCE_CONFIG.filenameDigits,
    "0",
  )}.${SEQUENCE_CONFIG.extension}`;

export const layerUrl = (name: string) =>
  `${SEQUENCE_CONFIG.layersPath}/${name}.${SEQUENCE_CONFIG.extension}`;

export const sequenceLayerUrl = (prefix: string, index: number) =>
  layerUrl(
    `${prefix}-${String(index + 1).padStart(SEQUENCE_CONFIG.filenameDigits, "0")}`,
  );

export const revealsForFrame = (frame: number) =>
  CAR_REVEALS.filter((reveal) => reveal.frame === frame);

export const rotationDuration = (fromFrame: number, toFrame: number) =>
  Math.max(
    CHAPTER_TIMING.minimumRotation,
    Math.abs(toFrame - fromFrame) / CHAPTER_TIMING.framesPerViewport,
  );

/**
 * Scroll length of one excursion step, in viewport heights.
 *
 * A rendered leg is paced like the orbit it replaces - the same frames per
 * viewport - so the camera never visibly changes speed when it leaves the orbit
 * or rejoins it. A "hold" gets the hold alone: there is no reveal to fade in or
 * out, so spending the reveal and hide on it would be a stalled screen. Either
 * kind of beat holds longer when it has labels to read.
 */
export const excursionStepDuration = (
  step: ExcursionStep,
  labelCount: LabelCount = noLabels,
) => {
  switch (step.kind) {
    case "move":
      return Math.max(
        CHAPTER_TIMING.minimumRotation,
        step.count / CHAPTER_TIMING.framesPerViewport,
      );
    case "isolate":
      return (
        CHAPTER_TIMING.reveal +
        beatHold(
          labelCount(step.frame),
          CHAPTER_TIMING.reveal + CHAPTER_TIMING.hide,
        ) +
        CHAPTER_TIMING.hide
      );
    case "hold":
      return beatHold(labelCount(step.frame));
  }
};

export interface ExcursionSlot {
  step: ExcursionStep;
  start: number;
  duration: number;
}

/** Every step with the offset it starts at, measured from the excursion's start. */
export const excursionSlots = (
  excursion: CarExcursion,
  labelCount: LabelCount = noLabels,
): ExcursionSlot[] => {
  let cursor = 0;
  return excursion.steps.map((step) => {
    const duration = excursionStepDuration(step, labelCount);
    const slot = { step, start: cursor, duration };
    cursor += duration;
    return slot;
  });
};

export const excursionDuration = (
  excursion: CarExcursion,
  labelCount: LabelCount = noLabels,
) =>
  excursion.steps.reduce(
    (total, step) => total + excursionStepDuration(step, labelCount),
    0,
  );

/**
 * Frames the excursion plays its beats on. Their chapters supply the labels, but
 * the orbit must never stop on them - the camera is nowhere near the orbit when
 * they run.
 */
export const excursionStopFrames = (excursion: CarExcursion) =>
  new Set(
    excursion.steps.flatMap((step) => (step.kind === "move" ? [] : [step.frame])),
  );

/**
 * The orbit frames the canvas ever paints.
 *
 * The excursion lifts off at `fromFrame` and lands at `toFrame`, and the orbit
 * in between is never seen - the playhead crosses it with the canvas switched
 * off. Those frames are still on disk; they are simply not worth fetching.
 */
export const orbitFrameSet = (
  excursion: CarExcursion,
  frameCount = SEQUENCE_CONFIG.frameCount,
) => {
  const frames = new Set<number>();
  for (let index = 0; index < frameCount; index += 1) {
    if (index > excursion.fromFrame && index < excursion.toFrame) continue;
    frames.add(index);
  }
  return frames;
};

/** The chapters the canvas still rotates to, in order. */
export const orbitChapters = (
  chapters: CarChapter[],
  excursion: CarExcursion,
) => {
  const stops = excursionStopFrames(excursion);
  return chapters.filter((chapter) => !stops.has(chapter.pauseFrame));
};

/**
 * The still on screen while a pause's labels are up, or null when that is the
 * orbit canvas itself. Labels are placed in percent of this image, so the
 * calibration tool has to show it rather than the orbit frame the pause is keyed
 * to - the camera is usually nowhere near the orbit by then.
 *
 * Mirrors the timeline: an excursion beat plays at the pose its leg left, an
 * isolate is what is left once the car blurs away, and a push that is the
 * frame's only beat hangs its labels on the top of the move.
 */
export const pauseLayerUrl = (
  frame: number,
  reveals: CarReveal[] = CAR_REVEALS,
  excursion: CarExcursion = CAR_EXCURSION,
): string | null => {
  const beat = excursion.steps.findIndex(
    (step) => step.kind !== "move" && step.frame === frame,
  );
  if (beat !== -1) {
    const step = excursion.steps[beat];
    if (step.kind === "isolate") return layerUrl(step.layer);
    const leg = excursion.steps
      .slice(0, beat)
      .findLast((candidate) => candidate.kind === "move");
    return leg?.kind === "move"
      ? sequenceLayerUrl(leg.prefix, leg.count - 1)
      : null;
  }

  const here = reveals.filter((reveal) => reveal.frame === frame);
  const isolate = here.find((reveal) => reveal.kind === "isolate");
  if (isolate?.isolate) return layerUrl(isolate.isolate);
  const push = here.find((reveal) => reveal.push)?.push;
  if (push) return sequenceLayerUrl(push.base, push.count - 1);
  return null;
};

export const nearestLoadedFrame = (
  requestedFrame: number,
  loadedFrames: ReadonlySet<number>,
  frameCount = SEQUENCE_CONFIG.frameCount,
) => {
  const requested = Math.min(Math.max(Math.round(requestedFrame), 0), frameCount - 1);
  if (loadedFrames.has(requested)) return requested;

  for (let distance = 1; distance < frameCount; distance += 1) {
    const lower = requested - distance;
    const upper = requested + distance;
    if (lower >= 0 && loadedFrames.has(lower)) return lower;
    if (upper < frameCount && loadedFrames.has(upper)) return upper;
  }

  return null;
};

export const validateCarSequence = (
  chapters: CarChapter[],
  frameCount = SEQUENCE_CONFIG.frameCount,
) => {
  const errors: string[] = [];
  const chapterIds = new Set<string>();
  let previousFrame = -1;

  chapters.forEach((chapter) => {
    if (chapterIds.has(chapter.id)) errors.push(`Duplicate chapter id: ${chapter.id}`);
    chapterIds.add(chapter.id);

    if (chapter.pauseFrame < 0 || chapter.pauseFrame >= frameCount) {
      errors.push(`Frame out of range: ${chapter.id}`);
    }
    // One chapter per pause: its labels are placed on that pause's still, so two
    // chapters on one frame would be two sets of labels fighting over one image.
    if (chapter.pauseFrame <= previousFrame) {
      errors.push(`Chapters are not in ascending frame order: ${chapter.id}`);
    }
    previousFrame = chapter.pauseFrame;
  });

  return errors;
};

export const validateCarExcursion = (
  excursion: CarExcursion,
  chapters: CarChapter[],
  frameCount = SEQUENCE_CONFIG.frameCount,
  reveals: CarReveal[] = CAR_REVEALS,
) => {
  const errors: string[] = [];
  const inRange = (frame: number) => frame >= 0 && frame < frameCount;

  if (!inRange(excursion.fromFrame)) errors.push("fromFrame out of range");
  if (!inRange(excursion.toFrame)) errors.push("toFrame out of range");

  const pauses = new Set(chapters.map((chapter) => chapter.pauseFrame));
  // The camera has to be somewhere the canvas can hand over from, and somewhere
  // it can hand back to - so the run has to start and end on an orbit stop.
  if (!pauses.has(excursion.fromFrame)) {
    errors.push("fromFrame is not a chapter the orbit stops on");
  }
  if (!pauses.has(excursion.toFrame)) {
    errors.push("toFrame is not a chapter the orbit stops on");
  }

  // A landed beat spends no scroll arriving, because the excursion's last leg
  // flew the camera onto its closeup. Anywhere else there is nothing to open on.
  reveals.forEach((reveal) => {
    if (reveal.push?.landed && reveal.frame !== excursion.toFrame) {
      errors.push(`Landed beat is not where the excursion lands: ${reveal.id}`);
    }
  });

  const { steps } = excursion;
  if (steps.at(0)?.kind !== "move") errors.push("Excursion must open with a move");
  if (steps.at(-1)?.kind !== "move") errors.push("Excursion must close with a move");

  steps.forEach((step, index) => {
    if (step.kind === "move") {
      // One frame is a still, not a move, and the site cross-fades between a
      // leg's first and last frames - so it needs both.
      if (step.count < 2) errors.push(`Move too short: ${step.prefix}`);
      return;
    }
    // A beat plays at whatever pose the previous leg landed on. Opening on one,
    // or stacking two, means there is no such pose or it is reused silently.
    if (steps[index - 1]?.kind !== "move") {
      errors.push(`Beat without a move before it: frame ${step.frame}`);
    }
    if (!pauses.has(step.frame)) {
      errors.push(`Beat frame has no chapter: ${step.frame}`);
    }
    if (step.frame === excursion.fromFrame || step.frame === excursion.toFrame) {
      errors.push(`Beat frame collides with an orbit stop: ${step.frame}`);
    }
  });

  return errors;
};
