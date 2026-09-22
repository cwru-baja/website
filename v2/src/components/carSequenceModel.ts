export const SEQUENCE_CONFIG = {
  frameCount: 120,
  filenameDigits: 4,
  /** The format every set has its frames in; see FRAME_SETS for any others. */
  extension: "webp",
} as const;

/**
 * The same sequence is rendered twice: 16:9 for anything held wide, and 4:5 for
 * a phone held upright, where a 16:9 frame would play in a strip a quarter of
 * the screen tall. Both sets use the same file names under their own root -
 * full/ for the orbit, layers/ for legs and reveals, mattes/ for the part masks
 * - so every URL below is the same path with a different root. The one place the
 * sets part ways is the cockpit run, which phones play differently (see
 * PORTRAIT_EXCURSION): their crane has ten more frames and they have no roll.
 *
 * A page load uses exactly one set: it is chosen once, before the first frame is
 * requested, and turning the phone afterwards letterboxes the set already
 * loading rather than fetching the other one.
 */
export type FrameSet = "landscape" | "portrait";

/**
 * The landscape set is also encoded as AVIF (artifacts/export-frames.mjs): about
 * a third smaller than its WebP and never worse on SSIM, PSNR or VMAF. It goes
 * only to engines that decode it at least as fast as the WebP - Chromium and
 * Firefox. Safari, and every iOS browser with it, decodes these frames ~65%
 * slower as AVIF (24 vs 15 ms each), which the canvas pays on the main thread
 * whenever a scrub outruns the decoder, so it keeps the WebP. Measured
 * 2026-09-18; the portrait set is WebP only.
 */
export type FrameFormat = "avif" | "webp";

/** The frames one page load fetches: which set, in which format. */
export interface FrameSource {
  set: FrameSet;
  format: FrameFormat;
}

/** A set named on its own means its WebP files, which every set has. */
export type FrameSourceLike = FrameSet | FrameSource;

const sourceOf = (source: FrameSourceLike): FrameSource =>
  typeof source === "string" ? { set: source, format: SEQUENCE_CONFIG.extension } : source;

export const FRAME_SETS = {
  landscape: { root: "/renders-sr26", width: 16, height: 9, formats: ["avif", "webp"] },
  portrait: { root: "/renders-sr26/portrait", width: 4, height: 5, formats: ["webp"] },
} as const satisfies Record<
  FrameSet,
  { root: string; width: number; height: number; formats: readonly FrameFormat[] }
>;

/** The screens the portrait set is for: phones, and small tablets, held upright. */
export const PORTRAIT_SET_MEDIA = "(orientation: portrait) and (max-width: 1023px)";

/** Which set a screen gets, given a matchMedia-style test. */
export const pickFrameSet = (matches: (query: string) => boolean): FrameSet =>
  matches(PORTRAIT_SET_MEDIA) ? "portrait" : "landscape";

/**
 * Which format a set is fetched in: AVIF where the set has it, the browser can
 * decode it, and the engine is not Apple's (see FrameFormat); WebP otherwise.
 */
export const pickFrameFormat = (
  set: FrameSet,
  browser: { avif: boolean; apple: boolean },
): FrameFormat =>
  browser.avif &&
  !browser.apple &&
  (FRAME_SETS[set].formats as readonly FrameFormat[]).includes("avif")
    ? "avif"
    : "webp";

/**
 * A 2x2 AVIF encoded the way the frames are (8-bit 4:4:4 with alpha, which needs
 * AV1's High profile), so a browser that can't decode the frames fails this too.
 */
