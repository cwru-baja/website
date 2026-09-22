"use client";

import type { Direction } from "./carSnap";

/**
 * Previous and next for the car sequence: one press plays the camera to the
 * stop before or after, exactly as one flick of the wheel does. It is for the
 * visitor who doesn't scroll to get around - a mouse without a wheel, a
 * trackpad whose momentum they can't hold back - and it says the page moves at
 * all, which a still frame on its own does not. On a touch screen they are the
 * only way through the sequence - a swipe inside it goes nowhere (see
 * CarSequence).
 *
 * Up and down rather than left and right, because that is the way the page
 * goes: the next stop is further down it. The ends are aria-disabled, not
 * disabled, so a button that runs out under keyboard focus keeps it.
 *
 * Drawn the way the competition page's season rows are: a heavy square-capped
 * chevron in the livery's ink, and a solid livery fill on hover (a press, on a
 * touch screen) that comes on at once - no transition.
 *
 * Desktop draws them as two squares in the frame's bottom-right corner, across
 * from the subteam credit (CarStepButtons). The phone draws them as the two
 * ends of the caption band's title pill, with the chapter's name between
 * (CarCaptionBand) - there, next to the round part chips, a square would argue
 * with them.
 *
 * No backdrop-filter: inside the pinned stage - GSAP pins with a transform -
 * Chromium dropped the blurred button from the paint at most stops while it
 * still took clicks. The corners it sits in are near black, so a plain
 * translucent fill reads the same.
 */

/** Whether there is a stop to go back to, and on to; null before there are stops. */
export type CarSteps = { back: boolean; on: boolean } | null;

export interface CarStepButtonProps {
  steps: CarSteps;
  onStep: (direction: Direction) => void;
  direction: Direction;
  /** The shape: size, border and fill at rest. Colour and hover come from here. */
  className?: string;
  /** The chevron's size. */
  iconClassName?: string;
}

export function CarStepButton({
  steps,
  onStep,
  direction,
  className = "",
  iconClassName = "size-6",
}: CarStepButtonProps) {
  const able = Boolean(steps && (direction > 0 ? steps.on : steps.back));
  return (
    <button
      type="button"
      aria-label={direction > 0 ? "Next view" : "Previous view"}
      aria-disabled={!able}
      data-car-step={direction > 0 ? "next" : "previous"}
      onClick={() => {
        if (able) onStep(direction);
      }}
      // Only opacity and visibility transition - the fade in once there are
      // stops, invisible until then so it can't be tabbed to. The hover fill
      // is instant.
      className={`inline-flex shrink-0 items-center justify-center outline-none transition-[opacity,visibility] duration-300 focus-visible:ring-2 focus-visible:ring-livery/60 focus-visible:ring-inset ${
        able
          ? "cursor-pointer text-livery-ink hover:bg-livery hover:text-on-livery active:bg-livery active:text-on-livery"
          : "cursor-default text-white/20"
      } ${steps ? "" : "invisible opacity-0"} ${className}`}
    >
      {/* The season rows' chevron, turned to point along the page. */}
      <svg viewBox="0 0 36 36" fill="none" aria-hidden="true" className={iconClassName}>
        <path
          d={direction > 0 ? "M6 12L18 24L30 12" : "M6 24L18 12L30 24"}
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
      </svg>
    </button>
  );
}

/** The frame's pair: two squares, for the landscape set. */
export default function CarStepButtons({
  steps,
  onStep,
}: {
  steps: CarSteps;
  onStep: (direction: Direction) => void;
}) {
  const square = (direction: Direction) => {
    const able = Boolean(steps && (direction > 0 ? steps.on : steps.back));
    return (
      <CarStepButton
        steps={steps}
        onStep={onStep}
        direction={direction}
        iconClassName="size-6 lg:size-7"
        className={`size-12 border bg-bg/70 lg:size-14 ${
          able ? "border-white/15 hover:border-livery active:border-livery" : "border-white/8"
        }`}
      />
    );
  };
  return (
    <div role="group" aria-label="Vehicle views" data-car-steps="frame" className="flex gap-2 motion-reduce:hidden">
      {square(-1)}
      {square(1)}
    </div>
  );
}
