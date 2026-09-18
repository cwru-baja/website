"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  DEFAULT_FRAMING,
  ZOOM_RANGE,
  isDefaultFraming,
  panLimit,
  roundFraming,
  type HeadshotFraming,
} from "./headshotFraming";

interface HeadshotCalibrationProps {
  names: string[];
  selectedName: string;
  framing: HeadshotFraming;
  draft: Record<string, HeadshotFraming>;
  onSelectName: (name: string) => void;
  onFramingChange: (framing: HeadshotFraming) => void;
  onReset: () => void;
}

const controlClass =
  "h-9 rounded-md border border-white/15 bg-black/45 px-2 text-xs text-white outline-none focus:border-livery-ink disabled:opacity-35";

const panelMargin = 8;

export const NUDGE_STEP = 1;
export const NUDGE_FINE_STEP = 0.25;

export default function HeadshotCalibration({
  names,
  selectedName,
  framing,
  draft,
  onSelectName,
  onFramingChange,
  onReset,
}: HeadshotCalibrationProps) {
  const [copyStatus, setCopyStatus] = useState("Copy framing");
  const [panelPosition, setPanelPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const limit = panLimit(framing.zoom);
  const locked = limit === 0;

  useEffect(() => {
    const keepPanelInViewport = () => {
      const panel = panelRef.current;
      if (!panel) return;

      setPanelPosition((position) => {
        if (!position) return position;
        const bounds = panel.getBoundingClientRect();
        const maxX = Math.max(panelMargin, window.innerWidth - bounds.width - panelMargin);
        const maxY = Math.max(panelMargin, window.innerHeight - bounds.height - panelMargin);

        return {
          x: Math.min(Math.max(panelMargin, position.x), maxX),
          y: Math.min(Math.max(panelMargin, position.y), maxY),
        };
      });
    };

    window.addEventListener("resize", keepPanelInViewport);
    return () => window.removeEventListener("resize", keepPanelInViewport);
  }, []);

  const startDragging = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const panel = panelRef.current;
    if (!panel) return;

    const bounds = panel.getBoundingClientRect();
    dragOffsetRef.current = {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };
    setPanelPosition({ x: bounds.left, y: bounds.top });
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const dragPanel = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const panel = panelRef.current;
    if (!panel) return;

    const bounds = panel.getBoundingClientRect();
    const maxX = Math.max(panelMargin, window.innerWidth - bounds.width - panelMargin);
    const maxY = Math.max(panelMargin, window.innerHeight - bounds.height - panelMargin);

    setPanelPosition({
      x: Math.min(Math.max(panelMargin, event.clientX - dragOffsetRef.current.x), maxX),
      y: Math.min(Math.max(panelMargin, event.clientY - dragOffsetRef.current.y), maxY),
    });
  };

  const stopDragging = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setIsDragging(false);
  };

  const nudge = (x: number, y: number) => {
    onFramingChange({
      ...framing,
      x: framing.x + x * NUDGE_STEP,
      y: framing.y + y * NUDGE_STEP,
    });
  };

  const copyFraming = async () => {
    const touched = Object.entries(draft).filter(
      ([, value]) => !isDefaultFraming(value),
    );

    if (touched.length === 0) {
      setCopyStatus("Nothing to copy — framing is default");
      return;
    }

    const snippet = touched
      .map(([name, value]) => {
        const { zoom, x, y } = roundFraming(value);
        return `// ${name}\nframing: { zoom: ${zoom}, x: ${x}, y: ${y} },`;
      })
      .join("\n");

    try {
      await navigator.clipboard.writeText(snippet);
      setCopyStatus(`Copied ${touched.length} — paste onto the member`);
    } catch {
      setCopyStatus("Copy failed — snippet logged to console");
      console.info("Calibrated headshot framing\n" + snippet);
    }
  };

  return (
    <aside
      ref={panelRef}
      data-calibration-panel
      className={`fixed z-[80] max-h-[calc(100svh-1rem)] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-white/15 bg-[#0a0a0a]/95 p-4 text-white shadow-2xl backdrop-blur-xl ${
        panelPosition ? "" : "right-4 top-20"
      }`}
      style={panelPosition ? { left: panelPosition.x, top: panelPosition.y } : undefined}
    >
      <div className="flex items-start justify-between gap-4">
        <button
          type="button"
          aria-label="Drag to move the calibration panel"
          className={`min-w-0 flex-1 touch-none select-none text-left outline-none focus-visible:ring-1 focus-visible:ring-livery-ink ${
            isDragging ? "cursor-grabbing" : "cursor-grab"
          }`}
          onPointerDown={startDragging}
          onPointerMove={dragPanel}
          onPointerUp={stopDragging}
          onPointerCancel={stopDragging}
          onLostPointerCapture={() => setIsDragging(false)}
        >
          <p className="font-coolvetica text-sm uppercase tracking-[0.18em]">
            Headshot framing
          </p>
          <p className="mt-1 text-[0.68rem] leading-relaxed text-white/45">
            Drag this header to move the pane. Changes remain in memory until
            copied.
          </p>
        </button>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className="rounded-full bg-livery/15 px-2 py-1 text-[0.6rem] uppercase tracking-wider text-livery-ink">
            Unsaved
          </span>
          {panelPosition && (
            <button
              type="button"
              className="text-[0.58rem] uppercase tracking-wider text-white/40 hover:text-white"
              onClick={() => setPanelPosition(null)}
            >
              Reset position
            </button>
          )}
        </div>
      </div>

      <div className="mt-4">
        <label className="flex flex-col gap-1 text-[0.62rem] uppercase tracking-wider text-white/45">
          Member
          <select
            className={controlClass}
            value={selectedName}
            onChange={(event) => onSelectName(event.target.value)}
          >
            {names.map((name) => (
              <option key={name} value={name}>
                {isDefaultFraming(draft[name] ?? DEFAULT_FRAMING) ? name : `${name} •`}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.035] p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/55">Zoom</span>
          <span className="font-mono text-white">{framing.zoom.toFixed(2)}×</span>
        </div>
        <input
          aria-label="Headshot zoom"
          className="mt-3 w-full accent-livery"
          type="range"
          min={ZOOM_RANGE.min}
          max={ZOOM_RANGE.max}
          step={ZOOM_RANGE.step}
          value={framing.zoom}
          onChange={(event) =>
            onFramingChange({ ...framing, zoom: Number(event.target.value) })
          }
        />
        <p className="mt-2 text-[0.62rem] leading-relaxed text-white/40">
          {locked
            ? "A square photo fills the circle exactly. Zoom past 1.00× to make room to shift it."
            : `Room to shift: ±${limit.toFixed(1)}% on each axis.`}
        </p>
      </div>

      <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.035] p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/55">Offset</span>
          <span className="font-mono text-white">
            {framing.x.toFixed(2)}%, {framing.y.toFixed(2)}%
          </span>
        </div>
        <div className="mx-auto mt-3 grid w-[9.5rem] grid-cols-3 gap-1.5">
          <span />
          <button
            type="button"
            aria-label="Shift photo up"
            className={controlClass}
            disabled={locked}
            onClick={() => nudge(0, -1)}
          >
            ↑
          </button>
          <span />
          <button
            type="button"
            aria-label="Shift photo left"
            className={controlClass}
            disabled={locked}
            onClick={() => nudge(-1, 0)}
          >
            ←
          </button>
          <button
            type="button"
            className={controlClass}
            disabled={locked}
            onClick={() => onFramingChange({ ...framing, x: 0, y: 0 })}
          >
            ⌖
          </button>
          <button
            type="button"
            aria-label="Shift photo right"
            className={controlClass}
            disabled={locked}
            onClick={() => nudge(1, 0)}
          >
            →
          </button>
          <span />
          <button
            type="button"
            aria-label="Shift photo down"
            className={controlClass}
            disabled={locked}
            onClick={() => nudge(0, 1)}
          >
            ↓
          </button>
          <span />
        </div>
      </div>

      <p className="mt-3 text-[0.68rem] leading-relaxed text-white/50">
        Click a headshot to select it, then drag it to reframe. Arrow keys nudge
        by {NUDGE_STEP}% and shift+arrow by {NUDGE_FINE_STEP}%; − and + change
        zoom. Photos are square, so the picture has to be zoomed in before it can
        move. A dot in the member list marks a headshot with custom framing.
      </p>

      <button
        type="button"
        className="mt-3 h-9 w-full rounded-md border border-white/15 bg-black/45 px-3 text-[0.62rem] uppercase tracking-wider text-white/60 hover:text-white"
        onClick={onReset}
      >
        Reset this headshot
      </button>

      <button
        type="button"
        className="mt-2 h-10 w-full rounded-md bg-livery px-3 text-xs font-medium uppercase tracking-[0.12em] text-on-livery hover:bg-livery-hover"
        onClick={copyFraming}
      >
        {copyStatus}
      </button>
    </aside>
  );
}
