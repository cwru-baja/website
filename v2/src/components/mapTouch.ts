// Touch behaviour for the competition dot map. A tap picks a venue and docks
// its card in one place for as long as it stays open, so tapping a second
// venue swaps the card's content without moving it.

export interface ScreenPoint {
  x: number;
  y: number;
}

/**
 * The item nearest (x, y) within `radius`, all in screen pixels, or null.
 * Venues sit 11-16 px apart on a phone, so a tap resolves to whichever is
 * closest rather than needing to land on a dot.
 */
export function nearestWithin<T extends ScreenPoint>(
  items: readonly T[],
  x: number,
  y: number,
  radius: number,
): T | null {
  let nearest: T | null = null;
  let nearestDist = radius;
  for (const item of items) {
    const dist = Math.hypot(item.x - x, item.y - y);
    if (dist <= nearestDist) {
      nearest = item;
      nearestDist = dist;
    }
  }
  return nearest;
}

export type TapAction = "open" | "swap" | "close" | "none";

/**
 * What a tap on the map does, given the venue whose card is open (if any) and
 * the venue the tap resolved to (if any). Tapping the open venue again, or
 * empty map, closes the card.
 */
export function tapAction(openId: string | null, hitId: string | null): TapAction {
  if (hitId === null) return openId === null ? "none" : "close";
  if (openId === null) return "open";
  return hitId === openId ? "close" : "swap";
}

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface DockInput {
  /** The map's box in viewport coordinates. */
  map: Rect;
  /** The card's untransformed layout size. */
  card: { width: number; height: number };
  viewport: { width: number; height: number };
  /** Viewport position of the venue that was tapped. */
  venueX: number;
  venueY: number;
  /** Bottom edge of fixed chrome at the top of the screen (the navbar). */
  topInset: number;
  /** Space between the map and a card docked above or below it. */
  gap: number;
  /** Minimum space between the card and the viewport edges. */
  margin: number;
}

export type DockSide = "below" | "above" | "bottom" | "top";

export interface Dock {
  side: DockSide;
  /** Scale that fits the card within the viewport's height; 1 when it fits. */
  scale: number;
  /** The card's on-screen box once docked, at that scale. */
  box: Rect;
  /**
   * Translate values for the card, which is fixed at 0,0 and scales about its
   * centre, that put it at `box`.
   */
  x: number;
  y: number;
}

// How far a pinned card must stay from the tapped venue so it doesn't hide it.
const VENUE_CLEARANCE = 16;

/**
 * Where a tapped card docks. It stays there until it closes, so swapping
 * venues never moves it.
 *
 * Below the map, centred on it, is first choice: the map stays in view and
 * the card reads as its caption. If that would run off the bottom of the
 * screen it goes above the map instead, clear of the navbar. When neither
 * fits (the map fills most of the screen: small phones, landscape) it pins to
 * the bottom of the screen, or to the top if that would cover the venue that
 * was tapped. If both would (a phone held sideways), it also moves to the side
 * of the screen away from the venue, leaving that half of the map tappable.
 * A card taller than the screen is scaled down to fit.
 */
export function dockCard({
  map,
  card,
  viewport,
  venueX,
  venueY,
  topInset,
  gap,
  margin,
}: DockInput): Dock {
  const scale = Math.min(
    1,
    (viewport.height - 2 * margin) / card.height,
    (viewport.width - 2 * margin) / card.width,
  );
  const width = card.width * scale;
  const height = card.height * scale;

  const leftmost = margin;
  const rightmost = viewport.width - margin - width;
  const centred = clamp(map.left + map.width / 2 - width / 2, leftmost, rightmost);
  const lowest = viewport.height - margin - height;
  const highest = Math.min(Math.max(topInset, margin), lowest);

  const place = (side: DockSide, top: number, left = centred): Dock => ({
    side,
    scale,
    box: { left, top, width, height },
    // Scaling about the centre moves the top-left corner in by half the
    // difference in size.
    x: left - (card.width - width) / 2,
    y: top - (card.height - height) / 2,
  });

  const below = map.top + map.height + gap;
  if (below >= highest && below <= lowest) return place("below", below);

  const above = map.top - gap - height;
  if (above >= highest && above <= lowest) return place("above", above);

  const covers = (top: number) =>
    venueY >= top - VENUE_CLEARANCE && venueY <= top + height + VENUE_CLEARANCE;
  if (!covers(lowest)) return place("bottom", lowest);
  if (!covers(highest)) return place("top", highest);
  // Covers the venue either way: take the end, and the side, whose middle is
  // further from it.
  const left =
    Math.abs(leftmost + width / 2 - venueX) >= Math.abs(rightmost + width / 2 - venueX)
      ? leftmost
      : rightmost;
  return Math.abs(lowest + height / 2 - venueY) >= Math.abs(highest + height / 2 - venueY)
    ? place("bottom", lowest, left)
    : place("top", highest, left);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}