export const AVIF_PROBE =
  "data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUEAAAGGbWV0YQAAAAAAAAAhaGRscgAAAAAAAAAA" +
  "cGljdAAAAAAAAAAAAAAAAAAAAAAOcGl0bQAAAAAAAQAAACxpbG9jAAAAAEQAAAIAAQAAAAEAAAG+AAAA" +
  "JQACAAAAAQAAAa4AAAAQAAAAQmlpbmYAAAAAAAIAAAAaaW5mZQIAAAAAAQAAYXYwMUNvbG9yAAAAABpp" +
  "bmZlAgAAAAACAABhdjAxQWxwaGEAAAAAGmlyZWYAAAAAAAAADmF1eGwAAgABAAEAAADDaXBycAAAAJ1p" +
  "cGNvAAAAFGlzcGUAAAAAAAAAAgAAAAIAAAAQcGl4aQAAAAADCAgIAAAADGF2MUOBIAAAAAAAE2NvbHJu" +
  "Y2x4AAEADQAGgAAAAA5waXhpAAAAAAEIAAAADGF2MUOBABwAAAAAOGF1eEMAAAAAdXJuOm1wZWc6bXBl" +
  "Z0I6Y2ljcDpzeXN0ZW1zOmF1eGlsaWFyeTphbHBoYQAAAAAeaXBtYQAAAAAAAAACAAEEAQKDBAACBAEF" +
  "hgcAAAA9bWRhdBIACgQYADZVMgYQwAABEA8SAAoHOAA20BDQaTIYGIJjBMAANIAAAAAASFTNhi3IYphT" +
  "/SDs";

const frameNumber = (index: number) =>
  String(index + 1).padStart(SEQUENCE_CONFIG.filenameDigits, "0");

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
    // replaced are gone from layers/ - artifacts/render-brake-push.py re-renders them.
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
    // only its way back out is still played. The old `cockpit-exit` leg it
    // replaced is no longer in layers/. See artifacts/render-cockpit-susp.py.
    { kind: "move", prefix: "cockpit-susp", count: 40 },
  ],
};

/**
 * The same run for the portrait set, which frames the overhead beat differently.
 * The desktop crane lands with the nose to screen right, which fills a 16:9
 * frame; in a 4:5 one the car is longer than the frame is wide, so its nose and
 * tail would run off both sides. The phone's crane is a helix instead: it keeps
 * turning the way the orbit turns while it climbs, round to behind the car, and
 * lands overhead with the nose to the top of the screen. That is the pose the
 * desktop's roll ends on and the dive starts from, so phones have no roll - the
 * dive picks up straight from the crane's last frame. Its 40 frames do the work
 * of the crane's 30 and the roll's 20. See artifacts/render-crane.py
 * (helix_pose); everything after the crane is the same leg on both sets.
 */
export const PORTRAIT_EXCURSION: CarExcursion = {
  ...CAR_EXCURSION,
  steps: [
    { kind: "move", prefix: "059-crane-up", count: 40 },
    { kind: "isolate", frame: 59, layer: "059-drivetrain-top", blur: 14 },
    { kind: "move", prefix: "cockpit-dive", count: 40 },
    { kind: "hold", frame: 76 },
    { kind: "move", prefix: "cockpit-susp", count: 40 },
  ],
};

/** The cockpit run a set plays. */
export const excursionFor = (source: FrameSourceLike): CarExcursion =>
  sourceOf(source).set === "portrait" ? PORTRAIT_EXCURSION : CAR_EXCURSION;

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
  // Named for the subteam, which is what the team calls it; the id stays
  // "electronics" because carLabels.json, the part mattes and the render
  // scripts are all keyed to it.
  { id: "electronics", label: "Systems", pauseFrame: 76 },
  // Labels here sit on the corner closeup the push lands on, not the orbit frame
  // it starts from - see pauseLayerUrl.
  { id: "suspension", label: "Suspension", pauseFrame: 108 },
];

// Frames are indexed 0-based here, but the rendered files are 1-based Blender
// frames, so index i resolves to (i + 1).webp (or .avif). Reveal layers are named after the
// pauseFrame they belong to and must therefore be RENDERED at pauseFrame + 1 -
// one orbit frame is ~3 degrees, which reads as the layer sitting visibly off to
// one side of the car. See artifacts/render-layers.py.
export const frameUrl = (source: FrameSourceLike, index: number) => {
  const { set, format } = sourceOf(source);
  return `${FRAME_SETS[set].root}/full/${frameNumber(index)}.${format}`;
};

export const layerUrl = (source: FrameSourceLike, name: string) => {
  const { set, format } = sourceOf(source);
  return `${FRAME_SETS[set].root}/layers/${name}.${format}`;
};

export const sequenceLayerUrl = (source: FrameSourceLike, prefix: string, index: number) =>
  layerUrl(source, `${prefix}-${frameNumber(index)}`);

