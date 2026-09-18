"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { LABEL_STYLE, partName, type CarLabel } from "./carLabels";
import type { CarChapter } from "./carSequenceModel";

export type SaveState =
  | { status: "idle" | "saving" | "saved" }
  | { status: "error"; errors: string[] };

interface CarSequenceCalibrationProps {
  chapters: CarChapter[];
  selectedChapterId: string;
  labels: CarLabel[];
  /** Parts this pause has masks for, which a label can light up on hover. */
  parts: string[];
  selectedLabelId: string | null;
  /** The still shown at this pause, when the camera is off the orbit there. */
  pose: string | null;
  frame: number;
  unsaved: boolean;
  saveState: SaveState;
  onChapterChange: (chapterId: string) => void;
  onSelectLabel: (labelId: string) => void;
  onAddLabel: () => void;
  onRemoveLabel: (labelId: string) => void;
  onRenameLabel: (labelId: string, text: string) => void;
  onSetLabelPart: (labelId: string, part: string | null) => void;
  onSave: () => void;
}

const controlClass =
  "h-9 rounded-md border border-white/15 bg-black/45 px-2 text-xs text-white outline-none focus:border-livery-ink";

const panelMargin = 8;

export default function CarSequenceCalibration({
  chapters,
  selectedChapterId,
  labels,
  parts,
  selectedLabelId,
  pose,
  frame,
  unsaved,
  saveState,
  onChapterChange,
  onSelectLabel,
  onAddLabel,
  onRemoveLabel,
  onRenameLabel,
  onSetLabelPart,
  onSave,
}: CarSequenceCalibrationProps) {
  const [panelPosition, setPanelPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  // Labels go anywhere on the image, including under this pane.
  const [collapsed, setCollapsed] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

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
      x: Math.min(
        Math.max(panelMargin, event.clientX - dragOffsetRef.current.x),
        maxX,
      ),
      y: Math.min(
        Math.max(panelMargin, event.clientY - dragOffsetRef.current.y),
        maxY,
      ),
    });
  };

  const stopDragging = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setIsDragging(false);
  };

  const saving = saveState.status === "saving";

  return (
    <aside
      ref={panelRef}
      data-calibration-panel
      className={`fixed z-[80] max-h-[calc(100svh-1rem)] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-white/15 bg-[#0a0a0a]/95 p-4 text-white shadow-2xl backdrop-blur-xl ${
        panelPosition ? "" : "right-4 top-20"
      }`}
      style={
        panelPosition
          ? { left: panelPosition.x, top: panelPosition.y }
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-4">
        <button
          type="button"
          aria-label="Drag to move the label panel"
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
            Car labels
          </p>
          <p className="mt-1 text-[0.68rem] leading-relaxed text-white/45">
            Drag this header to move the pane.
          </p>
        </button>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {unsaved && (
            <span
              data-calibration-unsaved
              className="rounded-full bg-livery/15 px-2 py-1 text-[0.6rem] uppercase tracking-wider text-livery-ink"
            >
              Unsaved
            </span>
          )}
          <button
            type="button"
            data-calibration-collapse
            aria-expanded={!collapsed}
            className="text-[0.58rem] uppercase tracking-wider text-white/40 hover:text-white"
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? "Show" : "Hide"}
          </button>
          {panelPosition && !collapsed && (
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

      {!collapsed && (
        <>
          <div className="mt-4">
            <label className="flex flex-col gap-1 text-[0.62rem] uppercase tracking-wider text-white/45">
              Pause
              <select
                className={controlClass}
                value={selectedChapterId}
                onChange={(event) => onChapterChange(event.target.value)}
              >
                {chapters.map((chapter) => (
                  <option key={chapter.id} value={chapter.id}>
                    {chapter.label}
                  </option>
                ))}
              </select>
            </label>
            <p
              data-calibration-pose-readout
              className="mt-2 truncate font-mono text-[0.62rem] text-white/40"
            >
              {pose ? pose.split("/").at(-1) : `Orbit frame ${frame}`}
            </p>
          </div>

          <div className="mt-4">
            <p className="text-[0.62rem] uppercase tracking-wider text-white/45">
              Labels
            </p>
            <ul className="mt-2 space-y-1.5">
              {labels.map((label) => {
                const selected = label.id === selectedLabelId;
                return (
                  <li
                    key={label.id}
                    data-calibration-label={label.id}
                    className={`flex items-center gap-1.5 rounded-md border p-1 ${
                      selected
                        ? "border-livery/60 bg-livery/15"
                        : "border-white/10 bg-black/30"
                    }`}
                    style={{ flexWrap: "wrap" }}
                    onPointerDown={() => onSelectLabel(label.id)}
                  >
                    <input
                      aria-label="Label text"
                      className={`${controlClass} min-w-0 flex-1`}
                      value={label.text}
                      maxLength={LABEL_STYLE.maxTextLength}
                      onFocus={() => onSelectLabel(label.id)}
                      onChange={(event) => onRenameLabel(label.id, event.target.value)}
                    />
                    <button
                      type="button"
                      aria-label={`Remove ${label.text || "label"}`}
                      className="h-9 w-9 shrink-0 rounded-md text-base text-white/45 hover:text-white"
                      onClick={() => onRemoveLabel(label.id)}
                    >
                      ×
                    </button>
                    {parts.length > 0 && (
                      <select
                        aria-label="Part this label highlights"
                        data-calibration-part={label.id}
                        className={controlClass}
                        style={{ flexBasis: "100%" }}
                        value={label.part ?? ""}
                        onFocus={() => onSelectLabel(label.id)}
                        onChange={(event) =>
                          onSetLabelPart(label.id, event.target.value || null)
                        }
                      >
                        <option value="">No highlight</option>
                        {parts.map((part) => (
                          <option key={part} value={part}>
                            Highlights {partName(part).toLowerCase()}
                          </option>
                        ))}
                      </select>
                    )}
                  </li>
                );
              })}
            </ul>
            {!labels.length && (
              <p className="mt-2 text-[0.68rem] text-white/40">
                No labels on this pause yet.
              </p>
            )}
            <button
              type="button"
              className={`${controlClass} mt-2 w-full border-livery/45 bg-livery/10`}
              onClick={onAddLabel}
            >
              Add label
            </button>
          </div>

          <p className="mt-3 text-[0.68rem] leading-relaxed text-white/50">
            Drag a dot onto its part. Drag the square at the end of a line to place
            the name. Ends on the same side snap into a column; hold Option to place
            one freely.
          </p>

          <button
            type="button"
            data-calibration-save
            disabled={saving}
            className="mt-4 h-10 w-full rounded-md bg-livery px-3 text-xs font-medium uppercase tracking-[0.12em] text-on-livery hover:bg-livery-hover"
            style={saving ? { opacity: 0.6 } : undefined}
            onClick={onSave}
          >
            {saving
              ? "Saving…"
              : saveState.status === "saved" && !unsaved
                ? "Saved"
                : "Save"}
          </button>
          {saveState.status === "error" && (
            <ul
              data-calibration-save-errors
              className="mt-2 space-y-1 text-[0.68rem] leading-relaxed"
              style={{ color: "#fca5a5" }}
            >
              {saveState.errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </aside>
  );
}
