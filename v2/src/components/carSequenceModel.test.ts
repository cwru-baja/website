import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CAR_CHAPTERS,
  CAR_EXCURSION,
  CHAPTER_TIMING,
  FRAME_SETS,
  PORTRAIT_EXCURSION,
  PORTRAIT_SET_MEDIA,
  SEQUENCE_CONFIG,
  CAR_REVEALS,
  excursionDuration,
  excursionFor,
  excursionSlots,
  excursionStepDuration,
  excursionStopFrames,
  LABEL_MOTION,
  LABEL_TIMING,
  beatHold,
  labelsUp,
  labelsInDuration,
  labelsOutDuration,
  frameUrl,
  layerUrl,
  matteUrl,
  openingLayerUrls,
  pickFrameFormat,
  pickFrameSet,
  revealBaseSrc,
  revealPartSrc,
  warmLayerUrls,
  landscapeLoadOrder,
  orbitChapters,
  orbitFrameSet,
  pauseLayerUrl,
  revealsForFrame,
  sequenceLayerUrl,
  nearestLoadedFrame,
  rotationDuration,
  validateCarExcursion,
  validateCarSequence,
  type FrameSource,
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
      expect(layerUrl("landscape", reveal.base ?? "")).toBe(sequenceLayerUrl("landscape", push.base, 0));
      expect(layerUrl("landscape", reveal.part ?? "")).toBe(sequenceLayerUrl("landscape", push.part, 0));
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
    expect(frameUrl("landscape", CAR_EXCURSION.toFrame)).toBe("/renders-sr26/full/0109.webp");

    const last = CAR_EXCURSION.steps.at(-1);
    expect(last?.kind).toBe("move");
    if (last?.kind !== "move") return;
    expect(sequenceLayerUrl("landscape", last.prefix, last.count - 1)).toBe(
      "/renders-sr26/layers/cockpit-susp-0040.webp",
    );

    const corner = CAR_REVEALS.find((reveal) => reveal.id === "suspension-side");
    expect(corner?.frame).toBe(CAR_EXCURSION.toFrame);
    expect(corner?.push?.landed).toBe(true);
    // Which is also the still its labels would be placed on.
    expect(pauseLayerUrl("landscape", CAR_EXCURSION.toFrame)).toBe(
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
    expect(layerUrl("landscape", "031-frame")).toBe("/renders-sr26/layers/031-frame.webp");
    expect(sequenceLayerUrl("landscape", "cockpit-dive", 0)).toBe(
      "/renders-sr26/layers/cockpit-dive-0001.webp",
    );
    expect(sequenceLayerUrl("landscape", "cockpit-dive", 39)).toBe(
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
        pauseLayerUrl("landscape", chapter.pauseFrame),
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
    expect(pauseLayerUrl("landscape", 10)).toBeNull();
  });

  it("prefers a wide isolate over a push that shares its frame", () => {
    // The push runs its own in, hold and out first, and the labels wait for the
    // isolate that follows it - so that is the image they sit on.
    const reveals = [
      { ...CAR_REVEALS[0], frame: 12 },
      { id: "wide", frame: 12, kind: "isolate" as const, blur: 14, isolate: "012-wide" },
    ];
    expect(pauseLayerUrl("landscape", 12, reveals, CAR_EXCURSION)).toBe(
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
    expect(frameUrl("landscape", 0)).toBe("/renders-sr26/full/0001.webp");
    expect(frameUrl("landscape", SEQUENCE_CONFIG.frameCount - 1)).toBe(
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

describe("frame sets", () => {
  const mirror = (url: string) =>
    url.replace(/^\/renders-sr26\//, "/renders-sr26/portrait/");

  it("gives phones and small tablets held upright the portrait set, and nothing else", () => {
    expect(PORTRAIT_SET_MEDIA).toBe("(orientation: portrait) and (max-width: 1023px)");
    expect(pickFrameSet((query) => query === PORTRAIT_SET_MEDIA)).toBe("portrait");
    expect(pickFrameSet(() => false)).toBe("landscape");
    expect(FRAME_SETS.portrait.width / FRAME_SETS.portrait.height).toBe(0.8);
    expect(FRAME_SETS.landscape.width / FRAME_SETS.landscape.height).toBeCloseTo(1920 / 1080);
  });

  it("names every portrait file after its landscape twin, under its own root", () => {
    expect(frameUrl("portrait", 0)).toBe("/renders-sr26/portrait/full/0001.webp");
    expect(layerUrl("portrait", "031-frame")).toBe(
      "/renders-sr26/portrait/layers/031-frame.webp",
    );
    expect(sequenceLayerUrl("portrait", "brake-arc/000-brake-arc", 29)).toBe(
      "/renders-sr26/portrait/layers/brake-arc/000-brake-arc-0030.webp",
    );
    expect(matteUrl("portrait", "brakes", "rotor.webp?v=83a5a876")).toBe(
      "/renders-sr26/portrait/mattes/brakes/rotor.webp?v=83a5a876",
    );
    CAR_CHAPTERS.forEach((chapter) => {
      const wide = pauseLayerUrl("landscape", chapter.pauseFrame);
      const tall = pauseLayerUrl("portrait", chapter.pauseFrame);
      expect(tall).toBe(wide === null ? null : mirror(wide));
    });
    CAR_REVEALS.filter((reveal) => reveal.kind === "remove").forEach((reveal) => {
      expect(revealBaseSrc("portrait", reveal)).toBe(mirror(revealBaseSrc("landscape", reveal)));
      expect(revealPartSrc("portrait", reveal)).toBe(mirror(revealPartSrc("landscape", reveal)));
    });
  });

  it("opens each removal's elements on the frame its beat opens on", () => {
    const brakes = CAR_REVEALS.find((reveal) => reveal.id === "brakes")!;
    const corner = CAR_REVEALS.find((reveal) => reveal.id === "suspension-side")!;
    expect(revealBaseSrc("landscape", brakes)).toBe(
      "/renders-sr26/layers/brake-arc/000-brake-arc-0001.webp",
    );
    // Landed: the push's last pose, never the wide orbit pose it starts from.
    expect(revealBaseSrc("landscape", corner)).toBe(
      "/renders-sr26/layers/108-susp-corner-0024.webp",
    );
    expect(revealPartSrc("landscape", corner)).toBe(
      "/renders-sr26/layers/108-susp-corner-wheels-0014.webp",
    );
  });

  it("names the layers on screen before the first scroll", () => {
    // The brakes push starts at the top of the sequence, so its base and part
    // are up from the first frame - beside orbit frame 0, which they match.
    expect(openingLayerUrls("portrait")).toEqual([
      "/renders-sr26/portrait/layers/brake-arc/000-brake-arc-0001.webp",
      "/renders-sr26/portrait/layers/brake-arc/000-brake-cover-0001.webp",
    ]);
  });

  it("lists every layer the sequence plays, in the desktop loader's order", () => {
    const wide = warmLayerUrls("landscape");
    expect(wide.slice(0, 4)).toEqual([
      "/renders-sr26/layers/brake-arc/000-brake-arc-0001.webp",
      "/renders-sr26/layers/brake-arc/000-brake-cover-0001.webp",
      "/renders-sr26/layers/brake-arc/000-brake-arc-0001.webp",
      "/renders-sr26/layers/brake-arc/000-brake-arc-0002.webp",
    ]);
    expect(wide.at(-1)).toBe("/renders-sr26/layers/cockpit-susp-0040.webp");
    expect(wide).toHaveLength(282);
    expect(new Set(wide).size).toBe(278);
    // The phone's cockpit run differs in one place: a longer crane and no roll.
    const tall = warmLayerUrls("portrait");
    const craneAndRoll = /\/(059-crane-up|cockpit-roll)-\d{4}\.webp$/;
    expect(tall.filter((url) => !craneAndRoll.test(url))).toEqual(
      wide.filter((url) => !craneAndRoll.test(url)).map(mirror),
    );
    expect(tall.filter((url) => url.includes("/cockpit-roll-"))).toEqual([]);
    expect(tall.filter((url) => url.includes("/059-crane-up-"))).toHaveLength(40);
    expect(tall).toHaveLength(282 - 30 - 20 + 40);
  });

  // All 259 layers used to be requested at once, so they shared the link and
  // none finished early: on a first visit the opening beat's frames landed no
  // sooner than the last leg's. The loader now walks this list a few at a time.
  describe("the desktop loader's order", () => {
    const order = landscapeLoadOrder("landscape");
    const urls = order.map((asset) => asset.url);
    const at = (file: string) => urls.indexOf(`/renders-sr26/${file}.webp`);

    it("loads exactly what the desktop set plays, once each", () => {
      const orbit = [...orbitFrameSet(CAR_EXCURSION)].map((index) =>
        frameUrl("landscape", index),
      );
      expect(new Set(urls).size).toBe(urls.length);
      expect([...urls].sort()).toEqual(
        [...new Set([...orbit, ...warmLayerUrls("landscape")])].sort(),
      );
      expect(
        order.filter((asset) => asset.canvasFrame !== undefined).map((asset) => asset.url),
      ).toEqual(expect.arrayContaining(orbit));
    });

    it("opens with frame 0 and every still a jump can land on", () => {
      expect(order[0]).toEqual({ url: "/renders-sr26/full/0001.webp", canvasFrame: 0 });
      const head = urls.slice(0, 24);
      [
        "layers/brake-arc/000-brake-arc-0001",
        "layers/brake-arc/000-brake-cover-0001",
        "layers/brake-arc/000-brake-arc-0030",
        "full/0032",
        "layers/031-frame",
        "layers/059-drivetrain-top",
        "layers/cockpit-dive-0040",
        "layers/108-susp-corner-0024",
        "full/0109",
      ].forEach((file) => expect(head).toContain(`/renders-sr26/${file}.webp`));
    });

    it("then follows the scroll", () => {
      const walk = [
        "layers/brake-arc/000-brake-arc-0002",
        "layers/brake-arc/000-brake-arc-0029",
        "layers/brake-arc/brake-exit-0002",
        "layers/brake-arc/brake-exit-0030",
        "layers/059-crane-up-0002",
        "layers/cockpit-roll-0002",
        "layers/cockpit-dive-0002",
        "layers/cockpit-susp-0002",
        "layers/cockpit-susp-0039",
        "layers/108-susp-corner-0023",
        "layers/108-susp-corner-0002",
        "full/0112",
        "full/0120",
      ].map(at);
      expect(walk.every((index) => index > 0)).toBe(true);
      expect(walk).toEqual([...walk].sort((a, b) => a - b));
    });

    it("keeps a base and its part together", () => {
      // The part is gone by frame 18 of the push, and frame 18 of each is one picture.
      expect(Math.abs(at("layers/brake-arc/000-brake-arc-0012") - at("layers/brake-arc/000-brake-cover-0012"))).toBe(1);
      expect(Math.abs(at("layers/brake-arc/brake-exit-0020") - at("layers/brake-arc/brake-exit-cover-0020"))).toBe(1);
      expect(Math.abs(at("layers/108-susp-corner-0010") - at("layers/108-susp-corner-wheels-0010"))).toBe(1);
    });

    it("leaves the orbit the brake exit flies past until last", () => {
      // The exit leg lands on frame 31, so 1-30 are only ever seen scrubbing back.
      const skipped = Array.from({ length: 30 }, (_, index) => frameUrl("landscape", index + 1));
      expect(urls.slice(-skipped.length).sort()).toEqual(skipped.sort());
    });

    it("follows the format", () => {
      const avif = { set: "landscape", format: "avif" } as const;
      expect(landscapeLoadOrder(avif).map((asset) => asset.url)).toEqual(
        urls.map((url) => url.replace(/\.webp$/, ".avif")),
      );
    });
  });

  it("has every file the portrait set plays", () => {
    const orbit = [...orbitFrameSet(PORTRAIT_EXCURSION)].map((index) =>
      frameUrl("portrait", index),
    );
    const missing = [...orbit, ...warmLayerUrls("portrait")].filter(
      (url) => !existsSync(path.join(process.cwd(), "public", url)),
    );
    expect(missing).toEqual([]);
  });

  // Neither set renders the stretch of orbit the excursion crosses with the
  // canvas off, so full/ holds exactly what the orbit stops on - both ways
  // round, or a frame is either missing when the canvas asks for it or paid for
  // in the deploy and never fetched.
  it.each(["landscape", "portrait"] as const)("renders only the orbit %s plays", (set) => {
    const excursion = set === "portrait" ? PORTRAIT_EXCURSION : CAR_EXCURSION;
    const formats = FRAME_SETS[set].formats;
    const played = new Set(
      [...orbitFrameSet(excursion)].flatMap((index) =>
        formats.map((format) => frameUrl({ set, format }, index)),
      ),
    );
    const root = `/renders-sr26${set === "portrait" ? "/portrait" : ""}/full`;
    const onDisk = readdirSync(path.join(process.cwd(), "public", root)).map(
      (file) => `${root}/${file}`,
    );
    expect([...played].filter((url) => !onDisk.includes(url))).toEqual([]);
    expect(onDisk.filter((url) => !played.has(url))).toEqual([]);
  });
});

describe("the phone's cockpit run", () => {
  it("is the desktop run with the crane landing nose up and no roll", () => {
    expect(validateCarExcursion(PORTRAIT_EXCURSION, CAR_CHAPTERS)).toEqual([]);
    expect(PORTRAIT_EXCURSION.fromFrame).toBe(CAR_EXCURSION.fromFrame);
    expect(PORTRAIT_EXCURSION.toFrame).toBe(CAR_EXCURSION.toFrame);
    expect(PORTRAIT_EXCURSION.steps).toEqual(
      CAR_EXCURSION.steps
        .filter((step) => !(step.kind === "move" && step.prefix === "cockpit-roll"))
        .map((step) =>
          step.kind === "move" && step.prefix === "059-crane-up"
            ? { ...step, count: 40 }
            : step,
        ),
    );
    // Same beats, so the same chapters stop on the orbit and in the run.
    expect([...excursionStopFrames(PORTRAIT_EXCURSION)]).toEqual([
      ...excursionStopFrames(CAR_EXCURSION),
    ]);
  });

  it("goes to the portrait set only, whatever the format", () => {
    expect(excursionFor("portrait")).toBe(PORTRAIT_EXCURSION);
    expect(excursionFor("landscape")).toBe(CAR_EXCURSION);
    expect(excursionFor({ set: "landscape", format: "avif" })).toBe(CAR_EXCURSION);
  });

  it("spends the crane's 40 frames where the desktop spends 50 on crane and roll", () => {
    expect(
      excursionDuration(CAR_EXCURSION) - excursionDuration(PORTRAIT_EXCURSION),
    ).toBeCloseTo((30 + 20 - 40) / CHAPTER_TIMING.framesPerViewport);
  });

  it("hands the dive the crane's last frame, and holds the wheel on the dive's", () => {
    // The drivetrain isolate plays over the crane's last pose; the hold on the
    // wheel labels whatever the leg before it left on screen.
    expect(pauseLayerUrl("portrait", 59)).toBe(
      "/renders-sr26/portrait/layers/059-drivetrain-top.webp",
    );
    expect(pauseLayerUrl("portrait", 76)).toBe(
      "/renders-sr26/portrait/layers/cockpit-dive-0040.webp",
    );
    const slots = excursionSlots(PORTRAIT_EXCURSION);
    expect(slots.map(({ step }) => (step.kind === "move" ? step.prefix : step.kind))).toEqual([
      "059-crane-up",
      "isolate",
      "cockpit-dive",
      "hold",
      "cockpit-susp",
    ]);
  });
});

describe("frame formats", () => {
  const avif: FrameSource = { set: "landscape", format: "avif" };
  const asAvif = (url: string) => url.replace(/\.webp$/, ".avif");

  it("plays the landscape set as AVIF off Apple's engine, where it decodes", () => {
    expect(pickFrameFormat("landscape", { avif: true, apple: false })).toBe("avif");
    expect(pickFrameFormat("landscape", { avif: true, apple: true })).toBe("webp");
    expect(pickFrameFormat("landscape", { avif: false, apple: false })).toBe("webp");
    // The portrait set has no AVIF files, whatever the browser.
    expect(pickFrameFormat("portrait", { avif: true, apple: false })).toBe("webp");
  });

  it("keeps a set named on its own on WebP, which every set has", () => {
    expect(frameUrl("landscape", 0)).toBe(frameUrl({ set: "landscape", format: "webp" }, 0));
    expect(warmLayerUrls("landscape").every((url) => url.endsWith(".webp"))).toBe(true);
  });

  it("changes only the extension for AVIF", () => {
    expect(frameUrl(avif, 119)).toBe("/renders-sr26/full/0120.avif");
    expect(warmLayerUrls(avif)).toEqual(warmLayerUrls("landscape").map(asAvif));
    expect(openingLayerUrls(avif)).toEqual(openingLayerUrls("landscape").map(asAvif));
    CAR_CHAPTERS.forEach((chapter) => {
      const still = pauseLayerUrl("landscape", chapter.pauseFrame);
      expect(pauseLayerUrl(avif, chapter.pauseFrame)).toBe(still && asAvif(still));
    });
    CAR_REVEALS.filter((reveal) => reveal.kind === "remove").forEach((reveal) => {
      expect(revealBaseSrc(avif, reveal)).toBe(asAvif(revealBaseSrc("landscape", reveal)));
      expect(revealPartSrc(avif, reveal)).toBe(asAvif(revealPartSrc("landscape", reveal)));
    });
  });

  it("leaves the part masks alone: they are lossless WebP whatever the frames are", () => {
    expect(matteUrl(avif, "brakes", "rotor.webp?v=83a5a876")).toBe(
      matteUrl("landscape", "brakes", "rotor.webp?v=83a5a876"),
    );
  });

  it("has an AVIF beside every WebP the landscape set plays", () => {
    // The orbit stops, not all frameCount of them: the stretch the excursion
    // crosses is not rendered in either format.
    const orbit = [...orbitFrameSet(CAR_EXCURSION)].map((index) =>
      frameUrl(avif, index),
    );
    const missing = [...orbit, ...warmLayerUrls(avif)].filter(
      (url) => !existsSync(path.join(process.cwd(), "public", url)),
    );
    expect(missing).toEqual([]);
  });
});