/** A part mask, by the file name car-part-mattes.json lists it under. */
export const matteUrl = (source: FrameSourceLike, chapterId: string, file: string) =>
  `${FRAME_SETS[sourceOf(source).set].root}/mattes/${chapterId}/${file}`;

// What a beat's <img> holds before it plays. A landed beat opens on the LAST
// frame of its push, so that is the frame its element carries from the start: a
// hidden <img> is decoded lazily, so revealing one whose decoded content is still
// the push's first frame paints that frame for a tick - and for the suspension
// beat, the push's first frame is the wide orbit pose this whole leg exists to
// skip. See https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/decode
export const revealBaseSrc = (source: FrameSourceLike, reveal: CarReveal) =>
  reveal.push?.landed
    ? sequenceLayerUrl(source, reveal.push.base, reveal.push.count - 1)
    : layerUrl(source, reveal.base ?? "");

export const revealPartSrc = (source: FrameSourceLike, reveal: CarReveal) =>
  reveal.push?.landed
    ? sequenceLayerUrl(source, reveal.push.part, reveal.push.partCount - 1)
    : layerUrl(source, reveal.part ?? "");

/**
 * The layer frames on screen at the very top of the sequence, beside orbit
 * frame 0: a push on the first stop starts at once, so its base and part are
 * showing from the first scroll - the same image as frame 0, so the handover is
 * unseen only if they are already here.
 */
export const openingLayerUrls = (
  source: FrameSourceLike,
  chapters: CarChapter[] = CAR_CHAPTERS,
  reveals: CarReveal[] = CAR_REVEALS,
) =>
  reveals
    .filter(
      (reveal) =>
        reveal.frame === chapters[0]?.pauseFrame && reveal.push && !reveal.push.landed,
    )
    .flatMap((reveal) => [revealBaseSrc(source, reveal), revealPartSrc(source, reveal)]);

/**
 * Every layer the sequence plays, in the order the landscape loader warms them:
 * each reveal's stills and push frames, then each excursion leg and isolate.
 * The order is part of the desktop loader's tuning, so it is kept as it was.
 */
export const warmLayerUrls = (
  source: FrameSourceLike,
  reveals: CarReveal[] = CAR_REVEALS,
  excursion: CarExcursion = excursionFor(source),
) => {
  const urls: string[] = [];
  const run = (prefix: string, count: number) => {
    for (let index = 0; index < count; index += 1) {
      urls.push(sequenceLayerUrl(source, prefix, index));
    }
  };
  reveals.forEach((reveal) => {
    if (reveal.base) urls.push(layerUrl(source, reveal.base));
    if (reveal.part) urls.push(layerUrl(source, reveal.part));
    if (reveal.isolate) urls.push(layerUrl(source, reveal.isolate));
    if (reveal.push) {
      run(reveal.push.base, reveal.push.count);
      run(reveal.push.part, reveal.push.partCount);
      const exit = reveal.push.exit;
      if (exit) {
        run(exit.base, exit.count);
        run(exit.part, exit.partCount);
      }
    }
  });
  excursion.steps.forEach((step) => {
    if (step.kind === "move") run(step.prefix, step.count);
    else if (step.kind === "isolate") urls.push(layerUrl(source, step.layer));
  });
  return urls;
};

/** One file the desktop loader fetches; `canvasFrame` when it is an orbit frame. */
export interface LoadAsset {
  url: string;
  canvasFrame?: number;
}

/**
 * Everything the landscape set plays, in the order the desktop loader fetches
 * it - a few at a time, so what is first in the list is first to arrive.
 *
 * Frame 0 gates the section. Then every still a fast scroll or a jump can land
 * on, which is a couple of dozen files. Then the scroll itself, top to bottom:
 * a beat's base and part side by side because they are one picture, a landed
 * push backwards because it only plays its way out, and the excursion where the
 * orbit lifts off. The orbit frames a beat's exit leg flies past come last -
 * the canvas is covered for all of them.
 */
