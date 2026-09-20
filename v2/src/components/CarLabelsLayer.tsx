"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import {
  LABEL_STYLE,
  labelGeometry,
  labelSide,
  partMatteUrl,
  snapToColumn,
  type CarLabel,
  type CarLabelSet,
  type LabelBox,
  type LabelGeometry,
  type LabelPoint,
} from "./carLabels";
import { pauseLayerUrl, type CarChapter, type FrameSourceLike } from "./carSequenceModel";

/** The pieces the scroll timeline animates, by label id. */
export interface LabelElements {
  dots: Record<string, SVGGElement | null>;
  /** Shows and hides a line, and the hover area along it. */
  lines: Record<string, SVGGElement | null>;
  /** Draws a line on. */
  paths: Record<string, SVGPathElement | null>;
  texts: Record<string, HTMLSpanElement | null>;
}

export type LabelHandle = "dot" | "end";

export interface LabelPlacement {
  chapterId: string;
  selectedLabelId: string | null;
  onSelect: (labelId: string) => void;
  onMove: (labelId: string, handle: LabelHandle, point: LabelPoint) => void;
}

interface CarLabelsLayerProps {
  /** The frames on screen, which the highlight's still and masks come from. */
  frameSet: FrameSourceLike;
  chapters: CarChapter[];
  labels: CarLabelSet;
  elements: RefObject<LabelElements>;
  /** Only in the placement tool: one pause's labels, shown, with drag handles. */
  placement?: LabelPlacement | null;
  /** Told when a hovered label starts and stops lighting its part. */
  onHighlight?: (on: boolean) => void;
}

// Start hidden and leave the rest to the timeline. These objects never change,
// so re-rendering on resize never writes over what GSAP has set.
const HIDDEN: CSSProperties = { opacity: 0, visibility: "hidden" };
const SHOWN: CSSProperties = {};

/** How close, in pixels, an end has to come to another's column to join it. */
const SNAP_DISTANCE = 12;

const clampPercent = (value: number) => Math.min(Math.max(value, 0), 100);

const HOVER_FADE = "opacity 280ms ease";
// The hovered label's line goes white, on the same beat as everything else the
// hover changes.
const LINE_FADE = "stroke 280ms ease";
const LINE_ON = "#ffffff";
/** How far the rest of the still dims while a part is highlighted. */
const DIM_ALPHA = 0.62;
const DIM = `rgba(0, 0, 0, ${DIM_ALPHA})`;
/**
 * The stage around the frame while a part is lit: the page background dimmed by
 * exactly what DIM does to it inside the frame, on the same fade. The dim only
 * covers the frame, so without this its edge reads as a black box drawn round
 * the car. Mixed in sRGB, as the dim layer is composited, so the two meet on the
 * same 8-bit value. The frame keeps an undimmed base of its own under the dim,
 * or its empty areas would be darkened twice.
 */
export const STAGE_DIM = `color-mix(in srgb, var(--color-bg) ${Math.round(
  (1 - DIM_ALPHA) * 100,
)}%, #000)`;
export const STAGE_DIM_FADE = "background-color 280ms ease";
/** How much the highlighted part lifts. */
const LIFT = "brightness(1.18) contrast(1.04)";
/** Other labels on the pause, while one is hovered. */
const QUIET = 0.3;

const maskSize = {
  maskSize: "100% 100%",
  WebkitMaskSize: "100% 100%",
  maskRepeat: "no-repeat",
  WebkitMaskRepeat: "no-repeat",
} satisfies CSSProperties;

/** Only the part: its matte as the mask. */
const insideMask = (matte: string): CSSProperties => ({
  ...maskSize,
  maskImage: `url("${matte}")`,
  WebkitMaskImage: `url("${matte}")`,
});

/** Everything but the part: its matte cut out of a full-frame mask. */
const outsideMask = (matte: string): CSSProperties => ({
  ...maskSize,
  maskImage: `url("${matte}"), linear-gradient(#000 0 0)`,
  WebkitMaskImage: `url("${matte}"), linear-gradient(#000 0 0)`,
  maskComposite: "exclude",
  WebkitMaskComposite: "xor",
});

interface Highlight {
  chapterId: string;
  still: string;
  matte: string;
}

/**
 * A part lit on a pause's still: the rest of the still dims through the part's
 * matte, and the part itself is lifted by a copy of the still cut to the matte.
 * Always mounted and faded by `on`, so lighting one is a fade, not a load.
 * Desktop label hover and the phone caption band's chips both light parts with
 * this, which is what keeps the two looking the same.
 */
