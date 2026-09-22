"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import CarCaptionBand from "./CarCaptionBand";
import CarLabelsLayer, {
  PartHighlight,
  STAGE_DIM,
  STAGE_DIM_FADE,
  type LabelElements,
  type LabelHandle,
} from "./CarLabelsLayer";
import CarStepButtons from "./CarStepButtons";
import CarSubteamTag from "./CarSubteamTag";
import { subteamFor } from "./carSubteams";
import CockpitEgg, { COCKPIT_STILL, type Freeze } from "./dashPong/CockpitEgg";
import CarSequenceCalibration, {
  type SaveState,
} from "./CarSequenceCalibration";
import {
  progressForKey,
  progressFromPointer,
  scrollForProgress,
  scrubPercent,
} from "./carScrubber";
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
  type Direction,
  type Glide,
  type WheelGesture,
} from "./carSnap";
import {
  CAR_LABELS,
  CAR_PART_MATTES,
  labelSide,
  partMatteUrl,
  type CarLabel,
  type CarLabelSet,
  type LabelPoint,
} from "./carLabels";
import { DecodeAhead } from "./carDecodeAhead";
import {
  FrameStream,
  StreamSchedule,
  nearestReady,
} from "./carFrameStream";
import {
  AVIF_PROBE,
  CAR_CHAPTERS,
  CAR_REVEALS,
  CHAPTER_TIMING,
  LABEL_MOTION,
  SEQUENCE_CONFIG,
  beatHold,
  excursionDuration,
  excursionFor,
  excursionSlots,
  frameUrl,
  labelsOutDuration,
  labelsUp,
  layerUrl,
  orbitChapters,
  pauseLayerUrl,
  nearestLoadedFrame,
  openingLayerUrls,
  pickFrameFormat,
  pickFrameSet,
  revealBaseSrc,
  revealPartSrc,
  revealsForFrame,
  rotationDuration,
  sequenceLayerUrl,
  landscapeLoadOrder,
  type CarChapter,
  type FrameSet,
  type FrameSource,
  type FrameSourceLike,
  type LabelWindow,
} from "./carSequenceModel";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * How many frames the desktop loader has in flight. Few enough that they arrive
 * in the order asked for, enough that a long round trip does not leave the link
 * idle between them.
 */
const LOAD_CONCURRENCY = 12;

/** How long a frame waits on decode() before settling for "downloaded". */
const DECODE_TIMEOUT_MS = 1200;

type ElementRefs<T extends Element> = Record<string, T | null>;
type LabelBeat = LabelWindow & {
  timeline: gsap.core.Timeline;
  up: boolean;
  arriving: gsap.core.Tween | null;
};
const SCROLL_DOWN_KEYS = new Set(["ArrowDown", "PageDown", "End", " "]);
// A key press that belongs to what it was pressed on rather than to the page:
// typing, and Space pressing a button.
const ownsKey = (target: EventTarget | null, key: string) =>
  target instanceof Element &&
  Boolean(
    target.closest("input, textarea, select, [contenteditable]") ||
      (key === " " && target.closest("button, [role='button'], summary")),
  );
type ResponsiveMode = "desktop" | "mobile";
// A label's name is revealed from the knee outward, so it grows out of its line.
// Shown, the clip stands a little clear of the name: a clip also cuts pointer
// events, and the name's hover area reaches past its letters.
const HIDDEN_TEXT_CLIP = {
  left: "inset(-80% -15% -80% 100%)",
  right: "inset(-80% 100% -80% -15%)",
} as const;
const SHOWN_TEXT_CLIP = "inset(-80% -15% -80% -15%)";

// Which frame set this page load plays, chosen the first time /car mounts and
// kept for the rest of the visit: turning a phone letterboxes the set it already
// has rather than fetching the other one, and so does leaving /car and coming
// back. The server can't know it, so it renders no frame URLs at all, and the
// client's first render (hydration) doesn't either - the set arrives with the
// render straight after, before anything has been requested.
let pageFrameSet: FrameSet | null = null;
const choosePageFrameSet = () =>
  (pageFrameSet ??= pickFrameSet((query) => window.matchMedia(query).matches));

// ...and the format that set is fetched in (see FrameFormat): AVIF where the set
// has it, the engine isn't Apple's and the browser decodes a probe encoded like
// the frames. The probe costs a few milliseconds after hydration and is skipped
// wherever the answer would be WebP anyway. A probe that never settles counts as
// no, so it can't strand the sequence on its loading state.
const AVIF_PROBE_TIMEOUT_MS = 500;
let pageFrameSource: FrameSource | null = null;
let choosingFrameSource: Promise<void> | null = null;
const frameSourceListeners = new Set<() => void>();
const decodesAvif = () =>
  new Promise<boolean>((resolve) => {
    const image = new Image();
    const timer = window.setTimeout(() => resolve(false), AVIF_PROBE_TIMEOUT_MS);
    const settle = (decoded: boolean) => {
      window.clearTimeout(timer);
      resolve(decoded);
    };
    image.onload = () => settle(image.naturalWidth > 0);
    image.onerror = () => settle(false);
    image.src = AVIF_PROBE;
  });
const chooseFrameSource = async () => {
  const set = choosePageFrameSet();
  const apple = navigator.vendor.startsWith("Apple");
  // Would this browser get AVIF if it can decode it? Only then is it worth asking.
  const avif =
    pickFrameFormat(set, { avif: true, apple }) === "avif" && (await decodesAvif());
  pageFrameSource = { set, format: pickFrameFormat(set, { avif, apple }) };
  frameSourceListeners.forEach((listener) => listener());
};
const subscribeFrameSource = (onChange: () => void) => {
  frameSourceListeners.add(onChange);
  choosingFrameSource ??= chooseFrameSource();
  return () => {
    frameSourceListeners.delete(onChange);
  };
};
const useFrameSource = () =>
  useSyncExternalStore(subscribeFrameSource, () => pageFrameSource, () => null);

/**
 * Where the caption band switches to a chapter, ahead of its still: the name
 * changes as the camera arrives rather than once it has stopped.
 */
const CAPTION_LEAD = 0.3;

interface BandState {
  chapter: number;
  live: boolean;
  /** Up to the first chapter, when the band introduces the car instead. */
  started: boolean;
  /** Past the last chapter's still, when the band has nothing left to caption. */
  ended: boolean;
}

const newLabelId = (chapterId: string) =>
  `${chapterId}-${Math.random().toString(36).slice(2, 8)}`;