export const landscapeLoadOrder = (
  source: FrameSourceLike,
  chapters: CarChapter[] = CAR_CHAPTERS,
  reveals: CarReveal[] = CAR_REVEALS,
  excursion: CarExcursion = excursionFor(source),
  frameCount = SEQUENCE_CONFIG.frameCount,
): LoadAsset[] => {
  const order = new Map<string, LoadAsset>();
  const layer = (url: string) => {
    if (!order.has(url)) order.set(url, { url });
  };
  const painted = orbitFrameSet(excursion, frameCount);
  const flownPast = new Set<number>();
  reveals.forEach((reveal) => {
    const toFrame = reveal.push?.exit?.toFrame;
    if (toFrame === undefined) return;
    for (let index = reveal.frame + 1; index < toFrame; index += 1) flownPast.add(index);
  });
  const orbit = (index: number) => {
    const url = frameUrl(source, index);
    if (painted.has(index) && !order.has(url)) order.set(url, { url, canvasFrame: index });
  };
  // Base and part advance together; the part's run is the shorter one.
  const pair = (
    run: { base: string; part: string; count: number; partCount: number },
    backwards = false,
  ) => {
    for (let step = 0; step < run.count; step += 1) {
      const index = backwards ? run.count - 1 - step : step;
      layer(sequenceLayerUrl(source, run.base, index));
      if (index < run.partCount) layer(sequenceLayerUrl(source, run.part, index));
    }
  };

  orbit(0);
  openingLayerUrls(source, chapters, reveals).forEach(layer);
  chapters.forEach((chapter) => {
    const still = pauseLayerUrl(source, chapter.pauseFrame, reveals, excursion);
    if (still) layer(still);
    reveals
      .filter((reveal) => reveal.frame === chapter.pauseFrame)
      .forEach((reveal) => {
        if (reveal.base) layer(revealBaseSrc(source, reveal));
        if (reveal.part) layer(revealPartSrc(source, reveal));
        if (reveal.isolate) layer(layerUrl(source, reveal.isolate));
      });
  });
  orbitChapters(chapters, excursion).forEach((chapter) => {
    for (let offset = -2; offset <= 2; offset += 1) {
      const index = chapter.pauseFrame + offset;
      if (!flownPast.has(index)) orbit(index);
    }
  });

  for (let index = 0; index < frameCount; index += 1) {
    if (!painted.has(index) || flownPast.has(index)) continue;
    const here = reveals.filter((reveal) => reveal.frame === index);
    here.forEach((reveal) => {
      if (reveal.push?.landed) pair(reveal.push, true);
    });
    orbit(index);
    here.forEach((reveal) => {
      if (reveal.base) layer(layerUrl(source, reveal.base));
      if (reveal.part) layer(layerUrl(source, reveal.part));
      if (reveal.isolate) layer(layerUrl(source, reveal.isolate));
      if (!reveal.push || reveal.push.landed) return;
      pair(reveal.push);
      if (reveal.push.exit) pair(reveal.push.exit);
    });
    if (index !== excursion.fromFrame) continue;
    excursion.steps.forEach((step) => {
      if (step.kind === "isolate") layer(layerUrl(source, step.layer));
      if (step.kind !== "move") return;
      for (let frame = 0; frame < step.count; frame += 1) {
        layer(sequenceLayerUrl(source, step.prefix, frame));
      }
    });
  }
  flownPast.forEach(orbit);
  return [...order.values()];
};

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
  source: FrameSourceLike,
  frame: number,
  reveals: CarReveal[] = CAR_REVEALS,
  excursion: CarExcursion = excursionFor(source),
): string | null => {
  const beat = excursion.steps.findIndex(
    (step) => step.kind !== "move" && step.frame === frame,
  );
  if (beat !== -1) {
    const step = excursion.steps[beat];
    if (step.kind === "isolate") return layerUrl(source, step.layer);
    const leg = excursion.steps
      .slice(0, beat)
      .findLast((candidate) => candidate.kind === "move");
    return leg?.kind === "move"
      ? sequenceLayerUrl(source, leg.prefix, leg.count - 1)
      : null;
  }

  const here = reveals.filter((reveal) => reveal.frame === frame);
  const isolate = here.find((reveal) => reveal.kind === "isolate");
  if (isolate?.isolate) return layerUrl(source, isolate.isolate);
  const push = here.find((reveal) => reveal.push)?.push;
  if (push) return sequenceLayerUrl(source, push.base, push.count - 1);
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