export function PartHighlight({
  labelId,
  still,
  matte,
  on,
}: {
  labelId: string;
  still: string;
  matte: string;
  on: boolean;
}) {
  return (
    <>
      <div
        data-label-dim={labelId}
        className="absolute inset-0"
        style={{
          ...outsideMask(matte),
          background: DIM,
          opacity: on ? 1 : 0,
          transition: HOVER_FADE,
        }}
      />
      <img
        data-label-lift={labelId}
        src={still}
        alt=""
        className="absolute inset-0 h-full w-full"
        style={{
          ...insideMask(matte),
          filter: LIFT,
          opacity: on ? 1 : 0,
          transition: HOVER_FADE,
        }}
      />
    </>
  );
}

export default function CarLabelsLayer({
  frameSet,
  chapters,
  labels,
  elements,
  placement = null,
  onHighlight,
}: CarLabelsLayerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<LabelBox>({ width: 0, height: 0 });
  const [textWidths, setTextWidths] = useState<Record<string, number>>({});
  const [guide, setGuide] = useState<number | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const dragRef = useRef<{ labelId: string; handle: LabelHandle } | null>(null);
  const textObserverRef = useRef<ResizeObserver | null>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setBox((current) =>
        current.width === width && current.height === height
          ? current
          : { width, height },
      );
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => () => textObserverRef.current?.disconnect(), []);

  // A name's width sets the shortest run it can sit on, and it changes when the
  // font arrives or the text is edited - so it is observed, not measured once.
  const observeText = useCallback((element: HTMLDivElement | null) => {
    if (!element) return;
    if (!textObserverRef.current) {
      textObserverRef.current = new ResizeObserver((entries) => {
        setTextWidths((current) => {
          let next = current;
          entries.forEach((entry) => {
            const id = (entry.target as HTMLElement).dataset.labelId;
            if (!id) return;
            const width = Math.round(entry.contentRect.width * 10) / 10;
            if (current[id] === width) return;
            if (next === current) next = { ...current };
            next[id] = width;
          });
          return next;
        });
      });
    }
    const observer = textObserverRef.current;
    observer.observe(element);
    return () => observer.unobserve(element);
  }, []);

  const shown = placement
    ? chapters.filter((chapter) => chapter.id === placement.chapterId)
    : chapters;
  const shownLabels: CarLabel[] = shown.flatMap(
    (chapter) => labels[chapter.id] ?? [],
  );
  const geometries: Record<string, LabelGeometry> = Object.fromEntries(
    shownLabels.map((label) => [
      label.id,
      labelGeometry(label, box, textWidths[label.id] ?? 0),
    ]),
  );
  const initial = placement ? SHOWN : HIDDEN;

  // A label lights its part when it names one that has a mask, cut from the
  // still the pause holds on. Not in the placement tool, where the labels are
  // being dragged rather than read.
  const highlights: Record<string, Highlight> = placement
    ? {}
    : Object.fromEntries(
        shown.flatMap((chapter) => {
          const still = pauseLayerUrl(frameSet, chapter.pauseFrame);
          return (labels[chapter.id] ?? []).flatMap((label) => {
            const matte =
              still && label.part
                ? partMatteUrl(frameSet, chapter.id, label.part)
                : null;
            return still && matte
              ? [[label.id, { chapterId: chapter.id, still, matte }]]
              : [];
          });
        }),
      );
  const highlightKey = Object.values(highlights)
    .map((highlight) => highlight.matte)
    .join("|");
  const active = hovered && highlights[hovered] ? hovered : null;
  const activeChapter = active ? highlights[active].chapterId : null;
  const chapterOf = Object.fromEntries(
    shown.flatMap((chapter) =>
      (labels[chapter.id] ?? []).map((label) => [label.id, chapter.id]),
    ),
  );
  // The rest of the pause steps back while one of its labels is hovered.
  const fade = (labelId: string) =>
    active && labelId !== active && chapterOf[labelId] === activeChapter
      ? QUIET
      : 1;

  const highlighted = active !== null;
  useEffect(() => {
    if (!highlighted) return;
    onHighlight?.(true);
    return () => onHighlight?.(false);
  }, [highlighted, onHighlight]);

  // Masks sit on transparent layers until a hover, which a browser may not
  // fetch for - so fetch them up front rather than on the first hover.
  useEffect(() => {
    if (!highlightKey) return;
    highlightKey.split("|").forEach((url) => {
      const image = new Image();
      image.src = url;
    });
  }, [highlightKey]);

  // Scrolling moves the camera on, so a highlight never outlives the scroll
  // that started it; the pointer has to move again to bring it back.
  useEffect(() => {
    if (!active) return;
    const clear = () => setHovered(null);
    window.addEventListener("scroll", clear, { passive: true });
    return () => window.removeEventListener("scroll", clear);
  }, [active]);

  // Only a pointer that actually moves counts. Labels draw on under a resting
  // cursor as the page scrolls, and the browser's own after-scroll pointer
  // events report no movement.
  const hover = (labelId: string) =>
    highlights[labelId]
      ? {
          onPointerMove: (event: ReactPointerEvent<Element>) => {
            if (event.movementX || event.movementY) setHovered(labelId);
          },
          onPointerLeave: () =>
            setHovered((current) => (current === labelId ? null : current)),
        }
      : {};

  const pointFromEvent = (event: ReactPointerEvent<Element>): LabelPoint => {
    const bounds = rootRef.current?.getBoundingClientRect();
    if (!bounds?.width || !bounds.height) return { x: 0, y: 0 };
    return {
      x: clampPercent(((event.clientX - bounds.left) / bounds.width) * 100),
      y: clampPercent(((event.clientY - bounds.top) / bounds.height) * 100),
    };
  };

  const startDrag = (
    event: ReactPointerEvent<SVGElement>,
    labelId: string,
    handle: LabelHandle,
  ) => {
    if (!placement) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    placement.onSelect(labelId);
    dragRef.current = { labelId, handle };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const drag = (event: ReactPointerEvent<SVGElement>) => {
    const current = dragRef.current;
    if (!placement || !current) return;
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    let point = pointFromEvent(event);

    if (current.handle === "end" && box.width) {
      const label = shownLabels.find((candidate) => candidate.id === current.labelId);
      // Option/Alt places an end freely, off every column.
      if (label && !event.altKey) {
        const side = labelSide({ dot: label.dot, end: point });
        const columns = shownLabels
          .filter(
            (other) =>
              other.id !== label.id && labelSide(other) === side,
          )
          .map((other) => geometries[other.id].end.x);
        const snapped = snapToColumn(
          (point.x / 100) * box.width,
          columns,
          SNAP_DISTANCE,
        );
        setGuide(snapped);
        if (snapped !== null) {
          point = { ...point, x: (snapped / box.width) * 100 };
        }
      } else {
        setGuide(null);
      }
    }

    placement.onMove(current.labelId, current.handle, point);
  };

  const stopDrag = (event: ReactPointerEvent<SVGElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    setGuide(null);
  };

  const dragHandlers = {
    onPointerMove: drag,
    onPointerUp: stopDrag,
    onPointerCancel: stopDrag,
    onLostPointerCapture: () => {
      dragRef.current = null;
      setGuide(null);
    },
  };

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      data-car-labels
      className="pointer-events-none absolute inset-0 z-30 hidden select-none lg:block"
      style={{ containerType: "inline-size" }}
    >
      {Object.entries(highlights).map(([labelId, { still, matte }]) => (
        <PartHighlight
          key={labelId}
          labelId={labelId}
          still={still}
          matte={matte}
          on={labelId === active}
        />
      ))}

      <svg
        className="absolute inset-0 h-full w-full overflow-visible"
        width={box.width}
        height={box.height}
        fill="none"
      >
        {guide !== null && (
          <line
            x1={guide}
            x2={guide}
            y1={0}
            y2={box.height}
            stroke="rgba(255,255,255,0.45)"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        )}

        {/* Lines first, so no line ever crosses over another label's dot. */}
        {shownLabels.map((label) => (
          <g
            key={label.id}
            style={{ opacity: fade(label.id), transition: HOVER_FADE }}
          >
            <g
              ref={(element) => {
                elements.current.lines[label.id] = element;
              }}
              data-label-line={label.id}
              style={initial}
            >
              <path
                ref={(element) => {
                  elements.current.paths[label.id] = element;
                }}
                data-label-path={label.id}
                d={geometries[label.id].path}
                pathLength={1}
                stroke={label.id === active ? LINE_ON : "var(--livery)"}
                style={{ transition: LINE_FADE }}
                strokeWidth={LABEL_STYLE.stroke}
                strokeLinecap="butt"
                strokeLinejoin="miter"
              />
              {highlights[label.id] && (
                // A 3px line is a hard target; this one only exists while the
                // line does, since it hides with the group around it.
                <path
                  d={geometries[label.id].path}
                  stroke="transparent"
                  strokeWidth={18}
                  pointerEvents="visibleStroke"
                  {...hover(label.id)}
                />
              )}
            </g>
          </g>
        ))}

        {shownLabels.map((label) => {
          const { dot } = geometries[label.id];
          return (
            <g
              key={label.id}
              transform={`translate(${dot.x} ${dot.y})`}
              // The dot sits on the part, so it steps aside while the part is lit.
              style={{
                opacity: label.id === active ? 0 : fade(label.id),
                transition: HOVER_FADE,
              }}
            >
              <g
                ref={(element) => {
                  elements.current.dots[label.id] = element;
                }}
                data-label-dot={label.id}
                style={initial}
              >
                <circle
                  r={LABEL_STYLE.haloRadius}
                  fill="var(--livery)"
                  fillOpacity={0.3}
                  pointerEvents={highlights[label.id] ? "visiblePainted" : undefined}
                  {...hover(label.id)}
                />
                <circle
                  r={LABEL_STYLE.dotRadius}
                  fill="var(--livery)"
                  stroke="#fff"
                  strokeWidth={LABEL_STYLE.dotRing}
                />
              </g>
            </g>
          );
        })}

        {placement &&
          shownLabels.map((label) => {
            const { dot, end, path } = geometries[label.id];
            const selected = label.id === placement.selectedLabelId;
            return (
              <g key={label.id} data-label-handles={label.id}>
                <path
                  d={path}
                  stroke="transparent"
                  strokeWidth={16}
                  pointerEvents="stroke"
                  style={{ cursor: "pointer" }}
                  onPointerDown={() => placement.onSelect(label.id)}
                />
                {selected && (
                  <circle
                    cx={dot.x}
                    cy={dot.y}
                    r={LABEL_STYLE.haloRadius + 5}
                    stroke="#fff"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                  />
                )}
                <circle
                  data-label-dot-handle={label.id}
                  cx={dot.x}
                  cy={dot.y}
                  r={LABEL_STYLE.haloRadius + 4}
                  fill="transparent"
                  pointerEvents="all"
                  style={{ cursor: "grab", touchAction: "none" }}
                  onPointerDown={(event) => startDrag(event, label.id, "dot")}
                  {...dragHandlers}
                />
                <rect
                  data-label-end-handle={label.id}
                  x={end.x - 6}
                  y={end.y - 6}
                  width={12}
                  height={12}
                  fill={selected ? "var(--livery)" : "#0a0a0a"}
                  stroke="#fff"
                  strokeWidth={2}
                  pointerEvents="all"
                  style={{ cursor: "grab", touchAction: "none" }}
                  onPointerDown={(event) => startDrag(event, label.id, "end")}
                  {...dragHandlers}
                />
              </g>
            );
          })}
      </svg>

      {shownLabels.map((label) => {
        const { end, side } = geometries[label.id];
        return (
          <div
            key={label.id}
            ref={observeText}
            data-label-id={label.id}
            className="absolute whitespace-nowrap font-clash font-medium uppercase leading-none tracking-[0.18em] text-white"
            style={{
              left: end.x,
              top: end.y - LABEL_STYLE.textLift,
              // The name sits on the run, flush with its outer end.
              transform:
                side === "right" ? "translate(-100%, -100%)" : "translate(0, -100%)",
              fontSize: "clamp(0.6875rem, 1.05cqw, 0.9375rem)",
              pointerEvents: placement ? "auto" : undefined,
              cursor: placement ? "pointer" : undefined,
              opacity: fade(label.id),
              transition: HOVER_FADE,
            }}
            onPointerDown={placement ? () => placement.onSelect(label.id) : undefined}
          >
            <span
              ref={(element) => {
                elements.current.texts[label.id] = element;
              }}
              data-label-text={label.id}
              className="relative block"
              // Tracking trails the last letter too; pull it back so the name
              // ends where the run does.
              style={{ ...initial, marginRight: "-0.18em" }}
            >
              {label.text}
              {highlights[label.id] && (
                // A padded hover area that hides with the name, so it cannot be
                // hovered while the name is not on screen.
                <span
                  data-label-hover={label.id}
                  className="absolute"
                  style={{ inset: "-10px -12px", pointerEvents: "auto" }}
                  {...hover(label.id)}
                />
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