export default function CarSequence() {
  const frameSource = useFrameSource();
  const frameSet = frameSource?.set ?? null;
  const landscapeSource = frameSource?.set === "landscape" ? frameSource : null;
  const portrait = frameSet === "portrait";
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<(HTMLImageElement | undefined)[]>([]);
  const loadedFramesRef = useRef(new Set<number>());
  // The warmed layer frames. Blink's memory cache only keeps an image something
  // still references, and public/ files are served max-age=0 - so a warmed Image
  // that is let go is collected, and the src swap that shows its frame becomes a
  // revalidation round trip per frame, mid-scroll. Keyed by URL, so the frames
  // about to be shown can be decoded ahead through them.
  const warmedLayersRef = useRef(new Map<string, HTMLImageElement>());
  // The landscape set's decoder, which the timeline steers once it exists; the
  // canvas draws its orbit bitmaps.
  const decodeAheadRef = useRef<DecodeAhead | null>(null);
  const requestedFrameRef = useRef(0);
  const drawnFrameRef = useRef(-1);

  const revealBaseRefs = useRef<ElementRefs<HTMLImageElement>>({});
  const revealPartRefs = useRef<ElementRefs<HTMLImageElement>>({});
  const revealIsolateRefs = useRef<ElementRefs<HTMLImageElement>>({});
  // One surface per excursion leg, keyed by the layer prefix it plays, plus one
  // per beat that blurs a leg away to expose something underneath.
  const railRef = useRef<HTMLDivElement>(null);
  const railFillRef = useRef<HTMLDivElement>(null);
  const railHandleRef = useRef<HTMLDivElement>(null);
  const legRefs = useRef<ElementRefs<HTMLImageElement>>({});
  const excursionIsolateRefs = useRef<ElementRefs<HTMLImageElement>>({});
  // Pong on the cockpit's dash. The layer is shown by the timeline, and the game
  // asks the timeline's closure to hold the page through `freezeRef`.
  const eggRef = useRef<HTMLDivElement>(null);
  const freezeRef = useRef<Freeze | null>(null);
  // The previous and next buttons: whether each has a stop to go to, and the
  // timeline's closure that takes the page there. Null until there are stops.
  const [steps, setSteps] = useState<{ back: boolean; on: boolean } | null>(null);
  const stepRef = useRef<((direction: Direction) => void) | null>(null);
  const [eggArmed, setEggArmed] = useState(false);
  // Mounting Pong renders the section again and starts its own ~250 KB - the
  // press crops, the dash plate, the colour table - and each of the 80 crops is
  // decoded. That used to land in the middle of the roll, a viewport and a half
  // before the cockpit, which cost a frame every time. Once every frame of the
  // sequence is in, nothing is waiting on the link, so it goes up in the first
  // idle moment after that instead. The timeline still arms it on the way to
  // the cockpit, for anyone who gets there while the sequence is still loading.
  const eggArmRef = useRef({
    /** This screen plays the cockpit still, so there is an egg to mount. */
    wanted: false,
    loaded: false,
    cancel: null as (() => void) | null,
    done: false,
  });
  const armEggWhenIdle = useCallback(() => {
    const arm = eggArmRef.current;
    if (arm.done || arm.cancel || !arm.wanted || !arm.loaded) return;
    const settle = () => {
      arm.cancel = null;
      arm.done = true;
      setEggArmed(true);
    };
    if (typeof window.requestIdleCallback === "function") {
      const handle = window.requestIdleCallback(settle, { timeout: 4000 });
      arm.cancel = () => window.cancelIdleCallback(handle);
    } else {
      const timer = window.setTimeout(settle, 400);
      arm.cancel = () => window.clearTimeout(timer);
    }
  }, []);
  useEffect(() => {
    const arm = eggArmRef.current;
    return () => arm.cancel?.();
  }, []);
  // The portrait set's loader, which the timeline steers once it exists.
  const streamRef = useRef<FrameStream | null>(null);
  // Frames the portrait set had to stand in for, for measuring the streaming:
  // how many distinct frames were asked for on screen, and how many of them
  // were drawn from a neighbour because they were not here yet.
  const streamStatsRef = useRef({ shown: 0, misses: 0 });
  const [band, setBand] = useState<BandState>({
    chapter: 0,
    live: false,
    started: false,
    ended: false,
  });
  const [litLabel, setLitLabel] = useState<string | null>(null);
  // A desktop label being hovered lights its part the same way.
  const [hoverLit, setHoverLit] = useState(false);

  const labelElementsRef = useRef<LabelElements>({
    dots: {},
    lines: {},
    paths: {},
    texts: {},
  });

  const [sequenceReady, setSequenceReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [calibrationMode, setCalibrationMode] = useState(false);
  const [calibrationChecked, setCalibrationChecked] = useState(
    process.env.NODE_ENV === "production",
  );
  const [selectedChapterId, setSelectedChapterId] = useState(
    CAR_CHAPTERS[0].id,
  );
  const [draftLabels, setDraftLabels] = useState<CarLabelSet>(CAR_LABELS);
  // What the file on disk holds, to tell whether the draft has anything unsaved.
  const [savedLabels, setSavedLabels] = useState<CarLabelSet>(CAR_LABELS);
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(
    CAR_LABELS[CAR_CHAPTERS[0].id]?.[0]?.id ?? null,
  );
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });

  // What the canvas and each layer last asked for, so a frame that is asked
  // for on every update is only counted once.
  const lastAskedRef = useRef(new Map<HTMLElement, string>());
  // Only what is on screen once a render is done counts: the canvas keeps
  // drawing the orbit while a leg covers it, and one render can pass through a
  // layer's frames - a scrub back past it, ScrollTrigger measuring the page -
  // before settling on the one it shows. So each render's last word per layer
  // is counted, after it.
  const pendingCountsRef = useRef(
    new Map<HTMLElement, { key: string; requested: number; shown: number | null }>(),
  );
  const countShown = useCallback(
    (element: HTMLElement, key: string, requested: number, shown: number | null) => {
      const pending = pendingCountsRef.current;
      if (!pending.size) {
        queueMicrotask(() => {
          const stats = streamStatsRef.current;
          const section = sectionRef.current;
          pending.forEach((ask, element) => {
            if (element.style.visibility === "hidden") return;
            const frame = `${ask.key} ${ask.requested}`;
            if (lastAskedRef.current.get(element) === frame) return;
            lastAskedRef.current.set(element, frame);
            stats.shown += 1;
            if (ask.shown === ask.requested) return;
            stats.misses += 1;
            if (section) section.dataset.streamLastMiss = `${frame}->${ask.shown}`;
          });
          pending.clear();
          if (section) {
            section.dataset.streamShown = String(stats.shown);
            section.dataset.streamMisses = String(stats.misses);
          }
        });
      }
      pending.set(element, { key, requested, shown });
    },
    [],
  );

  const drawFrame = useCallback((requestedIndex: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const requested = Math.min(
      Math.max(Math.round(requestedIndex), 0),
      SEQUENCE_CONFIG.frameCount - 1,
    );
    requestedFrameRef.current = requested;
    canvas.dataset.requestedFrame = String(requested);
    // A hidden canvas draws nothing. The orbit keeps turning under the legs that
    // cover it, and a draw there is a decode on the main thread in the middle of
    // a leg. The timeline shows it and draws it in the same render, before the
    // browser paints.
    if (canvas.style.visibility === "hidden") return;

    const actual = nearestLoadedFrame(
      requested,
      loadedFramesRef.current,
      SEQUENCE_CONFIG.frameCount,
    );
    if (streamRef.current) countShown(canvas, "canvas", requested, actual);
    if (actual === null || actual === drawnFrameRef.current) return;

    // A bitmap decoded ahead where there is one; the Image otherwise, which
    // decodes on the spot if it has to.
    const bitmap = decodeAheadRef.current?.bitmap(actual);
    const image = imagesRef.current[actual];
    const picture =
      bitmap ?? (image?.complete && image.naturalWidth ? image : null);
    const context = canvas.getContext("2d");
    if (!picture || !context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(picture, 0, 0, canvas.width, canvas.height);
    drawnFrameRef.current = actual;
    canvas.dataset.frame = String(actual);
  }, [countShown]);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const params = new URLSearchParams(window.location.search);
    const timer = window.setTimeout(() => {
      // Labels are placed on the 16:9 stills, so the placement tool only runs
      // on the landscape set.
      setCalibrationMode(
        params.get("calibrateCar") === "1" && choosePageFrameSet() === "landscape",
      );
      setCalibrationChecked(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  // The portrait set streams: frame 0 first, which is what the section waits
  // on, and then whatever the timeline schedules near the scroll position.
  useEffect(() => {
    if (frameSet !== "portrait") return;
    const loaded = loadedFramesRef.current;
    const images = imagesRef.current;
    // Frame 0 is painted the moment it arrives, but the timeline waits for the
    // opening beat's layers too: it shows them from its first frame.
    const opening = [frameUrl("portrait", 0), ...openingLayerUrls("portrait")];
    const waiting = new Set(opening);
    let ready = false;
    let sized = false;
    const settleOpening = (url: string) => {
      waiting.delete(url);
      if (ready || waiting.size || !loaded.has(0)) return;
      ready = true;
      drawnFrameRef.current = -1;
      setSequenceReady(true);
    };
    const stream = new FrameStream({
      onReady: (asset, image) => {
        const index = asset.canvasFrame;
        if (index !== undefined) {
          images[index] = image;
          loaded.add(index);
          const canvas = canvasRef.current;
          if (index === 0 && canvas && !sized) {
            sized = true;
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;
          }
          drawFrame(requestedFrameRef.current);
        }
        settleOpening(asset.url);
      },
      onRelease: (asset) => {
        const index = asset.canvasFrame;
        if (index === undefined) return;
        loaded.delete(index);
        images[index] = undefined;
      },
      onError: (asset) => {
        if (!ready && asset.canvasFrame === 0) setLoadFailed(true);
        else settleOpening(asset.url);
      },
    });
    streamRef.current = stream;
    const schedule = new StreamSchedule();
    opening.forEach((url, index) =>
      schedule.add(url, 0, 0, 0, index === 0 ? 0 : undefined),
    );
    stream.setSchedule(schedule.build());
    return () => {
      stream.dispose();
      streamRef.current = null;
      loaded.clear();
      images.length = 0;
    };
  }, [drawFrame, frameSet]);

  useEffect(() => {
    if (!landscapeSource) return;
    let cancelled = false;
    const pending = new Map<number, Promise<boolean>>();
    const images = imagesRef.current;
    const warmed = warmedLayersRef.current;

    const loadFrame = (index: number) => {
      const existing = pending.get(index);
      if (existing) return existing;
      if (loadedFramesRef.current.has(index)) return Promise.resolve(true);

      const promise = new Promise<boolean>((resolve) => {
        const image = new Image();
        image.decoding = "async";
        imagesRef.current[index] = image;
        let settled = false;

        const finish = (loaded: boolean) => {
          // Two callers race for the first frame - decode() and its timeout - so
          // this has to be idempotent or the loser reopens a closed promise.
          if (settled) return;
          settled = true;
          image.onload = null;
          image.onerror = null;
          if (!cancelled && loaded) {
            loadedFramesRef.current.add(index);
            drawFrame(requestedFrameRef.current);
          }
          resolve(loaded);
        };

        image.onload = () => {
          const loaded = Boolean(image.naturalWidth);
          // Only the first frame is decoded as it arrives, because it is drawn
          // as soon as it does. The rest are decoded just before the canvas
          // draws them (see DecodeAhead): decoding all 44 up front gives
          // Chromium's canvas nothing it keeps, and holds ~365 MB in WebKit.
          if (index !== 0 || typeof image.decode !== "function") {
            finish(loaded);
            return;
          }
          // Decoding up front keeps the first draw off the main thread, but the
          // frame is already downloaded by the time onload fires - so this is an
          // optimisation, not a requirement. A tab that is not being composited
          // (backgrounded, or an embedded preview) can leave decode() pending
          // indefinitely, and waiting on it strands the whole section on its
          // loading state, because frame 0 is what gates ready.
          const timer = window.setTimeout(
            () => finish(loaded),
            DECODE_TIMEOUT_MS,
          );
          void image.decode().then(
            () => {
              window.clearTimeout(timer);
              finish(true);
            },
            () => {
              window.clearTimeout(timer);
              finish(loaded);
            },
          );
        };
        image.onerror = () => finish(false);
        image.src = frameUrl(landscapeSource, index);
      });

      pending.set(index, promise);
      return promise;
    };

    const startLoading = async () => {
      const firstLoaded = await loadFrame(0);
      if (cancelled) return;
      if (!firstLoaded) {
        setLoadFailed(true);
        return;
      }

      const firstImage = imagesRef.current[0];
      const canvas = canvasRef.current;
      if (firstImage && canvas) {
        canvas.width = firstImage.naturalWidth;
        canvas.height = firstImage.naturalHeight;
      }
      drawnFrameRef.current = -1;
      drawFrame(0);
      setSequenceReady(true);

      // Everything else, in the order the scroll reaches it and a few at a
      // time. Asking for all of it at once shares the link 300 ways, so nothing
      // finishes early and the opening beat's frames land no sooner than the
      // last leg's - which is the wrong way round for anyone who starts
      // scrolling before the download is done.
      const queue = landscapeLoadOrder(landscapeSource).slice(1);
      const warm = (url: string) =>
        new Promise<void>((resolve) => {
          const image = new Image();
          image.decoding = "async";
          image.onload = image.onerror = () => {
            image.onload = image.onerror = null;
            resolve();
          };
          image.src = url;
          warmed.set(url, image);
        });
      let cursor = 0;
      const worker = async () => {
        while (!cancelled && cursor < queue.length) {
          const asset = queue[cursor];
          cursor += 1;
          if (asset.canvasFrame === undefined) await warm(asset.url);
          else await loadFrame(asset.canvasFrame);
        }
      };
      await Promise.all(Array.from({ length: LOAD_CONCURRENCY }, worker));
      if (cancelled) return;
      eggArmRef.current.loaded = true;
      armEggWhenIdle();
    };

    void startLoading();

    return () => {
      cancelled = true;
      warmed.clear();
      images.forEach((image) => {
        if (!image) return;
        image.onload = null;
        image.onerror = null;
      });
    };
  }, [drawFrame, landscapeSource]);

  const calibrationChapter =
    CAR_CHAPTERS.find((chapter) => chapter.id === selectedChapterId) ??
    CAR_CHAPTERS[0];

  useEffect(() => {
    if (!sequenceReady || !calibrationMode) return;
    drawFrame(calibrationChapter.pauseFrame);
  }, [calibrationChapter, calibrationMode, drawFrame, sequenceReady]);

  useGSAP(
    () => {
      if (!sequenceReady || calibrationMode || !calibrationChecked) return;

      const media = gsap.matchMedia();
      media.add(
        {
          desktop: "(min-width: 1024px)",
          mobile: "(max-width: 1023px)",
          reduceMotion: "(prefers-reduced-motion: reduce)",
        },
        (context) => {
          const conditions = context.conditions as {
            desktop: boolean;
            mobile: boolean;
            reduceMotion: boolean;
          };

          if (conditions.reduceMotion) {
            drawFrame(CAR_CHAPTERS[0].pauseFrame);
            return;
          }

          // Labels and Pong were both laid out on the 16:9 stills, so a tablet
          // turned wide keeps the phone's behaviour if it loaded the portrait set.
          const mode: ResponsiveMode =
            conditions.desktop && frameSet === "landscape" ? "desktop" : "mobile";
          const source: FrameSourceLike = frameSource ?? "landscape";
          // Phones play their own cockpit run: a crane that lands nose-up, and
          // so no roll (see PORTRAIT_EXCURSION).
          const excursion = excursionFor(source);
          // The portrait set streams: as the timeline is laid down it records
          // which file is on screen when, and the stream fetches what is near
          // the scroll position. Every layer shown goes through `showRun`, which
          // on the landscape set is exactly the old src assignment.
          const stream = frameSet === "portrait" ? streamRef.current : null;
          // The landscape set has every file in hand already, and decodes what
          // is about to be shown from the same record.
          const decoder =
            frameSet === "landscape"
              ? new DecodeAhead({
                  image: (asset) =>
                    asset.canvasFrame === undefined
                      ? warmedLayersRef.current.get(asset.url)
                      : imagesRef.current[asset.canvasFrame],
                  // WebKit decodes a file's bitmap on the calling thread, and
                  // its canvas draws the Image's decoded pixels anyway.
                  bitmaps:
                    typeof createImageBitmap === "function" &&
                    !navigator.vendor.startsWith("Apple"),
                })
              : null;
          decodeAheadRef.current = decoder;
          const schedule = stream || decoder ? new StreamSchedule() : null;
          const runUrl = (prefix: string) => (index: number) =>
            sequenceLayerUrl(source, prefix, index);
          const showRun = (
            image: HTMLImageElement,
            key: string,
            count: number,
            requested: number,
            urlAt: (index: number) => string,
            partner?: {
              image: HTMLImageElement;
              count: number;
              urlAt: (index: number) => string;
            },
          ) => {
            if (!stream) {
              // Every update asks, and most land on the frame already showing.
              const src = urlAt(requested);
              if (image.getAttribute("src") !== src) image.src = src;
              if (partner) {
                const partSrc = partner.urlAt(
                  Math.min(requested, partner.count - 1),
                );
                if (partner.image.getAttribute("src") !== partSrc) {
                  partner.image.src = partSrc;
                }
              }
              return;
            }
            // A base and its part are one picture, so they move together: the
            // nearest frame both are here for, never one ahead of the other.
            const shown = nearestReady(
              requested,
              count,
              (index) =>
                stream.isReady(urlAt(index)) &&
                (!partner ||
                  stream.isReady(
                    partner.urlAt(Math.min(index, partner.count - 1)),
                  )),
            );
            countShown(image, key, requested, shown);
            // Standing in for a frame that isn't here yet: show it when it is,
            // whether or not the timeline asks again.
            if (shown === requested) {
              stream.settle(image);
            } else {
              const partSrc = partner
                ? [partner.urlAt(Math.min(requested, partner.count - 1))]
                : [];
              stream.retryWhenReady(image, [urlAt(requested), ...partSrc], () =>
                showRun(image, key, count, requested, urlAt, partner),
              );
            }
            if (shown === null) return;
            const src = urlAt(shown);
            if (image.getAttribute("src") !== src) image.src = src;
            if (partner) {
              const partSrc = partner.urlAt(Math.min(shown, partner.count - 1));
              if (partner.image.getAttribute("src") !== partSrc) {
                partner.image.src = partSrc;
              }
            }
          };
          // Where each chapter's still is on screen, for the caption band.
          const poseWindows: { chapter: number; from: number; to: number }[] = [];
          // Labels are only laid out at desktop widths for now; the layer is not
          // displayed below that, so there is nothing to animate.
          const labelsFor = (chapter: CarChapter): CarLabel[] =>
            mode === "desktop" ? (CAR_LABELS[chapter.id] ?? []) : [];
          const { dots, lines, paths, texts } = labelElementsRef.current;
          // The excursion plays the beats on its own frames, so the orbit itself
          // only ever stops on what is left.
          const orbitStops = orbitChapters(CAR_CHAPTERS, excursion);

          CAR_CHAPTERS.flatMap(labelsFor).forEach((label) => {
            const dot = dots[label.id];
            const line = lines[label.id];
            const path = paths[label.id];
            const text = texts[label.id];
            // The dot's circles sit on its own origin, so its bounding box centre
            // is the dot however the layer is later resized.
            if (dot) {
              gsap.set(dot, {
                autoAlpha: 0,
                scale: 0,
                transformOrigin: "50% 50%",
              });
            }
            // pathLength is 1, so the dash is in fractions of the line: the same
            // numbers draw it at any size, with nothing to re-measure on resize.
            // They go on as attributes: tweened as CSS, the offset reads back as
            // "1px" and GSAP snaps it to the end value instead of drawing it.
            if (line) gsap.set(line, { autoAlpha: 0 });
            if (path) {
              gsap.set(path, {
                attr: { "stroke-dasharray": "1 1", "stroke-dashoffset": 1 },
              });
            }
            if (text) {
              gsap.set(text, {
                autoAlpha: 0,
                clipPath: HIDDEN_TEXT_CLIP[labelSide(label)],
              });
            }
          });

          const playhead = { frame: 0 };
          const master = gsap.timeline({ paused: true });
          let currentFrame = 0;

          // Labels are not scrubbed. A pause marks the stretch of the timeline its
          // labels belong to, and they play on their own clock whenever the
          // playhead is inside it: the same draw however fast the scroll arrived,
          // and never left half drawn by a scroll that stops partway. Leaving the
          // stretch either way plays them back out.
          const labelBeats: LabelBeat[] = [];
          // Where on the master timeline the cockpit still holds, if it does.
          let cockpitHold: { from: number; to: number } | null = null;

          // Each label draws out of its part: the dot lands, the line runs out to
          // the end, then the name opens from the knee along the run.
          const labelsBetween = (chapter: CarChapter, from: number, to: number) => {
            poseWindows.push({ chapter: CAR_CHAPTERS.indexOf(chapter), from, to });
            // The pause's masks, for the caption band's chips to light parts with.
            if (stream && schedule) {
              Object.keys(CAR_PART_MATTES[chapter.id] ?? {}).forEach((part) => {
                const matte = partMatteUrl(source, chapter.id, part);
                if (matte) schedule.add(matte, from, to);
              });
            }
            const labels = labelsFor(chapter);
            if (!labels.length) return;
            const timeline = gsap.timeline({ paused: true });
            labels.forEach((label, index) => {
              const offset = index * LABEL_MOTION.stagger;
              const lineAt = offset + LABEL_MOTION.lineAt;
              const dot = dots[label.id];
              const line = lines[label.id];
              const path = paths[label.id];
              const text = texts[label.id];
              if (dot) {
                timeline.to(
                  dot,
                  {
                    autoAlpha: 1,
                    scale: 1,
                    duration: LABEL_MOTION.dot,
                    ease: "back.out(2)",
                  },
                  offset,
                );
              }
              if (line) timeline.set(line, { autoAlpha: 1 }, lineAt);
              if (path) {
                timeline.to(
                  path,
                  {
                    attr: { "stroke-dashoffset": 0 },
                    duration: LABEL_MOTION.line,
                    ease: "power2.inOut",
                  },
                  lineAt,
                );
              }
              if (text) {
                timeline.to(
                  text,
                  {
                    autoAlpha: 1,
                    clipPath: SHOWN_TEXT_CLIP,
                    duration: LABEL_MOTION.name,
                    ease: "power2.out",
                  },
                  lineAt + LABEL_MOTION.line * LABEL_MOTION.nameAt,
                );
              }
            });
            labelBeats.push({ timeline, from, to, up: false, arriving: null });
          };

          // A fast scroll still carries the smoothed playhead through every pause
          // it passes, so arriving waits a moment before playing: a playhead that
          // is only passing through has left again before anything shows.
          const syncLabels = () => {
            const time = master.time();
            labelBeats.forEach((beat) => {
              const up = labelsUp(beat, time);
              if (up === beat.up) return;
              beat.up = up;
              beat.arriving?.kill();
              beat.arriving = null;
              if (up) {
                beat.arriving = gsap.delayedCall(LABEL_MOTION.settle, () => {
                  beat.arriving = null;
                  beat.timeline.timeScale(1).play();
                });
              } else {
                beat.timeline.timeScale(LABEL_MOTION.leave).reverse();
              }
            });
          };

          // The camera leaves the orbit for a chain of rendered legs and rejoins
          // it most of a turn later. Every leg's first frame is the pose the step
          // before it left the camera on, so each handover - canvas to leg, leg to
          // leg, leg back to canvas - is a cut between two identical images.
          const runExcursion = (startAt: number) => {
            const canvas = canvasRef.current;
            // A beat with labels holds long enough to read them, so the run is
            // measured with them.
            const labelCount = (frame: number) => {
              const chapter = CAR_CHAPTERS.find((item) => item.pauseFrame === frame);
              return chapter ? labelsFor(chapter).length : 0;
            };
            const slots = excursionSlots(excursion, labelCount);
            const total = excursionDuration(excursion, labelCount);
            const chapterFor = (frame: number) =>
              CAR_CHAPTERS.find((item) => item.pauseFrame === frame);

            if (canvas) master.set(canvas, { autoAlpha: 0 }, startAt);
            // The orbit keeps turning underneath, unseen, so the canvas is already
            // on the frame the last leg lands on by the time it is asked for again.
            master.to(
              playhead,
              {
                frame: excursion.toFrame,
                duration: total,
                ease: "none",
              },
              startAt,
            );

            // Whichever leg is painting the car right now. A beat blurs it away and
            // back; the next leg takes over from it on an identical frame.
            let cover: HTMLImageElement | null = null;

            slots.forEach(({ step, start, duration }, index) => {
              const at = startAt + start;

              if (step.kind === "move") {
                const image = legRefs.current[step.prefix];
                if (!image) return;
                // The leg stays up through any beats that follow it, until the next
                // leg picks the camera up - or, for the last one, the canvas does.
                const next = slots
                  .slice(index + 1)
                  .find((slot) => slot.step.kind === "move");
                const until = startAt + (next ? next.start : total);
                const cursor = { index: 0 };
                const urlAt = runUrl(step.prefix);
                schedule?.run(urlAt, 0, step.count - 1, at, duration);
                // It holds its last pose through the beats that follow.
                schedule?.add(urlAt(step.count - 1), at + duration, until);
                stream?.prime(image, urlAt(0));
                master.set(image, { autoAlpha: 1, filter: "blur(0px)" }, at);
                master.to(
                  cursor,
                  {
                    index: step.count - 1,
                    duration,
                    ease: "none",
                    onUpdate: () => {
                      showRun(
                        image,
                        step.prefix,
                        step.count,
                        Math.round(cursor.index),
                        urlAt,
                      );
                    },
                  },
                  at,
                );
                master.set(image, { autoAlpha: 0 }, until);
                cover = image;
                return;
              }

              const chapter = chapterFor(step.frame);

              if (step.kind === "isolate") {
                const isolate = excursionIsolateRefs.current[step.layer];
                const surface = cover;
                const back = at + duration - CHAPTER_TIMING.hide;
                schedule?.add(layerUrl(source, step.layer), at, at + duration);
                stream?.prime(isolate, layerUrl(source, step.layer));
                if (isolate) master.set(isolate, { autoAlpha: 1 }, at);
                if (surface) {
                  master.to(
                    surface,
                    {
                      autoAlpha: 0,
                      filter: `blur(${step.blur}px)`,
                      duration: CHAPTER_TIMING.reveal,
                      ease: "power1.inOut",
                    },
                    at,
                  );
                  master.to(
                    surface,
                    {
                      autoAlpha: 1,
                      filter: "blur(0px)",
                      duration: CHAPTER_TIMING.hide,
                      ease: "power1.inOut",
                    },
                    back,
                  );
                }
                // Up once the cover has blurred off the isolate, and gone before it
                // starts to come back.
                if (chapter) {
                  labelsBetween(
                    chapter,
                    at + CHAPTER_TIMING.reveal,
                    back - labelsOutDuration(labelsFor(chapter).length),
                  );
                }
                if (isolate) {
                  master.set(isolate, { autoAlpha: 0 }, at + duration);
                }
                return;
              }

              // A hold: arriving at the pose is the whole reveal, so nothing fades.
              // The labels are up from the moment it lands until the camera leaves.
              if (chapter) {
                labelsBetween(
                  chapter,
                  at,
                  at + duration - labelsOutDuration(labelsFor(chapter).length),
                );
              }

              // The dash's easter egg was rendered and measured against one still,
              // so it is up - and pressable - only while the camera sits on exactly
              // that frame. If the sequence ever lands somewhere else it just stays
              // hidden rather than drifting off the wheel.
              const egg = eggRef.current;
              if (
                egg &&
                mode === "desktop" &&
                pauseLayerUrl(source, step.frame) === layerUrl(source, COCKPIT_STILL)
              ) {
                cockpitHold = { from: at, to: at + duration };
                // Once the frames are in it is already up (see armEggWhenIdle);
                // these are for a visitor who arrives before that, and mount it
                // a viewport and a half early so nothing is still loading by the
                // time a button is pressed.
                const arm = () => setEggArmed(true);
                master.call(arm, undefined, Math.max(startAt, at - 1.5));
                master.call(arm, undefined, at);
                eggArmRef.current.wanted = true;
                armEggWhenIdle();
                master.set(egg, { autoAlpha: 1 }, at);
                master.set(egg, { autoAlpha: 0 }, at + duration);
              }
            });

            const landed = startAt + total;
            if (canvas) {
              master.set(
                canvas,
                { autoAlpha: 1, filter: "blur(0px)" },
                landed,
              );
            }
          };

          // The canvas opens the page on frame 0, before anything has played.
          schedule?.add(frameUrl(source, 0), 0, 0, 0, 0);
          const scheduleRotation = (from: number, to: number) =>
            schedule?.run(
              (index) => frameUrl(source, index),
              from,
              to,
              master.duration(),
              rotationDuration(from, to),
              true,
            );

          orbitStops.forEach((chapter) => {
            // The excursion may have already carried the playhead here, in which
            // case a rotation would only be a viewport of stalled scroll.
            if (chapter.pauseFrame !== currentFrame) {
              scheduleRotation(currentFrame, chapter.pauseFrame);
              master.to(playhead, {
                frame: chapter.pauseFrame,
                duration: rotationDuration(currentFrame, chapter.pauseFrame),
                ease: "none",
              });
              currentFrame = chapter.pauseFrame;
            }

            const reveals = revealsForFrame(chapter.pauseFrame);
            const pushed = reveals.filter((item) => item.push);
            const isolates = reveals.filter((item) => item.kind === "isolate");
            const labelCount = labelsFor(chapter).length;
            // A push that is the frame's only beat carries the labels at the top
            // of its move, so it holds for as long as they need. Next to an
            // isolate, they wait for that instead and the push keeps its hold.
            const pushStill = isolates.length
              ? CHAPTER_TIMING.hold
              : beatHold(labelCount);

            // A pushed removal dollies the camera into a closeup while the part
            // blurs off it, so the two read as one move rather than the camera
            // sitting 6m out waiting for a tire to dissolve. It is self-contained:
            // in, hold, back out, canvas resumes on the orbit pose it left from,
            // which leaves any isolate sharing this frame to play wide as before.
            // Worked out before the beat is laid down rather than collected from
            // inside it: the move's length is fixed by the timing constants, and
            // master.duration() here is exactly where it starts.
            // A landed beat spends no scroll arriving: the excursion's last leg
            // has already flown the camera onto the closeup.
            const pushTravel = pushed.some((reveal) => reveal.push?.landed)
              ? 0
              : CHAPTER_TIMING.push;
            const pushWindow = pushed.length
              ? {
                  start: master.duration() + pushTravel,
                  end: master.duration() + pushTravel + pushStill,
                }
              : null;
            // A push that leaves along an exit leg lands somewhere else on the
            // orbit, so the chapter's own frame is not where the camera ends up.
            let exitFrame: number | null = null;
            pushed.forEach((reveal) => {
              const push = reveal.push;
              const base = revealBaseRefs.current[reveal.id];
              const part = revealPartRefs.current[reveal.id];
              if (!push || !base) return;

              // Where the beat opens, which is also where scrubbing back to the
              // top of it returns: a landed beat must never leave its element
              // holding the push's first frame.
              const cursor = { index: push.landed ? push.count - 1 : 0 };
              const baseAt = runUrl(push.base);
              const partAt = runUrl(push.part);
              // The part is only rendered for the stretch it is still visible
              // over, so hold its last frame rather than reaching past the set.
              const partAtBase = (index: number) =>
                partAt(Math.min(index, push.partCount - 1));
              const applyFrameAt = (index: number) => {
                showRun(
                  base,
                  push.base,
                  push.count,
                  index,
                  baseAt,
                  part ? { image: part, count: push.partCount, urlAt: partAt } : undefined,
                );
              };
              const applyFrame = () => applyFrameAt(Math.round(cursor.index));
              stream?.prime(base, revealBaseSrc(source, reveal));
              stream?.prime(part, revealPartSrc(source, reveal));

              const travel = CHAPTER_TIMING.push;
              const fade = travel * CHAPTER_TIMING.pushPartFade;
              const inStart = master.duration();
              if (canvasRef.current) {
                master.set(canvasRef.current, { autoAlpha: 0 }, inStart);
              }
              master.set(base, { autoAlpha: 1, filter: "blur(0px)" }, inStart);
              if (push.landed) {
                // The camera flew here itself, dissolving the part on the way, so
                // the beat opens on the last pose of the push with the part
                // already gone - and only the way back out is left to play. The
                // element already holds that pose, so nothing has to swap a src
                // in the frame it becomes visible.
                if (part) {
                  master.set(
                    part,
                    { autoAlpha: 0, filter: `blur(${reveal.blur}px)` },
                    inStart,
                  );
                }
              } else {
                master.to(
                  cursor,
                  {
                    index: push.count - 1,
                    duration: travel,
                    ease: "none",
                    onUpdate: applyFrame,
                  },
                  inStart,
                );
                if (part) {
                  master.set(part, { autoAlpha: 1, filter: "blur(0px)" }, inStart);
                  master.to(
                    part,
                    {
                      autoAlpha: 0,
                      filter: `blur(${reveal.blur}px)`,
                      duration: fade,
                      ease: "power1.inOut",
                    },
                    inStart,
                  );
                }
              }

              const pushHold = inStart + (push.landed ? 0 : travel);
              // Streaming, the hold says which frame it holds: the element may
              // have been left on a stand-in, or on the exit leg's first frame
              // (the same picture under another name) by a scroll back up.
              const holdStill = () => applyFrameAt(push.count - 1);
              master.to(
                {},
                stream
                  ? { duration: pushStill, onUpdate: holdStill }
                  : { duration: pushStill },
                pushHold,
              );

              const outStart = pushHold + pushStill;
              const exit = push.exit;
              if (!push.landed) {
                schedule?.run(baseAt, 0, push.count - 1, inStart, travel);
                schedule?.run(partAtBase, 0, push.count - 1, inStart, travel);
              }
              schedule?.add(baseAt(push.count - 1), pushHold, outStart);

              if (exit) {
                // Leave along a rendered leg to a different orbit frame instead
                // of rewinding. Its frame 1 is the pose the push landed on, so
                // the same two layers carry straight on into it - only the
                // sequence they point at changes. The part fades back in over
                // the leg's first stretch, mirroring the way it left.
                const exitCursor = { index: 0 };
                const exitBaseAt = runUrl(exit.base);
                const exitPartAt = runUrl(exit.part);
                const applyExit = () => {
                  showRun(
                    base,
                    exit.base,
                    exit.count,
                    Math.round(exitCursor.index),
                    exitBaseAt,
                    part
                      ? { image: part, count: exit.partCount, urlAt: exitPartAt }
                      : undefined,
                  );
                };
                schedule?.run(exitBaseAt, 0, exit.count - 1, outStart, travel);
                schedule?.run(
                  (index) => exitPartAt(Math.min(index, exit.partCount - 1)),
                  0,
                  exit.count - 1,
                  outStart,
                  travel,
                );
                master.call(applyExit, undefined, outStart);
                master.to(
                  exitCursor,
                  {
                    index: exit.count - 1,
                    duration: travel,
                    ease: "none",
                    onUpdate: applyExit,
                  },
                  outStart,
                );
                if (part) {
                  master.set(
                    part,
                    { autoAlpha: 0, filter: `blur(${reveal.blur}px)` },
                    outStart,
                  );
                  master.to(
                    part,
                    {
                      autoAlpha: 1,
                      filter: "blur(0px)",
                      duration: fade,
                      ease: "power1.inOut",
                    },
                    outStart,
                  );
                }
                exitFrame = exit.toFrame;
              } else {
                // Back out along the same frames, with the part fading in over
                // the tail so the last one is the orbit pose again, part and all.
                schedule?.run(baseAt, push.count - 1, 0, outStart, travel);
                schedule?.run(partAtBase, push.count - 1, 0, outStart, travel);
                master.to(
                  cursor,
                  { index: 0, duration: travel, ease: "none", onUpdate: applyFrame },
                  outStart,
                );
                if (part) {
                  master.to(
                    part,
                    {
                      autoAlpha: 1,
                      filter: "blur(0px)",
                      duration: fade,
                      ease: "power1.inOut",
                    },
                    outStart + travel - fade,
                  );
                }
              }

              const landed = outStart + travel;
              master.set(base, { autoAlpha: 0 }, landed);
              if (part) master.set(part, { autoAlpha: 0 }, landed);
              // The canvas resumes on whichever orbit frame the beat actually
              // left the camera on, which the exit leg has already arrived at.
              if (exit) master.set(playhead, { frame: exit.toFrame }, landed);
              const resumeFrame = exit ? exit.toFrame : chapter.pauseFrame;
              schedule?.add(frameUrl(source, resumeFrame), landed, landed, 0, resumeFrame);
              if (canvasRef.current) {
                master.set(
                  canvasRef.current,
                  { autoAlpha: 1, filter: "blur(0px)" },
                  landed,
                );
              }
            });
            if (exitFrame !== null) currentFrame = exitFrame;

            // A chapter whose only beat is a pushed removal has already spent its
            // reveal, hold and hide inside the camera move. Appending the shared
            // window on top would park the car back on the orbit frame for a full
            // viewport of dead scroll, so borrow the move's own hold instead -
            // which is also where its labels belong, at the top of the move
            // rather than after the camera has come back down.
            const soloPush = pushWindow && !isolates.length ? pushWindow : null;
            const revealStart = soloPush ? soloPush.start : master.duration();
            if (!soloPush) {
              master.to({}, { duration: CHAPTER_TIMING.reveal }, revealStart);
            }

            // The car blurs away to expose an isolated subsystem rendered under it.
            if (isolates.length && schedule) {
              const shownUntil =
                revealStart +
                beatHold(labelCount, CHAPTER_TIMING.reveal + CHAPTER_TIMING.hide) +
                CHAPTER_TIMING.reveal +
                CHAPTER_TIMING.hide;
              schedule.add(
                frameUrl(source, chapter.pauseFrame),
                revealStart,
                shownUntil,
                0,
                chapter.pauseFrame,
              );
              isolates.forEach((reveal) => {
                const url = layerUrl(source, reveal.isolate ?? "");
                schedule.add(url, revealStart, shownUntil);
                stream?.prime(revealIsolateRefs.current[reveal.id], url);
              });
            }
            if (isolates.length && canvasRef.current) {
              isolates.forEach((reveal) => {
                const isolate = revealIsolateRefs.current[reveal.id];
                if (isolate) master.set(isolate, { autoAlpha: 1 }, revealStart);
              });
              master.to(
                canvasRef.current,
                {
                  autoAlpha: 0,
                  filter: `blur(${isolates[0].blur}px)`,
                  duration: CHAPTER_TIMING.reveal,
                  ease: "power1.inOut",
                },
                revealStart,
              );
            }

            if (!soloPush) {
              master.to({}, {
                duration: beatHold(
                  labelCount,
                  CHAPTER_TIMING.reveal + CHAPTER_TIMING.hide,
                ),
              });
            }

            const hideStart = soloPush ? soloPush.end : master.duration();
            if (!soloPush) {
              master.to({}, { duration: CHAPTER_TIMING.hide }, hideStart);
            }

            if (isolates.length && canvasRef.current) {
              master.to(
                canvasRef.current,
                {
                  autoAlpha: 1,
                  filter: "blur(0px)",
                  duration: CHAPTER_TIMING.hide,
                  ease: "power1.inOut",
                },
                hideStart,
              );
              isolates.forEach((reveal) => {
                const isolate = revealIsolateRefs.current[reveal.id];
                if (isolate) {
                  master.set(
                    isolate,
                    { autoAlpha: 0 },
                    hideStart + CHAPTER_TIMING.hide,
                  );
                }
              });
            }

            // Up once the pose is still - the push has landed, or the car has
            // blurred off its isolate - and gone before that changes: the push's
            // exit, the car blurring back in, or the rotation that follows.
            const poseStart = soloPush
              ? soloPush.start
              : revealStart + (isolates.length ? CHAPTER_TIMING.reveal : 0);
            const poseEnd = soloPush
              ? soloPush.end
              : isolates.length
                ? hideStart
                : hideStart + CHAPTER_TIMING.hide;
            labelsBetween(
              chapter,
              poseStart,
              poseEnd - labelsOutDuration(labelCount),
            );

            if (chapter.pauseFrame === excursion.fromFrame) {
              runExcursion(master.duration());
              currentFrame = excursion.toFrame;
            }
          });

          scheduleRotation(currentFrame, SEQUENCE_CONFIG.frameCount - 1);
          master.to(playhead, {
            frame: SEQUENCE_CONFIG.frameCount - 1,
            duration: rotationDuration(
              currentFrame,
              SEQUENCE_CONFIG.frameCount - 1,
            ),
            ease: "none",
          });

          // The caption band follows the playhead: a chapter's name comes up as
          // the camera arrives at its still, and its chips can light parts only
          // while that still is on screen. Before the first chapter and once the
          // last still is gone it names the whole car instead, rather than
          // captioning the turn in or away as a chapter.
          poseWindows.sort((left, right) => left.from - right.from);
          let bandNow: BandState = { chapter: 0, live: false, started: false, ended: false };
          const syncBand = () => {
            const time = master.time();
            let current = poseWindows[0];
            poseWindows.forEach((pose) => {
              if (pose.from - CAPTION_LEAD <= time) current = pose;
            });
            if (!current) return;
            const next = {
              chapter: current.chapter,
              live: labelsUp(current, time),
              started: time >= poseWindows[0].from - CAPTION_LEAD,
              ended: time >= poseWindows[poseWindows.length - 1].to,
            };
            if (
              next.chapter === bandNow.chapter &&
              next.live === bandNow.live &&
              next.started === bandNow.started &&
              next.ended === bandNow.ended
            ) {
              return;
            }
            bandNow = next;
            setBand(next);
          };

          // The decoder works from the scrubbed playhead, not the scroll position
          // it is catching up with: the frames it passes on the way are the ones
          // about to be shown.
          let playheadWas = 0;
          let heading = 1;
          master.eventCallback("onUpdate", () => {
            drawFrame(playhead.frame);
            if (decoder) {
              const time = master.time();
              if (time !== playheadWas) heading = time > playheadWas ? 1 : -1;
              playheadWas = time;
              decoder.seek(time, heading);
            }
            syncLabels();
            // Both the phone's caption band and the desktop subteam tag read
            // this, so it runs whichever set is on screen.
            syncBand();
          });

          // Pong on the dash is the one thing that holds the page still, and it
          // hands the page back through here.
          let releaseHold: (() => void) | null = null;

          // The rail under the navbar follows the trigger's own progress, which
          // tracks the scroll position with no lag of its own - `scrub` is what
          // holds the car back, not the trigger - so the line stays under the
          // pointer through a pan and the car catches up to where it was let go.
          const rail = railRef.current;
          const railFill = railFillRef.current;
          const railHandle = railHandleRef.current;

          let railPercent: number | null = null;
          const paintRail = (progress: number) => {
            if (!rail || !railFill || !railHandle) return;
            const percent = scrubPercent(progress);
            railFill.style.transform = `scaleX(${progress})`;
            railHandle.style.left = `${progress * 100}%`;
            // The value is what assistive tech is told about, on every change,
            // so it only changes when the whole percent does.
            if (percent === railPercent) return;
            railPercent = percent;
            rail.setAttribute("aria-valuenow", String(percent));
            rail.setAttribute("aria-valuetext", `${percent}%`);
          };

          const trigger = ScrollTrigger.create({
            id: "car-sequence",
            trigger: sectionRef.current,
            animation: master,
            pin: stageRef.current,
            start: "top top",
            end: () => `+=${Math.round(master.duration() * window.innerHeight)}`,
            scrub: 0.3,
            pinSpacing: true,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              paintRail(self.progress);
              // The scroll position leads the scrubbed playhead by the scrub's
              // lag, so the stream plans from where the car is going to be.
              stream?.seek(self.progress * master.duration(), self.direction);
            },
            onRefresh: (self) => paintRail(self.progress),
          });

          // The rail belongs to the pinned stage: up while the sequence has the
          // screen, gone once it hands the page back. It cannot ask the pin
          // itself, because `isActive` is exclusive at both ends - resting on the
          // pin's first or last pixel reads as outside it, which Home and End do
          // every time, and the control would go hidden under the hands using it,
          // taking the keyboard focus with it. So presence is its own trigger
          // over the same run with a pixel of margin at each end.
          const railPresence = ScrollTrigger.create({
            id: "car-sequence-rail",
            trigger: sectionRef.current,
            start: "top top+=1",
            end: () =>
              `+=${Math.round(master.duration() * window.innerHeight) + 2}`,
            invalidateOnRefresh: true,
            onToggle: (self) => {
              if (!rail) return;
              gsap.to(rail, {
                autoAlpha: self.isActive ? 1 : 0,
                duration: 0.25,
                ease: "power1.out",
                overwrite: true,
              });
            },
          });

          // Scrolling moves the sequence one stop at a time. A flick of the wheel,
          // a swipe or a scroll key plays the camera all the way to the next still
          // (or back to the last) and the page waits there for the next gesture.
          // The stops are the sequence's two ends and the middle of every pause,
          // so each pause's labels are drawn and read however briefly the visitor
          // scrolled. What isn't a scroll gesture - the rail, the scrollbar, Home
          // and End - still goes wherever it is taken. See carSnap.
          const stops = () => {
            const duration = master.duration();
            const span = trigger.end - trigger.start;
            return snapStops(poseWindows, duration).map((time) =>
              Math.round(trigger.start + (time / duration) * span),
            );
          };
          const inSequence = () => {
            const all = stops();
            const at = window.scrollY;
            return (
              at >= all[0] - CAR_SNAP.slack &&
              at <= all[all.length - 1] + CAR_SNAP.slack
            );
          };

          // Stepped on the frame's own timestamp rather than GSAP's ticker, which
          // times each tick from whenever its callback got to run: a busy frame
          // would take a longer step, and the page would lurch.
          let glide:
            | (Glide & {
                target: number;
                direction: Direction;
                written: number;
                frameAt: number | null;
              })
            | null = null;
          let glideFrame = 0;
          // Which way the page last went, and when it came to rest (seconds,
          // on the clock wheel events are stamped with).
          let landed: { moved: Direction | null; at: number } = {
            moved: null,
            at: -Infinity,
          };
          const glideTick = (now: number) => {
            if (!glide) return;
            // Something else has moved the page - the scrollbar, a jump - and it
            // is theirs now. A few pixels is the browser finishing a scroll it
            // started before the glide took over, which the glide carries on from.
            const drift = window.scrollY - glide.written;
            if (Math.abs(drift) > CAR_SNAP.yield) {
              stopGlide();
              return;
            }
            if (Math.abs(drift) > 1) glide.position += drift;
            const seconds =
              glide.frameAt === null ? 1 / 60 : Math.min((now - glide.frameAt) / 1000, 0.05);
            glide.frameAt = now;
            const step = glideStep(glide, glide.target, seconds, window.innerHeight);
            glide.position = step.position;
            glide.velocity = step.velocity;
            window.scrollTo(0, step.position);
            glide.written = window.scrollY;
            if (step.done) stopGlide();
            else glideFrame = window.requestAnimationFrame(glideTick);
          };
          const stopGlide = () => {
            if (!glide) return;
            landed = { moved: glide.direction, at: performance.now() / 1000 };
            glide = null;
            window.cancelAnimationFrame(glideFrame);
          };
          // A new stop mid-glide keeps the page's speed, so it runs on through
          // the one it was headed for instead of stopping there and starting over.
          const glideTo = (target: number) => {
            const from = glide ? glide.position : window.scrollY;
            const direction: Direction = target > from ? 1 : -1;
            if (glide) {
              glide.target = target;
              glide.direction = direction;
              return;
            }
            glide = {
              position: from,
              velocity: 0,
              target,
              direction,
              written: from,
              frameAt: null,
            };
            glideFrame = window.requestAnimationFrame(glideTick);
          };

          // Where a gesture going `direction` takes the page, or null to leave it
          // to the browser. Another key press or swipe the same way mid-glide
          // goes one stop past the one the page is already headed for; the wheel
          // never does (see readWheel).
          const targetFor = (direction: Direction, travel: number) => {
            const from =
              glide && (glide.target - glide.position) * direction > 0
                ? glide.target
                : window.scrollY;
            return snapTarget(stops(), from, direction, travel);
          };

          // A gesture moves the page one stop, however long its momentum goes on
          // arriving: the rest of it is swallowed rather than scrolling the page
          // off the stop it just brought it to - and so is any new one the same
          // way until the page has landed (readWheel).
          let wheel: WheelGesture | null = null;
          const onWheel = (event: WheelEvent) => {
            // Pinch-zoom arrives as a wheel with ctrl held.
            if (event.ctrlKey) return;
            const at = event.timeStamp / 1000;
            // Sideways scrolls - and the back and forward swipe - are the
            // browser's. One that drifts in partway through a scroll up or down
            // belongs to it, though, and mustn't nudge the page off its stop.
            if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
              if (wheel && at - wheel.at <= CAR_SNAP.quiet) {
                wheel = { ...wheel, at };
                if (event.deltaY && (glide || (wheel.used && inSequence()))) {
                  event.preventDefault();
                }
              }
              return;
            }
            const pixels = wheelPixels(
              event.deltaY,
              event.deltaMode,
              window.innerHeight,
            );
            if (!pixels) return;
            // Pong holds the page until a scroll up leaves the game, and that
            // scroll goes on to the stop above like any other.
            if (releaseHold) {
              if (pixels > 0) return;
              releaseHold();
            }
            const read = readWheel(wheel, pixels, at, {
              moving: glide?.direction ?? null,
              moved: landed.moved,
              restedAt: landed.at,
            });
            wheel = read.gesture;
            if (!read.move) {
              if (glide || inSequence()) event.preventDefault();
              return;
            }
            const target = targetFor(wheel.direction, Math.abs(pixels));
            if (target === null) {
              if (glide) event.preventDefault();
              return;
            }
            event.preventDefault();
            wheel = { ...wheel, used: true };
            glideTo(target);
          };

          const onKey = (event: KeyboardEvent) => {
            if (event.defaultPrevented) return;
            if (event.altKey || event.ctrlKey || event.metaKey) return;
            if (ownsKey(event.target, event.key)) return;
            const travel = keyTravel(event.key, event.shiftKey, window.innerHeight);
            if (!travel) return;
            // The arrows are Pong's player two; only paging up leaves the game.
            if (releaseHold) {
              if (event.key === "ArrowUp" || travel > 0) return;
              releaseHold();
            }
            // A key held down is one press, the way a long flick is one gesture.
            if (event.repeat) {
              if (glide || inSequence()) event.preventDefault();
              return;
            }
            const target = targetFor(travel > 0 ? 1 : -1, Math.abs(travel));
            if (target === null) {
              if (glide) event.preventDefault();
              return;
            }
            event.preventDefault();
            glideTo(target);
          };

          // A touch the browser scrolled can fling on after the finger lifts,
          // with no events to catch it by, and come to rest between two stops -
          // it came in from the page above or below, where swipes are the
          // browser's. Once it has, the page goes back to the end it came in by
          // (settleTarget).
          let coast: Direction | null = null;
          let coastCheck = 0;

          // A finger is read once, on its first move. Along the page and with a
          // stop to go to, the swipe is ours and the page stays put under it;
          // otherwise it is the browser's for the rest of the touch - which has
          // to be decided then, since a scroll the browser has started can't be
          // taken back. The navbar and the rail keep their own touches.
          //
          // Ours, a swipe only docks the page on the sequence from above or
          // below it. Inside, it goes nowhere: on a touch screen the previous
          // and next buttons are the only way through, so a thumb resting on
          // the frame can't send the camera off. At either end a swipe outward
          // has no stop to go to, so it is the browser's and leaves the page.
          let touch: {
            x: number;
            y: number;
            ours: boolean | null;
            swiped: boolean;
            direction: Direction;
          } | null = null;
          const onTouchStart = (event: TouchEvent) => {
            coast = null;
            const point = event.touches[0];
            const own =
              event.target instanceof Element &&
              event.target.closest("nav, [data-car-scrubber]");
            touch =
              point && event.touches.length === 1 && !own
                ? { x: point.clientX, y: point.clientY, ours: null, swiped: false, direction: 1 }
                : null;
          };
          const onTouchMove = (event: TouchEvent) => {
            const point = event.touches[0];
            if (!touch || !point) return;
            if (event.touches.length > 1) {
              touch = null;
              return;
            }
            const dx = point.clientX - touch.x;
            const dy = point.clientY - touch.y;
            if (!dx && !dy) return;
            // A finger moving up scrolls the page down.
            touch.direction = dy < 0 ? 1 : -1;
            if (releaseHold) {
              if (touch.direction > 0) return;
              releaseHold();
            }
            if (touch.ours === null) {
              touch.ours =
                Math.abs(dy) >= Math.abs(dx) &&
                (glide !== null || targetFor(touch.direction, Math.abs(dy)) !== null);
            }
            if (!touch.ours) return;
            if (event.cancelable) event.preventDefault();
            if (touch.swiped || Math.abs(dy) < CAR_SNAP.swipe) return;
            touch.swiped = true;
            if (glide || inSequence()) return;
            const target = targetFor(touch.direction, Math.abs(dy));
            if (target !== null) glideTo(target);
          };

          // The previous and next buttons move the page one stop, like a flick
          // of the wheel, and chain the same way a key press does. They are a
          // deliberate press, so they end Pong whichever way they go.
          stepRef.current = (direction) => {
            releaseHold?.();
            const from =
              glide && (glide.target - glide.position) * direction > 0
                ? glide.target
                : window.scrollY;
            const target = nextStop(stops(), from, direction);
            if (target !== null) glideTo(target);
          };
          let stepsNow: { back: boolean; on: boolean } | null = null;
          const syncSteps = () => {
            const all = stops();
            const next = {
              back: nextStop(all, window.scrollY, -1) !== null,
              on: nextStop(all, window.scrollY, 1) !== null,
            };
            if (stepsNow?.back === next.back && stepsNow.on === next.on) return;
            stepsNow = next;
            setSteps(next);
          };

          const settleCoast = () => {
            window.clearTimeout(coastCheck);
            coastCheck = window.setTimeout(() => {
              const direction = coast;
              if (direction === null || touch || glide || releaseHold) return;
              coast = null;
              const target = settleTarget(stops(), window.scrollY, direction);
              if (target !== null) glideTo(target);
            }, 150);
          };
          const onTouchEnd = () => {
            if (touch?.ours === false) {
              coast = touch.direction;
              settleCoast();
            }
            touch = null;
          };
          const onScroll = () => {
            if (coast !== null) settleCoast();
            syncSteps();
          };

          const letGo = () => {
            stopGlide();
            releaseHold?.();
          };

          window.addEventListener("wheel", onWheel, { passive: false });
          window.addEventListener("keydown", onKey);
          window.addEventListener("touchstart", onTouchStart, { passive: true });
          window.addEventListener("touchmove", onTouchMove, { passive: false });
          window.addEventListener("touchend", onTouchEnd, { passive: true });
          window.addEventListener("touchcancel", onTouchEnd, { passive: true });
          window.addEventListener("scroll", onScroll, { passive: true });
          ScrollTrigger.addEventListener("refreshInit", letGo);
          ScrollTrigger.addEventListener("refresh", syncSteps);
          syncSteps();

          // Panning the rail is a jump, not a scroll: the pointer has the page,
          // so a glide under way lets go of it.
          const panTo = (progress: number) => {
            letGo();
            trigger.scroll(
              scrollForProgress(progress, trigger.start, trigger.end),
            );
            paintRail(progress);
          };

          const panFromPointer = (event: PointerEvent) => {
            if (!rail) return;
            panTo(progressFromPointer(event.clientX, rail.getBoundingClientRect()));
          };

          // The rail is drawn over the navbar, so anything the navbar drops
          // across it - the mobile menu - would have its taps stolen. Ask what is
          // under the point with the rail taken out of the running, and give way.
          const coveredByNav = (x: number, y: number) => {
            if (!rail) return false;
            const previous = rail.style.pointerEvents;
            rail.style.pointerEvents = "none";
            const under = document.elementFromPoint(x, y);
            rail.style.pointerEvents = previous;
            return Boolean(under?.closest("nav"));
          };

          const onRailPointerDown = (event: PointerEvent) => {
            if (!rail || event.button !== 0) return;
            if (coveredByNav(event.clientX, event.clientY)) return;
            // Keeps the press from starting a selection or a drag; focus is then
            // ours to give, and has to be given without scrolling the pin away.
            event.preventDefault();
            rail.dataset.panning = "true";
            rail.setPointerCapture(event.pointerId);
            rail.focus({ preventScroll: true });
            panFromPointer(event);
          };

          const onRailPointerMove = (event: PointerEvent) => {
            if (!rail || rail.dataset.panning !== "true") return;
            event.preventDefault();
            panFromPointer(event);
          };

          const onRailPointerUp = (event: PointerEvent) => {
            if (!rail || rail.dataset.panning !== "true") return;
            delete rail.dataset.panning;
            if (rail.hasPointerCapture(event.pointerId)) {
              rail.releasePointerCapture(event.pointerId);
            }
          };

          const onRailKeyDown = (event: KeyboardEvent) => {
            const next = progressForKey(event.key, trigger.progress);
            if (next === null) return;
            event.preventDefault();
            panTo(next);
          };

          rail?.addEventListener("pointerdown", onRailPointerDown);
          rail?.addEventListener("pointermove", onRailPointerMove);
          rail?.addEventListener("pointerup", onRailPointerUp);
          rail?.addEventListener("pointercancel", onRailPointerUp);
          rail?.addEventListener("keydown", onRailKeyDown);

          // Pong on the cockpit's dash holds the page while it runs, and the snap
          // stands aside for it: whatever lets go of the page - the rail, a
          // refresh, teardown - ends the game too. The arrow keys belong to the
          // game (they are player two), so they never let go: only a scroll up
          // does, or the game itself ending.
          freezeRef.current = (onRelease) => {
            letGo();
            // Settle in the middle of the hold, so the scrub's lag can't carry the
            // camera off the still - and the game with it - mid-rally.
            const hold = cockpitHold;
            const target = hold
              ? trigger.start +
                ((hold.from + hold.to) / 2 / master.duration()) * (trigger.end - trigger.start)
              : window.scrollY;
            const scroll = { y: window.scrollY };
            const settle = gsap.to(scroll, {
              y: target,
              duration: CAR_SNAP.settle,
              ease: "power2.out",
              onUpdate: () => window.scrollTo(0, scroll.y),
            });
            const holdWheel = (event: WheelEvent) => {
              if (event.deltaY < 0) release();
              else event.preventDefault();
            };
            let touchY = 0;
            const holdTouchStart = (event: TouchEvent) => {
              touchY = event.touches[0]?.clientY ?? touchY;
            };
            const holdTouchMove = (event: TouchEvent) => {
              const y = event.touches[0]?.clientY ?? touchY;
              if (y > touchY) release();
              else if (event.cancelable) event.preventDefault();
              touchY = y;
            };
            const holdKey = (event: KeyboardEvent) => {
              if (event.key === "PageUp" || event.key === "Home" || (event.key === " " && event.shiftKey)) {
                release();
              } else if (SCROLL_DOWN_KEYS.has(event.key) || event.key === "ArrowUp") {
                event.preventDefault();
              }
            };
            const tick = () => {
              if (settle.isActive()) return;
              if (window.scrollY < target - 40) {
                release();
                return;
              }
              if (Math.abs(window.scrollY - target) > 1) window.scrollTo(0, target);
            };
            const release = () => {
              if (releaseHold !== release) return;
              releaseHold = null;
              settle.kill();
              gsap.ticker.remove(tick);
              window.removeEventListener("wheel", holdWheel);
              window.removeEventListener("touchstart", holdTouchStart);
              window.removeEventListener("touchmove", holdTouchMove);
              window.removeEventListener("keydown", holdKey);
              onRelease();
            };
            releaseHold = release;
            window.addEventListener("wheel", holdWheel, { passive: false });
            window.addEventListener("touchstart", holdTouchStart, { passive: true });
            window.addEventListener("touchmove", holdTouchMove, { passive: false });
            window.addEventListener("keydown", holdKey);
            gsap.ticker.add(tick);
            return release;
          };

          paintRail(trigger.progress);
          if (stream && schedule) {
            stream.setSchedule(schedule.build());
            stream.seek(trigger.progress * master.duration(), 1);
            syncBand();
          }
          if (decoder && schedule) {
            decoder.setSchedule(schedule.build());
            decoder.seek(master.time(), 1);
          }
          const refreshFrame = window.requestAnimationFrame(() =>
            ScrollTrigger.refresh(),
          );

          return () => {
            window.cancelAnimationFrame(refreshFrame);
            letGo();
            freezeRef.current = null;
            rail?.removeEventListener("pointerdown", onRailPointerDown);
            rail?.removeEventListener("pointermove", onRailPointerMove);
            rail?.removeEventListener("pointerup", onRailPointerUp);
            rail?.removeEventListener("pointercancel", onRailPointerUp);
            rail?.removeEventListener("keydown", onRailKeyDown);
            railPresence.kill();
            if (rail) {
              delete rail.dataset.panning;
              gsap.set(rail, { autoAlpha: 0 });
            }
            window.clearTimeout(coastCheck);
            window.removeEventListener("wheel", onWheel);
            window.removeEventListener("keydown", onKey);
            window.removeEventListener("touchstart", onTouchStart);
            window.removeEventListener("touchmove", onTouchMove);
            window.removeEventListener("touchend", onTouchEnd);
            window.removeEventListener("touchcancel", onTouchEnd);
            window.removeEventListener("scroll", onScroll);
            ScrollTrigger.removeEventListener("refreshInit", letGo);
            ScrollTrigger.removeEventListener("refresh", syncSteps);
            stepRef.current = null;
            setSteps(null);
            trigger.kill();
            master.kill();
            labelBeats.forEach((beat) => {
              beat.arriving?.kill();
              beat.timeline.kill();
            });
            decoder?.dispose();
            if (decodeAheadRef.current === decoder) decodeAheadRef.current = null;
          };
        },
        sectionRef,
      );

      return () => media.revert();
    },
    {
      scope: sectionRef,
      dependencies: [sequenceReady, calibrationMode, calibrationChecked, frameSource],
      revertOnUpdate: true,
    },
  );

  const updateLabels = (
    chapterId: string,
    change: (labels: CarLabel[]) => CarLabel[],
  ) => {
    setDraftLabels((current) => ({
      ...current,
      [chapterId]: change(current[chapterId] ?? []),
    }));
    setSaveState({ status: "idle" });
  };

  const selectChapter = (chapterId: string) => {
    setSelectedChapterId(chapterId);
    setSelectedLabelId(draftLabels[chapterId]?.[0]?.id ?? null);
  };

  const moveLabel = (labelId: string, handle: LabelHandle, point: LabelPoint) =>
    updateLabels(selectedChapterId, (labels) =>
      labels.map((label) =>
        label.id === labelId ? { ...label, [handle]: point } : label,
      ),
    );

  const renameLabel = (labelId: string, text: string) =>
    updateLabels(selectedChapterId, (labels) =>
      labels.map((label) => (label.id === labelId ? { ...label, text } : label)),
    );

  const setLabelPart = (labelId: string, part: string | null) =>
    updateLabels(selectedChapterId, (labels) =>
      labels.map((label) => {
        if (label.id !== labelId) return label;
        const next = { ...label };
        if (part) next.part = part;
        else delete next.part;
        return next;
      }),
    );

  const addLabel = () => {
    const label: CarLabel = {
      id: newLabelId(selectedChapterId),
      text: "New label",
      dot: { x: 50, y: 50 },
      end: { x: 70, y: 38 },
    };
    updateLabels(selectedChapterId, (labels) => [...labels, label]);
    setSelectedLabelId(label.id);
  };

  const removeLabel = (labelId: string) => {
    const remaining = (draftLabels[selectedChapterId] ?? []).filter(
      (label) => label.id !== labelId,
    );
    updateLabels(selectedChapterId, () => remaining);
    if (selectedLabelId === labelId) {
      setSelectedLabelId(remaining[0]?.id ?? null);
    }
  };

  const unsaved = JSON.stringify(draftLabels) !== JSON.stringify(savedLabels);

  const saveLabels = async () => {
    setSaveState({ status: "saving" });
    try {
      const response = await fetch("/api/car-labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftLabels),
      });
      const result = (await response.json().catch(() => ({}))) as {
        labels?: CarLabelSet;
        errors?: string[];
      };
      if (!response.ok || !result.labels) {
        setSaveState({
          status: "error",
          errors: result.errors ?? [`Save failed (${response.status})`],
        });
        return;
      }
      // The file holds the tidied form, so the draft takes it too - otherwise a
      // trimmed space would read as an unsaved change.
      setDraftLabels(result.labels);
      setSavedLabels(result.labels);
      setSaveState({ status: "saved" });
    } catch {
      setSaveState({
        status: "error",
        errors: ["Could not reach the dev server"],
      });
    }
  };

  useEffect(() => {
    if (!calibrationMode || !unsaved) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [calibrationMode, unsaved]);

  // What is on screen while this pause's labels are up, when it is not the
  // orbit canvas - they have to be placed on that, not on the frame it is keyed to.
  const calibrationPose = calibrationMode
    ? pauseLayerUrl(frameSource ?? "landscape", calibrationChapter.pauseFrame)
    : null;

  // A part lit from the caption band. It only lasts while the pause's still is
  // on screen, and like a desktop hover, any scroll puts it out.
  const lit = band.live ? litLabel : null;
  useEffect(() => {
    if (!lit) return;
    const clear = () => setLitLabel(null);
    window.addEventListener("scroll", clear, { passive: true });
    return () => window.removeEventListener("scroll", clear);
  }, [lit]);
  const bandChapter = CAR_CHAPTERS[band.chapter] ?? CAR_CHAPTERS[0];
  // The legs and beats this set's cockpit run plays, one surface each.
  const excursionSteps = excursionFor(frameSource ?? "landscape").steps;
  const bandStill = portrait ? pauseLayerUrl("portrait", bandChapter.pauseFrame) : null;
  const step = (direction: Direction) => stepRef.current?.(direction);

  return (
    <section
      ref={sectionRef}
      data-car-sequence
      data-calibration={calibrationMode ? "true" : "false"}
      className="relative bg-bg"
    >
      <div
        ref={stageRef}
        // Which frame set is on screen, which is what lays the stage out: the
        // portrait set's 4:5 frame and caption band are styled in globals.css.
        // "pending" is the server render, before the set is known.
        data-car-stage={frameSet ?? "pending"}
        data-car-dim={lit || hoverLit ? "" : undefined}
        className="relative flex h-[100svh] items-center justify-center overflow-hidden bg-bg pt-16"
        // While a part is lit the whole stage dims with the frame, so the dim
        // has no edge (see STAGE_DIM).
        style={{
          backgroundColor: lit || hoverLit ? STAGE_DIM : undefined,
          transition: STAGE_DIM_FADE,
        }}
      >
        {!sequenceReady && !loadFailed && (
          <p className="absolute text-xs uppercase tracking-[0.2em] text-white/35">
            Loading vehicle
          </p>
        )}
        {loadFailed && (
          <p className="absolute text-sm text-white/60">
            The vehicle sequence could not be loaded.
          </p>
        )}

        <div data-car-frame className="relative inline-block max-w-full bg-bg leading-none">
          {CAR_REVEALS.filter((reveal) => reveal.kind === "isolate").map(
            (reveal) => (
              <img
                key={reveal.id}
                ref={(element) => {
                  revealIsolateRefs.current[reveal.id] = element;
                }}
                // No frame URL until the set is known; the portrait set's
                // stream gives it one when it has fetched the file.
                src={
                  landscapeSource
                    ? layerUrl(landscapeSource, reveal.isolate ?? "")
                    : undefined
                }
                alt=""
                aria-hidden="true"
                data-reveal-isolate={reveal.id}
                className="pointer-events-none absolute inset-0 z-0 h-full w-full select-none"
                style={{ opacity: 0, visibility: "hidden" }}
              />
            ),
          )}

          {excursionSteps.map((step) =>
            step.kind === "isolate" ? (
              <img
                key={step.layer}
                ref={(element) => {
                  excursionIsolateRefs.current[step.layer] = element;
                }}
                src={
                  landscapeSource
                    ? layerUrl(landscapeSource, step.layer)
                    : undefined
                }
                alt=""
                aria-hidden="true"
                data-excursion-isolate={step.layer}
                className="pointer-events-none absolute inset-0 z-0 h-full w-full select-none"
                style={{ opacity: 0, visibility: "hidden" }}
              />
            ) : null,
          )}

          <canvas
            ref={canvasRef}
            role="img"
            aria-label="Rotating view of the SR26 Baja SAE vehicle"
            className="relative z-10 block max-h-[calc(100svh-4rem)] max-w-[100vw]"
          />

          {excursionSteps.map((step) =>
            step.kind === "move" ? (
              <img
                key={step.prefix}
                ref={(element) => {
                  legRefs.current[step.prefix] = element;
                }}
                src={
                  landscapeSource
                    ? sequenceLayerUrl(landscapeSource, step.prefix, 0)
                    : undefined
                }
                alt=""
                aria-hidden="true"
                data-excursion-leg={step.prefix}
                className="pointer-events-none absolute inset-0 z-[23] h-full w-full select-none"
                style={{ opacity: 0, visibility: "hidden" }}
              />
            ) : null,
          )}

          {/* Pong on the dash, over the leg that paints the cockpit still. Shown
              by the timeline only while that still is up; desktop only, like the
              labels. zIndex inline: a new arbitrary class can go uncompiled. */}
          <div
            ref={eggRef}
            data-cockpit-egg
            className="pointer-events-none absolute inset-0 hidden lg:block"
            style={{ zIndex: 25, opacity: 0, visibility: "hidden" }}
          >
            {eggArmed && <CockpitEgg freezeRef={freezeRef} />}
          </div>

          {CAR_REVEALS.filter((reveal) => reveal.kind === "remove").map(
            (reveal) => (
              <Fragment key={reveal.id}>
                <img
                  ref={(element) => {
                    revealBaseRefs.current[reveal.id] = element;
                  }}
                  src={
                    landscapeSource
                      ? revealBaseSrc(landscapeSource, reveal)
                      : undefined
                  }
                  alt=""
                  aria-hidden="true"
                  // Decode before painting rather than after: these elements swap
                  // src while hidden, and an async decode paints the frame before.
                  decoding="sync"
                  data-reveal-base={reveal.id}
                  className="pointer-events-none absolute inset-0 z-20 h-full w-full select-none"
                  style={{ opacity: 0, visibility: "hidden" }}
                />
                <img
                  ref={(element) => {
                    revealPartRefs.current[reveal.id] = element;
                  }}
                  src={
                    landscapeSource
                      ? revealPartSrc(landscapeSource, reveal)
                      : undefined
                  }
                  alt=""
                  aria-hidden="true"
                  decoding="sync"
                  data-reveal-part={reveal.id}
                  className="pointer-events-none absolute inset-0 z-[22] h-full w-full select-none"
                  style={{ opacity: 0, visibility: "hidden" }}
                />
              </Fragment>
            ),
          )}

          {calibrationPose && (
            <img
              src={calibrationPose}
              alt=""
              aria-hidden="true"
              data-calibration-pose={calibrationPose}
              className="pointer-events-none absolute inset-0 z-[24] h-full w-full select-none bg-bg"
            />
          )}

          {/* The chip a phone taps lights its part the way a desktop hover
              does, through the same dim-and-lift layers. */}
          {portrait && bandStill && (
            <div
              data-car-highlights={bandChapter.id}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-30 select-none"
            >
              {(CAR_LABELS[bandChapter.id] ?? []).map((label) => {
                const matte = label.part
                  ? partMatteUrl("portrait", bandChapter.id, label.part)
                  : null;
                return matte ? (
                  <PartHighlight
                    key={label.id}
                    labelId={label.id}
                    still={bandStill}
                    matte={matte}
                    on={lit === label.id}
                  />
                ) : null;
              })}
            </div>
          )}

          {/* Who built what the sequence has stopped on. The phone set says the
              same thing on its caption band, which has room for it. */}
          {frameSet === "landscape" && (
            <CarSubteamTag
              subteam={band.live && !band.ended ? subteamFor(bandChapter.id) : null}
            />
          )}

          {/* Previous and next, in the corner across from the credit. They are
              not held to lg like the credit: a phone on its side gets this set
              and no caption band, and these are its only buttons. zIndex
              inline: a new arbitrary class can go uncompiled. */}
          {frameSet === "landscape" && !calibrationMode && (
            <div
              className="absolute right-[3.5%] bottom-[5%]"
              style={{ zIndex: 35 }}
            >
              <CarStepButtons steps={steps} onStep={step} />
            </div>
          )}

          {/* Labels are placed on the 16:9 stills, so only the landscape set
              has them; the portrait set's caption band stands in for them. */}
          {frameSet === "landscape" && (
            <CarLabelsLayer
              frameSet={landscapeSource ?? "landscape"}
              chapters={CAR_CHAPTERS}
              labels={calibrationMode ? draftLabels : CAR_LABELS}
              elements={labelElementsRef}
              onHighlight={setHoverLit}
              placement={
                calibrationMode
                  ? {
                      chapterId: selectedChapterId,
                      selectedLabelId,
                      onSelect: setSelectedLabelId,
                      onMove: moveLabel,
                    }
                  : null
              }
            />
          )}
        </div>

        {frameSet !== "landscape" && (
          <CarCaptionBand
            chapters={CAR_CHAPTERS}
            labels={CAR_LABELS}
            chapter={band.chapter}
            live={band.live}
            stage={!band.started ? "before" : band.ended ? "after" : "during"}
            lit={lit}
            onToggle={(labelId) =>
              setLitLabel((current) => (current === labelId ? null : labelId))
            }
            steps={steps}
            onStep={step}
          />
        )}
      </div>

      {/* How far through the sequence you are, and the rail that pans it. It is
          drawn ON the navbar's lower edge rather than under it: the track is left
          transparent so the navbar's own border is what the line rides, and only
          the filled part is painted. That means living outside the pinned stage -
          GSAP pins by setting a transform, which opens a stacking context the
          rail could never have escaped to reach over the navbar - so it is fixed
          to the viewport instead, and the pin only decides whether it is up. */}
      <div
        ref={railRef}
        role="slider"
        tabIndex={0}
        aria-label="Position in the vehicle sequence"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={0}
        aria-valuetext="0%"
        data-car-scrubber
        // pan-y, not none: the strip spans the top of a phone screen, so a finger
        // dragging down it has to still scroll the page. The browser takes those
        // over and hands us a pointercancel, which ends the pan; sideways drags
        // never reach it and stay ours.
        className="group fixed inset-x-0 top-[calc(4rem-1px)] z-[60] h-6 cursor-ew-resize touch-pan-y select-none outline-none motion-reduce:hidden"
        style={{ opacity: 0, visibility: "hidden" }}
      >
        {/* There is no track: the navbar's border is what the unfilled part of
            the rail already looks like, so only the filled part is drawn, and it
            stays a hairline at every state. Using the rail is announced by the
            handle appearing, not by the line growing. */}
        <div
          ref={railFillRef}
          className="absolute inset-x-0 top-0 h-px origin-left bg-livery"
          style={{ transform: "scaleX(0)" }}
        />
        {/* The playhead: a dot centred on the line, so at rest the whole thing is
            one hairline. Half of it sits above the line and over the navbar,
            which is only possible because the rail is painted above it. */}
        <div
          ref={railHandleRef}
          aria-hidden="true"
          className="absolute top-[0.5px] size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-livery opacity-0 ring-livery/25 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 group-focus-visible:ring-4 group-data-[panning=true]:opacity-100"
          style={{ left: "0%" }}
        />
      </div>

      <div className="mx-auto hidden max-w-5xl grid-cols-1 gap-4 px-5 py-10 motion-reduce:grid sm:grid-cols-2">
        {CAR_CHAPTERS.filter((chapter) => CAR_LABELS[chapter.id]?.length).map(
          (chapter) => (
            <article
              key={chapter.id}
              className="rounded-lg border border-white/10 bg-surface p-5 text-white"
            >
              <h2 className="font-coolvetica uppercase tracking-[0.16em]">
                {chapter.label}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-white/60">
                {CAR_LABELS[chapter.id].map((label) => label.text).join(", ")}
              </p>
            </article>
          ),
        )}
      </div>

      <ul className="sr-only">
        {CAR_CHAPTERS.filter((chapter) => CAR_LABELS[chapter.id]?.length).map(
          (chapter) => (
            <li key={chapter.id}>
              {chapter.label}:{" "}
              {CAR_LABELS[chapter.id].map((label) => label.text).join(", ")}
            </li>
          ),
        )}
      </ul>

      {calibrationMode && (
        <CarSequenceCalibration
          chapters={CAR_CHAPTERS}
          selectedChapterId={selectedChapterId}
          labels={draftLabels[selectedChapterId] ?? []}
          parts={Object.keys(CAR_PART_MATTES[selectedChapterId] ?? {})}
          selectedLabelId={selectedLabelId}
          pose={calibrationPose}
          frame={calibrationChapter.pauseFrame}
          unsaved={unsaved}
          saveState={saveState}
          onChapterChange={selectChapter}
          onSelectLabel={setSelectedLabelId}
          onAddLabel={addLabel}
          onRemoveLabel={removeLabel}
          onRenameLabel={renameLabel}
          onSetLabelPart={setLabelPart}
          onSave={saveLabels}
        />
      )}
    </section>
  );
}
