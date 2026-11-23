"use client";

import { useEffect, useState, type RefObject } from "react";

// A teal arrow from the dare note, round the form's left side, to Blackbaud's
// "Other (optional)" box. The form is a cross-origin frame, so the box can't be
// measured. What we can see is the frame's height (the loader resizes it to the
// form), and everything below the box (your information, payment, the button)
// never changes size. So the box sits a fixed distance above the frame's
// bottom, whether the amount list is collapsed or open, and whether or not the
// donor ticks "dedicate this gift", which grows the form above the box.
//
// The form has two layouts, switching at a 768px-wide frame (its own
// breakpoint): from 768 State and ZIP share a row, below it they stack, which
// is the only change under the box. Measured at frames of 288, 343, 636 and
// 768px. Needs re-measuring if CAA changes the form below the box.
const WIDE_FRAME = 768;
const otherBox = (frameWidth: number) =>
  frameWidth >= WIDE_FRAME
    ? { centreFromBottom: 715, leftInset: 19 }
    : { centreFromBottom: 782, leftInset: 15 };
/** The shortest the form gets; anything less is the frame still loading. */
const MIN_FORM_HEIGHT = 900;
/** How far left of the form the arrow runs, when there's room. */
const LANE = 44;
/** On phones the form is 16px from the edge; the arrow runs this far in. */
const MIN_LANE_X = 6;
const R = 16;

type Geometry = { width: number; height: number; d: string; head: string; stroke: number };

/**
 * Drawn inside `page` (positioned), from `card` to the "Other" box in the
 * iframe the loader puts inside `form`.
 */
export default function PasteArrow({
  page,
  card,
  form,
}: {
  page: RefObject<HTMLElement | null>;
  card: RefObject<HTMLElement | null>;
  form: RefObject<HTMLElement | null>;
}) {
  const [geo, setGeo] = useState<Geometry | null>(null);

  useEffect(() => {
    const host = page.current;
    const container = form.current;
    if (!host || !container) return;
    const frameOf = () => container.querySelector("iframe");

    const measure = () => {
      const note = card.current;
      const frame = frameOf();
      const area = host.getBoundingClientRect();
      // A ResizeObserver can report 0x0 while the page is being torn down.
      if (!note || !frame || area.width === 0) return setGeo(null);
      const f = frame.getBoundingClientRect();
      if (f.height < MIN_FORM_HEIGHT) return setGeo(null);
      const c = note.getBoundingClientRect();
      const target = otherBox(f.width);

      // In page coordinates: out of the card's left edge, left to the lane,
      // down, and right into the box. The lane is LANE left of the form, or
      // squeezed into the phone gutter, and the corners shrink to fit it.
      const left = f.left - area.left;
      const x0 = c.left - area.left;
      const y0 = c.top - area.top + c.height * 0.62;
      const xl = Math.max(left - LANE, MIN_LANE_X - area.left);
      const yt = f.bottom - area.top - target.centreFromBottom;
      const xt = left + target.leftInset - 5;
      const roomy = left - LANE >= MIN_LANE_X - area.left;
      const head = roomy ? 10 : 7;
      const r = Math.max(0, Math.min(R, x0 - xl - 1, xt - head - xl - 1, (yt - y0) / 2));
      setGeo({
        width: area.width,
        height: area.height,
        d: `M ${x0} ${y0} H ${xl + r} Q ${xl} ${y0} ${xl} ${y0 + r} V ${yt - r} Q ${xl} ${yt} ${xl + r} ${yt} H ${xt}`,
        head: `M ${xt - head} ${yt - head * 0.8} L ${xt} ${yt} L ${xt - head} ${yt + head * 0.8}`,
        stroke: roomy ? 3 : 2.5,
      });
    };

    // Watch the page (window resizes) and the frame itself (the form loading,
    // the amount list opening, the dedication fields). The page alone misses
    // some: its min-height hides the frame growing until it passes 60rem. The
    // loader inserts the frame after we mount, so wait for it.
    const resize = new ResizeObserver(measure);
    resize.observe(host);
    let watched: Element | null = null;
    const watchFrame = () => {
      const frame = frameOf();
      if (frame && frame !== watched) {
        watched = frame;
        resize.observe(frame);
      }
      measure();
    };
    const inserted = new MutationObserver(watchFrame);
    inserted.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ["style"] });
    watchFrame();
    return () => {
      resize.disconnect();
      inserted.disconnect();
    };
  }, [page, card, form]);

  if (!geo) return null;

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute top-0 left-0 overflow-visible"
      width={geo.width}
      height={geo.height}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={geo.d} pathLength={1} className="paste-arrow-draw stroke-livery" strokeWidth={geo.stroke} />
      <path d={geo.head} className="paste-arrow-head stroke-livery" strokeWidth={geo.stroke} />
    </svg>
  );
}
