/**
 * The rail under the navbar reads the pinned sequence's position and lets a
 * visitor pan it. Everything here is the arithmetic between a pointer or a key
 * and a scroll position; the wiring lives in CarSequence.
 */

/** Fraction of the whole sequence one arrow key moves the playhead. */
export const SCRUB_STEP = 0.02;

/** Fraction Page Up / Page Down moves it. */
export const SCRUB_PAGE = 0.1;

/**
 * Seconds a scrub keeps the label hold off its back. A pan crosses pauses far
 * faster than a scroll does, and a hold that grabbed the page mid-drag would
 * fight the pointer for the rest of it. Sized just past the scrub smoothing, so
 * the hold is free again about as soon as the car has caught up.
 */
export const SCRUB_HOLD_SUPPRESS = 0.4;

export const clampProgress = (value: number) =>
  value < 0 ? 0 : value > 1 ? 1 : value;

export interface RailRect {
  left: number;
  width: number;
}

/** Where along the rail a pointer is, as a fraction of it. */
export const progressFromPointer = (clientX: number, rect: RailRect) => {
  // A rail that has not been laid out yet has no position to report, and
  // dividing by its width would hand back NaN and park the playhead on frame 1.
  if (!(rect.width > 0)) return 0;
  return clampProgress((clientX - rect.left) / rect.width);
};

/** The scroll position that puts the pinned sequence at `progress`. */
export const scrollForProgress = (progress: number, start: number, end: number) =>
  Math.round(start + clampProgress(progress) * (end - start));

/**
 * Where a key takes the playhead, or null for one the rail leaves alone.
 *
 * Up and down are deliberately not handled. The sequence is scrubbed by the page
 * scroll those keys already drive, so passing them through both scrolls the page
 * and advances the car - inverting one of them against the other is what would
 * feel broken. Left and right cover the slider contract on their own, with Home
 * and End for the bounds and Page Up / Page Down for a coarser step.
 */
export const progressForKey = (key: string, progress: number): number | null => {
  switch (key) {
    case "ArrowRight":
      return clampProgress(progress + SCRUB_STEP);
    case "ArrowLeft":
      return clampProgress(progress - SCRUB_STEP);
    case "PageUp":
      return clampProgress(progress + SCRUB_PAGE);
    case "PageDown":
      return clampProgress(progress - SCRUB_PAGE);
    case "Home":
      return 0;
    case "End":
      return 1;
    default:
      return null;
  }
};

/** What the rail reports to a screen reader. */
export const scrubPercent = (progress: number) =>
  Math.round(clampProgress(progress) * 100);
