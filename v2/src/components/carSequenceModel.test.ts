import { describe, expect, it } from "vitest";
import {
  CAR_CHAPTERS,
  CAR_EXCURSION,
  CHAPTER_TIMING,
  SEQUENCE_CONFIG,
  CAR_REVEALS,
  excursionDuration,
  excursionSlots,
  excursionStepDuration,
  excursionStopFrames,
  LABEL_HOLD,
  LABEL_MOTION,
  LABEL_TIMING,
  arrivesGoingDown,
  beatHold,
  labelsUp,
  labelsInDuration,
  labelsOutDuration,
  frameUrl,
  layerUrl,
  orbitChapters,
  orbitFrameSet,
  pauseLayerUrl,
  revealsForFrame,
  sequenceLayerUrl,
  nearestLoadedFrame,
  rotationDuration,
  validateCarExcursion,
  validateCarSequence,
} from "./carSequenceModel";

describe("car sequence model", () => {
  it("keeps the configured chapters valid and ordered", () => {
    expect(validateCarSequence(CAR_CHAPTERS)).toEqual([]);
    expect(CAR_CHAPTERS.map((chapter) => chapter.pauseFrame)).toEqual(
      [...CAR_CHAPTERS]
        .map((chapter) => chapter.pauseFrame)
        .sort((left, right) => left - right),
    );
  });

  it("gives each pause exactly one chapter to hang its labels on", () => {
    // 0 is the brakes beat, which opens the sequence before the orbit has
    // turned anywhere; 59 and 76 are excursion beats - the overhead drivetrain
    // and the wheel - and 31 and 108 are the two the orbit itself still stops on.
    expect(CAR_CHAPTERS.map((chapter) => chapter.pauseFrame)).toEqual([
      0, 31, 59, 76, 108,
    ]);
    expect(
      validateCarSequence([
        { id: "a", label: "A", pauseFrame: 10 },
        { id: "b", label: "B", pauseFrame: 10 },
      ]),
    ).toEqual(["Chapters are not in ascending frame order: b"]);
  });

  it("pins every reveal to a frame the sequence actually pauses on", () => {
    const pauses = new Set(CAR_CHAPTERS.map((chapter) => chapter.pauseFrame));
    // A reveal whose frame is never paused on would never fire, and its layer
    // would not line up with the canvas anyway.
    CAR_REVEALS.forEach((reveal) => {
      expect(pauses.has(reveal.frame)).toBe(true);
    });
  });

  it("gives every reveal the layers its kind needs", () => {
    CAR_REVEALS.forEach((reveal) => {
      if (reveal.kind === "remove") {
        expect(reveal.base).toBeTruthy();
        expect(reveal.part).toBeTruthy();
      } else {
        expect(reveal.isolate).toBeTruthy();
      }
      expect(reveal.blur).toBeGreaterThan(0);
    });
  });

  it("keeps the excursion a valid chain of moves and beats", () => {
    expect(validateCarExcursion(CAR_EXCURSION, CAR_CHAPTERS)).toEqual([]);
    // It has to open and close on a move: those are the only two frames where an
    // image and the canvas show the same thing, which is what hides the handover.
    expect(CAR_EXCURSION.steps.at(0)?.kind).toBe("move");
    expect(CAR_EXCURSION.steps.at(-1)?.kind).toBe("move");
  });

  it("takes the rear of the car out of the orbit entirely", () => {
    // The whole point of routing through the cockpit: the run lifts off at the
    // right-side view and lands most of a turn later at the front-left one, so
    // the canvas never paints anything between them.
    expect(CAR_EXCURSION.fromFrame).toBe(31);
    expect(CAR_EXCURSION.toFrame).toBe(108);

    const painted = orbitFrameSet(CAR_EXCURSION);
    expect(painted.has(31)).toBe(true);
    expect(painted.has(108)).toBe(true);
    expect(painted.has(59)).toBe(false);
    expect(painted.has(76)).toBe(false);
    expect(painted.size).toBe(44);
  });

  it("hands every excursion beat a chapter the orbit no longer stops on", () => {
    const stops = excursionStopFrames(CAR_EXCURSION);
    expect([...stops].sort((a, b) => a - b)).toEqual([59, 76]);

    // Each beat needs labels to show, and no beat frame may survive into the orbit.
    stops.forEach((frame) => {
      expect(CAR_CHAPTERS.some((chapter) => chapter.pauseFrame === frame)).toBe(
        true,
      );
    });
    expect(
      orbitChapters(CAR_CHAPTERS, CAR_EXCURSION).map(
        (chapter) => chapter.pauseFrame,
      ),
    ).toEqual([0, 31, 108]);
  });

  it("paces a rendered leg like the orbit it stands in for", () => {
    const slots = excursionSlots(CAR_EXCURSION);
    expect(slots.map((slot) => slot.step.kind)).toEqual([
      "move",
      "isolate",
      "move",
      "move",
      "hold",
      "move",
    ]);
    // Each slot starts where the one before it ended, and the whole run is the sum.
    slots.forEach((slot, index) => {
      const previous = slots[index - 1];
      expect(slot.start).toBeCloseTo(
        previous ? previous.start + previous.duration : 0,
      );
    });
    expect(excursionDuration(CAR_EXCURSION)).toBeCloseTo(
      slots.at(-1)!.start + slots.at(-1)!.duration,
    );

    // A 30-frame leg is one viewport, the same frames-per-viewport the orbit runs
    // at, so the camera never changes speed leaving the orbit or rejoining it.
    expect(
      excursionStepDuration({ kind: "move", prefix: "059-crane-up", count: 30 }),
    ).toBe(1);
    // A hold has nothing to fade, so it gets the hold alone - anything more is a
    // stalled screen.
    expect(excursionStepDuration({ kind: "hold", frame: 76 })).toBe(
      CHAPTER_TIMING.hold,
    );
  });

  it("rejects an excursion whose beat has no pose to play at", () => {
    const stacked = {
      ...CAR_EXCURSION,
      steps: [
        { kind: "hold", frame: 76 } as const,
        ...CAR_EXCURSION.steps,
      ],
    };
    expect(validateCarExcursion(stacked, CAR_CHAPTERS)).toContain(
      "Excursion must open with a move",
    );
    expect(validateCarExcursion(stacked, CAR_CHAPTERS)).toContain(
      "Beat without a move before it: frame 76",
    );
  });

  it("starts a pushed removal on the layers its stills already name", () => {
    const pushes = CAR_REVEALS.filter((reveal) => reveal.push);
    expect(pushes.length).toBeGreaterThan(0);
    pushes.forEach((reveal) => {
      const push = reveal.push;
      if (!push) return;
      // Frame 1 of each sequence is the orbit pose, and it is what the layer sits
      // on before the beat runs. If the still and the sequence disagree the first
      // scroll tick swaps the image, which reads as a jump out of the canvas.
      expect(layerUrl(reveal.base ?? "")).toBe(sequenceLayerUrl(push.base, 0));
      expect(layerUrl(reveal.part ?? "")).toBe(sequenceLayerUrl(push.part, 0));
      // The part is only rendered while it is still on screen, so its set is the
      // shorter one - but it has to cover the whole fade.
      expect(push.partCount).toBeGreaterThan(0);
      expect(push.partCount).toBeLessThanOrEqual(push.count);
      expect(push.partCount / push.count).toBeGreaterThanOrEqual(
        CHAPTER_TIMING.pushPartFade,
      );
    });
    // The timeline works out one push window per chapter to hang its labels on,
    // so two camera moves sharing a frame would leave the second one unaccounted
    // for - and they would be fighting over the same camera anyway.
    const perFrame = new Map<number, number>();
    pushes.forEach((reveal) => {
      perFrame.set(reveal.frame, (perFrame.get(reveal.frame) ?? 0) + 1);
    });
    expect([...perFrame.values()].every((count) => count === 1)).toBe(true);
  });

  it("flies the excursion onto the suspension closeup, not back out to the orbit", () => {
    // The last leg ends on the pose the corner push ends at, so the beat opens
    // there - see artifacts/render-cockpit-susp.py. Its way back out is still the
    // push played in reverse, which is what returns the camera to frame 108:
    // layer files are named for the pauseFrame, but frameUrl maps a 0-based index
    // onto 1-based files, so the canvas paints toFrame + 1 when it takes over.
    expect(frameUrl(CAR_EXCURSION.toFrame)).toBe("/renders-sr26/full/0109.webp");

    const last = CAR_EXCURSION.steps.at(-1);
    expect(last?.kind).toBe("move");
    if (last?.kind !== "move") return;
    expect(sequenceLayerUrl(last.prefix, last.count - 1)).toBe(
      "/renders-sr26/layers/cockpit-susp-0040.webp",
    );

    const corner = CAR_REVEALS.find((reveal) => reveal.id === "suspension-side");
    expect(corner?.frame).toBe(CAR_EXCURSION.toFrame);
    expect(corner?.push?.landed).toBe(true);
    // Which is also the still its labels would be placed on.
    expect(pauseLayerUrl(CAR_EXCURSION.toFrame)).toBe(
      "/renders-sr26/layers/108-susp-corner-0024.webp",
    );
  });

  it("only lets a beat open already landed where the excursion lands", () => {
    const corner = CAR_REVEALS.find((reveal) => reveal.id === "suspension-side");
    expect(corner).toBeDefined();
    if (!corner?.push) return;
    const stray = { ...corner, id: "stray", frame: 0 };
    expect(
      validateCarExcursion(CAR_EXCURSION, CAR_CHAPTERS, SEQUENCE_CONFIG.frameCount, [
        stray,
      ]),
    ).toContain("Landed beat is not where the excursion lands: stray");
    expect(
      validateCarExcursion(CAR_EXCURSION, CAR_CHAPTERS, SEQUENCE_CONFIG.frameCount, [
        corner,
      ]),
    ).toEqual([]);
  });

  it("builds layer urls under the layers directory", () => {
    expect(layerUrl("031-frame")).toBe("/renders-sr26/layers/031-frame.webp");
    expect(sequenceLayerUrl("cockpit-dive", 0)).toBe(
      "/renders-sr26/layers/cockpit-dive-0001.webp",
    );
    expect(sequenceLayerUrl("cockpit-dive", 39)).toBe(
      "/renders-sr26/layers/cockpit-dive-0040.webp",
    );
  });

  it("opens on the brakes beat and leaves it on the side profile", () => {
    // The brakes beat is the first thing the sequence plays, from the head-on
    // nose view, and it does not rewind: its exit leg lands on frame 31, where
    // the frame beat then blurs the car away. The two are separate stops now,
    // which is what puts the side profile after the closeup rather than before.
    const opening = revealsForFrame(0);
    expect(opening.map((reveal) => reveal.id)).toEqual(["brakes"]);
    expect(opening[0].push?.exit?.toFrame).toBe(31);

    const atSide = revealsForFrame(31);
    expect(atSide.map((reveal) => reveal.id)).toEqual(["frame"]);
    expect(atSide.map((reveal) => reveal.kind)).toEqual(["isolate"]);
  });

  it("names the still each pause actually shows, for placing labels on", () => {
    // Labels are placed in percent of the image on screen while they are up,
    // and every current pause is somewhere the orbit canvas is not: the top of a
    // push, an isolate the car blurred away to, or the end of a leg.
    const shown = Object.fromEntries(
      CAR_CHAPTERS.map((chapter) => [
        chapter.pauseFrame,
        pauseLayerUrl(chapter.pauseFrame),
      ]),
    );
    expect(shown).toEqual({
      0: "/renders-sr26/layers/brake-arc/000-brake-arc-0030.webp",
      31: "/renders-sr26/layers/031-frame.webp",
      59: "/renders-sr26/layers/059-drivetrain-top.webp",
      76: "/renders-sr26/layers/cockpit-dive-0040.webp",
      108: "/renders-sr26/layers/108-susp-corner-0024.webp",
    });
    // A plain orbit stop is the canvas itself.
    expect(pauseLayerUrl(10)).toBeNull();
  });

  it("prefers a wide isolate over a push that shares its frame", () => {
    // The push runs its own in, hold and out first, and the labels wait for the
    // isolate that follows it - so that is the image they sit on.
    const reveals = [
      { ...CAR_REVEALS[0], frame: 12 },
      { id: "wide", frame: 12, kind: "isolate" as const, blur: 14, isolate: "012-wide" },
    ];
    expect(pauseLayerUrl(12, reveals, CAR_EXCURSION)).toBe(
      "/renders-sr26/layers/012-wide.webp",
    );
  });

  it("renders the exit leg's part for every pose, not just its opening few", () => {
    // The covers fade back IN across the exit, so unlike the inbound push the
    // part is still on screen at the last frame. A partCount short of `count`
    // would clamp the tires to a stale pose for the rest of the leg.
    const exit = revealsForFrame(0)[0].push?.exit;
    expect(exit?.partCount).toBe(exit?.count);
  });

  it("holds a labelled pause long enough to read before the camera moves", () => {
    // Four labels take 0.31 to draw in and 0.2 to clear. The single-card hold
    // left them fully up for 0.07 of a viewport at the top of a push, and not at
    // all on the wheel.
    expect(labelsInDuration(4)).toBeCloseTo(0.31);
    expect(labelsOutDuration(4)).toBeCloseTo(0.2);
    expect(beatHold(4)).toBeCloseTo(0.31 + LABEL_TIMING.read + 0.2);
    expect(beatHold(4) - labelsInDuration(4) - labelsOutDuration(4)).toBeCloseTo(
      LABEL_TIMING.read,
    );
    // An unlabelled pause keeps the hold it always had.
    expect(beatHold(0)).toBe(CHAPTER_TIMING.hold);
    // An isolate's reveal and hide are still pose too, so a few labels fit in the
    // hold it already has, and only a crowded one grows.
    const still = CHAPTER_TIMING.reveal + CHAPTER_TIMING.hide;
    expect(beatHold(4, still)).toBe(CHAPTER_TIMING.hold);
    expect(beatHold(8, still)).toBeCloseTo(0.19 + 0.28 + LABEL_TIMING.read + 0.28 - still);
    // The excursion's wheel hold grows with its labels, and the run with it.
    const hold = { kind: "hold", frame: 76 } as const;
    expect(excursionStepDuration(hold, () => 4)).toBeCloseTo(beatHold(4));
    expect(
      excursionDuration(CAR_EXCURSION, (frame) => (frame === 76 ? 4 : 0)) -
        excursionDuration(CAR_EXCURSION),
    ).toBeCloseTo(beatHold(4) - CHAPTER_TIMING.hold);
  });

  it("plays labels on a pause's stretch of the timeline, and nowhere else", () => {
    const pause = { from: 2, to: 2.5 };
    expect(labelsUp(pause, 1.99)).toBe(false);
    expect(labelsUp(pause, 2)).toBe(true);
    expect(labelsUp(pause, 2.3)).toBe(true);
    expect(labelsUp(pause, 2.5)).toBe(false);
    // Asked of where the playhead is, not of what it crossed: a scroll that
    // lands past the pause in one update never puts its labels up.
    expect([1.9, 2.6].some((time) => labelsUp(pause, time))).toBe(false);
  });

  it("holds a pause only for a scroll coming down onto it", () => {
    const pause = { from: 2, to: 2.5 };
    // Down across its start, however far into the pause the update lands.
    expect(arrivesGoingDown(pause, 1.9, 2.05)).toBe(true);
    expect(arrivesGoingDown(pause, 1.9, 2.7)).toBe(true);
    // Already on it, coming back up onto it, or not there yet.
    expect(arrivesGoingDown(pause, 2.1, 2.3)).toBe(false);
    expect(arrivesGoingDown(pause, 2.7, 2.3)).toBe(false);
    expect(arrivesGoingDown(pause, 1.5, 1.9)).toBe(false);
    // A jump well past it is somewhere the visitor meant to go.
    expect(arrivesGoingDown(pause, 1.9, pause.to + LABEL_HOLD.jump)).toBe(false);
    expect(LABEL_HOLD.anchor).toBeGreaterThan(0);
    expect(LABEL_HOLD.anchor).toBeLessThan(1);
  });

  it("draws a label's name as its line reaches the run, and leaves faster", () => {
    const lineEnds = LABEL_MOTION.lineAt + LABEL_MOTION.line;
    const nameStarts = LABEL_MOTION.lineAt + LABEL_MOTION.line * LABEL_MOTION.nameAt;
    // The line leaves while the dot is still popping, and the name opens partway
    // along the line and is the last thing to finish.
    expect(LABEL_MOTION.lineAt).toBeLessThan(LABEL_MOTION.dot);
    expect(nameStarts).toBeGreaterThan(LABEL_MOTION.dot);
    expect(nameStarts).toBeLessThan(lineEnds);
    expect(nameStarts + LABEL_MOTION.name).toBeGreaterThan(lineEnds);
    expect(LABEL_MOTION.leave).toBeGreaterThan(1);
  });

  it("keeps each inspection chapter at one viewport unit", () => {
    expect(
      CHAPTER_TIMING.reveal + CHAPTER_TIMING.hold + CHAPTER_TIMING.hide,
    ).toBe(1);
  });

  it("builds frame URLs from the centralized sequence configuration", () => {
    expect(frameUrl(0)).toBe("/renders-sr26/full/0001.webp");
    expect(frameUrl(SEQUENCE_CONFIG.frameCount - 1)).toBe(
      "/renders-sr26/full/0120.webp",
    );
  });

  it("scales rotation duration by frame distance with a minimum", () => {
    expect(rotationDuration(0, 30)).toBe(1);
    expect(rotationDuration(30, 31)).toBe(CHAPTER_TIMING.minimumRotation);
  });

  it("selects the nearest loaded frame and breaks ties toward the lower frame", () => {
    expect(nearestLoadedFrame(50, new Set([48, 52]))).toBe(48);
    expect(nearestLoadedFrame(50, new Set([50, 52]))).toBe(50);
    expect(nearestLoadedFrame(50, new Set())).toBeNull();
  });
});
