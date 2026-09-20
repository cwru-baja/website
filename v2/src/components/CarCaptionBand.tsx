"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { CarLabel, CarLabelSet } from "./carLabels";
import type { CarChapter } from "./carSequenceModel";
import { balanceChips } from "./chipWrap";
import { useScrollFade } from "./useScrollFade";

/**
 * The phone's stand-in for the desktop labels, under the 4:5 frame: which
 * chapter this is, and one chip per label on its pause. A chip whose label names
 * a part lights that part on the still when tapped, the way hovering the label
 * does on a desktop; the rest are plain text.
 *
 * The band has a fixed height, so nothing in it - or under it - moves when the
 * chapter changes. The chips go on as many rows as that height holds, balanced
 * (see chipWrap.ts), and only a chapter with more than fit there scrolls,
 * sideways, because a vertical swipe on the band has to keep scrolling the page.
 * On a phone with its browser bars showing that is usually one row; a tall
 * screen shows every chip.
 */
interface CarCaptionBandProps {
  chapters: CarChapter[];
  labels: CarLabelSet;
  /** Index into `chapters`. */
  chapter: number;
  /** Whether the pause's still is on screen, which is when a part can light. */
  live: boolean;
  /** Past the last chapter, when the band fades out until scrolled back. */
  ended: boolean;
  lit: string | null;
  onToggle: (labelId: string) => void;
}

export default function CarCaptionBand({
  chapters,
  labels,
  chapter,
  live,
  ended,
  lit,
  onToggle,
}: CarCaptionBandProps) {
  const current = chapters[chapter] ?? chapters[0];
  return (
    <div
      data-car-band
      // Faded rather than unmounted, so nothing under it moves. visibility
      // comes along so its chips can't be tapped or tabbed to once it's gone.
      className={`flex-col gap-2 px-5 pt-3 pb-3 transition-[opacity,visibility] duration-300 ${ended ? "invisible opacity-0" : ""}`}
      aria-label="Chapter"
      role="group"
    >
      <p
        data-car-band-title
        className="flex h-5 shrink-0 items-center gap-3 font-clash text-[0.8125rem] font-medium uppercase leading-none tracking-[0.18em]"
      >
        {/* A fixed box, so a wider or narrower numeral never nudges the name. */}
        <span className="w-6 shrink-0 text-livery">
          {String(chapter + 1).padStart(2, "0")}
        </span>
        <span className="min-w-0 truncate text-white">{current.label}</span>
      </p>
      {/* Keyed by chapter, so a new chapter's chips start scrolled to the start. */}
      <ChipRow
        key={current.id}
        items={labels[current.id] ?? NO_LABELS}
        live={live}
        lit={lit}
        onToggle={onToggle}
      />
    </div>
  );
}

/** h-11 and gap-2: a chip is the 44 px tap target it draws. */
const CHIP_HEIGHT = 44;
const CHIP_GAP = 8;

const NO_LABELS: CarLabel[] = [];

interface ChipRowsLayout {
  /** Indices into the chapter's labels, row by row. */
  rows: number[][];
  /** Set only when the rows are wider than the band, which then scrolls. */
  width: number | null;
}

const sameLayout = (left: ChipRowsLayout, right: ChipRowsLayout) =>
  left.width === right.width && JSON.stringify(left.rows) === JSON.stringify(right.rows);

function ChipRow({
  items,
  live,
  lit,
  onToggle,
}: {
  items: CarLabel[];
  live: boolean;
  lit: string | null;
  onToggle: (labelId: string) => void;
}) {
  const rowRef = useScrollFade<HTMLDivElement>();
  const listRef = useRef<HTMLDivElement>(null);
  // Null until the chips are measured, which is before the first paint.
  const [layout, setLayout] = useState<ChipRowsLayout | null>(null);

  useLayoutEffect(() => {
    const row = rowRef.current;
    const list = listRef.current;
    if (!row || !list) return;
    // The chips never remount when the rows change - they are all children of
    // the list, moved by key - so these stay the chips on screen.
    const chips = [...list.querySelectorAll<HTMLElement>("[data-car-chip]")];
    const fit = () => {
      const style = getComputedStyle(row);
      const room = Math.floor(
        row.getBoundingClientRect().width -
          parseFloat(style.paddingLeft) -
          parseFloat(style.paddingRight),
      );
      const rows = Math.max(
        1,
        Math.floor((row.clientHeight + CHIP_GAP) / (CHIP_HEIGHT + CHIP_GAP)),
      );
      const widths = new Map(
        chips.map((chip) => [chip.dataset.carChip, chip.getBoundingClientRect().width]),
      );
      const balanced = balanceChips(
        items.map((label) => widths.get(label.id) ?? 0),
        CHIP_GAP,
        rows,
        room,
      );
      const next = {
        rows: balanced.rows,
        width: balanced.width > room ? balanced.width : null,
      };
      setLayout((current) => (current && sameLayout(current, next) ? current : next));
    };
    fit();
    // The band's height changes with the screen, and each chip's width when
    // Clash loads.
    const observer = new ResizeObserver(fit);
    observer.observe(row);
    chips.forEach((chip) => observer.observe(chip));
    return () => observer.disconnect();
  }, [rowRef, items]);

  const chip = (label: CarLabel) =>
    label.part ? (
      <button
        key={label.id}
        type="button"
        data-car-chip={label.id}
        aria-pressed={lit === label.id}
        disabled={!live}
        onClick={() => onToggle(label.id)}
        className="inline-flex h-11 min-w-11 shrink-0 items-center justify-center rounded-full border border-white/20 px-4 font-clash text-[0.6875rem] font-medium uppercase leading-none tracking-[0.16em] whitespace-nowrap text-white/85 transition-[background-color,border-color,color,opacity] duration-200 outline-none focus-visible:ring-2 focus-visible:ring-livery/60 disabled:opacity-40 aria-pressed:border-livery aria-pressed:bg-livery/15 aria-pressed:text-white"
      >
        {label.text}
      </button>
    ) : (
      <span
        key={label.id}
        data-car-chip={label.id}
        className="inline-flex h-11 shrink-0 items-center gap-2 px-1 font-clash text-[0.6875rem] font-medium uppercase leading-none tracking-[0.16em] whitespace-nowrap text-white/60"
      >
        <span aria-hidden="true" className="size-1.5 rounded-full bg-livery" />
        {label.text}
      </span>
    );

  return (
    <div
      ref={rowRef}
      data-car-band-chips
      className="scroll-fade-x -mx-5 flex min-h-11 grow basis-0 items-start overflow-x-auto overflow-y-hidden overscroll-x-contain px-5"
    >
      {/* One flat list, rows split by full-width breaks, so a chip moving to
          another row is moved rather than remade. Before it is measured, it is
          one row in label order. */}
      <div
        ref={listRef}
        className={`flex w-full shrink-0 gap-x-2 ${layout ? "flex-wrap" : ""}`}
        style={layout?.width ? { width: layout.width } : undefined}
      >
        {(layout?.rows ?? [items.map((_, index) => index)]).flatMap((row, rowIndex) => [
          ...(rowIndex > 0
            ? [<span key={`break-${rowIndex}`} aria-hidden="true" className="h-2 basis-full" />]
            : []),
          ...row.map((index) => chip(items[index])),
        ])}
      </div>
    </div>
  );
}
