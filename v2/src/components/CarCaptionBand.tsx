"use client";

import type { CarLabelSet } from "./carLabels";
import type { CarChapter } from "./carSequenceModel";
import { useScrollFade } from "./useScrollFade";

/**
 * The phone's stand-in for the desktop labels, under the 4:5 frame: which
 * chapter this is, and one chip per label on its pause. A chip whose label names
 * a part lights that part on the still when tapped, the way hovering the label
 * does on a desktop; the rest are plain text.
 *
 * Every row has a fixed height, so nothing in the band - or under it - moves
 * when the chapter changes or a chapter has more chips than fit: they scroll
 * sideways instead of wrapping. Sideways, because a vertical swipe on the band
 * has to keep scrolling the page.
 */
interface CarCaptionBandProps {
  chapters: CarChapter[];
  labels: CarLabelSet;
  /** Index into `chapters`. */
  chapter: number;
  /** Whether the pause's still is on screen, which is when a part can light. */
  live: boolean;
  lit: string | null;
  onToggle: (labelId: string) => void;
}

export default function CarCaptionBand({
  chapters,
  labels,
  chapter,
  live,
  lit,
  onToggle,
}: CarCaptionBandProps) {
  const current = chapters[chapter] ?? chapters[0];
  return (
    <div
      data-car-band
      className="flex-col gap-2 px-5 pt-3 pb-3"
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
        items={labels[current.id] ?? []}
        live={live}
        lit={lit}
        onToggle={onToggle}
      />
    </div>
  );
}

function ChipRow({
  items,
  live,
  lit,
  onToggle,
}: {
  items: CarLabelSet[string];
  live: boolean;
  lit: string | null;
  onToggle: (labelId: string) => void;
}) {
  const rowRef = useScrollFade<HTMLDivElement>();
  return (
    <div
      ref={rowRef}
      data-car-band-chips
      className="scroll-fade-x -mx-5 flex h-11 shrink-0 items-center gap-2 overflow-x-auto overscroll-x-contain px-5"
    >
      {items.map((label) =>
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
        ),
      )}
    </div>
  );
}
