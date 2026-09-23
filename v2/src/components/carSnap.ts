/**
 * Scrolling the car sequence moves it one stop at a time. A flick of the wheel
 * or a scroll key plays the camera all the way to the next still (or back to
 * the previous one), and the page waits there for the next gesture. A swipe
 * only brings the page in to the sequence's near end: on a touch screen the
 * previous and next buttons are the way through.
 * Everything here is the arithmetic behind that: where the stops are, which
 * wheel events belong to one gesture, and how the page travels between stops.
 * The wiring lives in CarSequence.
 */
import type { LabelWindow } from "./carSequenceModel";

/**
 * Speed and acceleration are in viewports of scroll, the timeline's own unit,
 * so the camera plays at the same pace on every screen:
 *   speed   cruising speed between stops, in viewports a second. The legs are
 *           rendered about 30 frames to the viewport, so 1.5 plays them at 45 fps.
 *   accel   how quickly the page gets up to speed and slows down again.
 *   quiet   seconds without a wheel event that end a gesture.
 *   dwell   seconds after the page lands in which the wheel still can't send it
 *           on the same way: the tail of the scroll that brought it there.
 *   turn    pixels a scroll has to go the other way to count as turning round,
 *           rather than the twitch of fingers lifting off a trackpad.
 *   falling events in a row a gesture has to slow down over before it counts
 *           as coasting - momentum, not fingers.
 *   rise    how many times faster than its slowest a coasting gesture has to
 *           get to be a new flick...
 *   flick   ...and how big, in pixels, that event has to be.
 *   swipe   pixels a finger travels before it counts as a swipe.
 *   yield   pixels something else can move the page mid-glide before the glide
 *           gives up, taking it to be the scrollbar or a jump.
 *   slack   pixels either side of a stop that count as being on it.
 *   settle  seconds Pong takes to settle the page onto the cockpit.
 *   launch  viewports a second a press of the previous or next button sets the
 *           page off at, rather than from a standstill: it starts at the
 *           still's edge (see leaveStill), and the scrub's own lag eases the
 *           camera into it.
 */
export const CAR_SNAP = {
  speed: 1.5,
  accel: 3,
  quiet: 0.2,
  dwell: 0.3,
  turn: 12,
  falling: 4,
  rise: 3,
  flick: 6,
  swipe: 10,
  yield: 40,
  slack: 2,
  settle: 0.4,
  launch: 1.5,
} as const;

export type Direction = 1 | -1;

/**
 * Where the sequence comes to rest, as times on its timeline: its first frame,
 * the middle of each pause's still, and its last frame. The middle, because the
 * scrub's lag has the camera arrive a moment after the page does, and a stop at
 * either edge of a still could leave it just outside.
 */
export const snapStops = (pauses: LabelWindow[], duration: number): number[] => {
  const times = [
    0,
    ...pauses.map(({ from, to }) => (to > from ? (from + to) / 2 : from)),
    duration,
  ]
    .filter((time) => time >= 0 && time <= duration)
    .sort((left, right) => left - right);
  return times.filter((time, index) => index === 0 || time - times[index - 1] > 1e-6);
};

/** The first stop past `position` going `direction`, or null past the last. */
export const nextStop = (
  stops: number[],
  position: number,
  direction: Direction,
  slack: number = CAR_SNAP.slack,
): number | null => {
  if (direction > 0) return stops.find((stop) => stop > position + slack) ?? null;
  for (let index = stops.length - 1; index >= 0; index -= 1) {
    if (stops[index] < position - slack) return stops[index];
  }
  return null;
};

/**
 * Where a press of the previous or next button sets the page off from. A stop
 * is the middle of a still - a stretch where the car holds and its labels are
 * up (`stills`, in scroll pixels) - so from rest the page has half of it to
 * cover before anything on screen changes, and a press would sit dead for
 * half a second. Nothing on that stretch moves, so the page can start from the
 * still's edge the way it is going instead: the labels leave at once and the
 * camera follows. Null when the page is not inside a still.
 */
export const leaveStill = (
  stills: LabelWindow[],
  position: number,
  direction: Direction,
): number | null => {
  const still = stills.find(({ from, to }) => position > from && position < to);
  if (!still) return null;
  return direction > 0 ? still.to : still.from;
};

/**
 * Where a gesture takes the page, or null to leave it to the browser. `stops`
 * are scroll positions, the first and last being the sequence's two ends. From
 * inside the sequence it is the next stop that way; past the last one the page
 * scrolls on out. From outside, it is the near end - but only if this move
 * (`travel` pixels) would carry the page into the sequence, so the page above
 * and below it scrolls as it always has.
 */
export const snapTarget = (
  stops: number[],
  position: number,
  direction: Direction,
  travel: number,
): number | null => {
  const first = stops[0];
  const last = stops[stops.length - 1];
  if (first === undefined || last === undefined) return null;
  if (position < first - CAR_SNAP.slack) {
    return direction > 0 && position + travel > first ? first : null;
  }
  if (position > last + CAR_SNAP.slack) {
    return direction < 0 && position - travel < last ? last : null;
  }
  return nextStop(stops, position, direction);
};

/**
 * Where a page left coasting inside the sequence - a phone's fling, which
 * carries on after the finger has lifted and so can't be caught - finishes:
 * back on the end it came in by. On a touch screen a swipe never moves the page
 * through the sequence (the previous and next buttons do), so a fling in from
 * the page above or below docks where it entered however far it flew. Null if
 * it stopped on a stop, or outside the sequence.
 */
export const settleTarget = (
  stops: number[],
  position: number,
  direction: Direction,
): number | null => {
  const first = stops[0];
  const last = stops[stops.length - 1];
  if (first === undefined || last === undefined) return null;
  if (position < first || position > last) return null;
  if (stops.some((stop) => Math.abs(stop - position) <= CAR_SNAP.slack)) return null;
  return direction > 0 ? first : last;
};

/** A wheel event's vertical travel in pixels, whatever unit it came in. */
export const wheelPixels = (deltaY: number, deltaMode: number, page: number) =>
  deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * page : deltaY;

/**
 * How far a key scrolls the page, signed, or 0 for one the snap leaves alone.
 * Home and End are jumps to the top and bottom of the page, not scrolls.
 */
export const keyTravel = (key: string, shift: boolean, page: number): number => {
  switch (key) {
    case "ArrowDown":
      return 40;
    case "ArrowUp":
      return -40;
    case "PageDown":
      return page * 0.875;
    case "PageUp":
      return -page * 0.875;
    case " ":
      return shift ? -page * 0.875 : page * 0.875;
    default:
      return 0;
  }
};

/**
 * One gesture's worth of wheel events. A trackpad keeps sending events after
 * the fingers lift - its momentum - and browsers give no way to tell those from
 * the fingers themselves, so a gesture is read from the shape of its events:
 * uneven while the fingers are on the pad, then a steady slowing as it coasts.
 * `used` is whether it has already moved the page; a gesture only moves it once.
 */
export interface WheelGesture {
  direction: Direction;
  /** Seconds, on the events' own clock. */
  at: number;
  /** The last few events, as [seconds, pixels], that `speed` is measured over. */
  recent: [number, number][];
  /** Pixels a second over `recent`, so no one event's timing throws it. */
  speed: number;
  /** How many events in a row it has been slowing down. */
  falling: number;
  /**
   * Its slowest speed since it settled into coasting, while a new flick could
   * count; Infinity otherwise.
   */
  low: number;
  /** Pixels it has gone the other way since it last went its own way. */
  against: number;
  used: boolean;
}

/**
 * The gesture a wheel event belongs to: the one under way, or a new one. It is
 * new after a pause of `quiet`, once it has gone `turn` pixels the other way,
 * or - if `flicks` - when a gesture that has settled into coasting suddenly
 * speeds up again: someone flicking while the last flick is still arriving.
 * It has to be coasting since `flicks` came on, because fingers on the pad
 * speed up and slow down all through one swipe; and speed is measured over a
 * few events, so neither uneven timing nor events the browser has merged read
 * as a burst.
 */
export const wheelGesture = (
  current: WheelGesture | null,
  pixels: number,
  at: number,
  flicks = true,
): WheelGesture => {
  const direction: Direction = pixels > 0 ? 1 : -1;
  const size = Math.abs(pixels);
  const fresh = (): WheelGesture => ({
    direction,
    at,
    recent: [[at, size]],
    speed: size * 60,
    falling: 0,
    low: Infinity,
    against: 0,
    used: false,
  });
  if (!current || at - current.at > CAR_SNAP.quiet) return fresh();
  if (direction !== current.direction) {
    const against = current.against + size;
    return against >= CAR_SNAP.turn ? fresh() : { ...current, at, against };
  }
  const recent = [...current.recent, [at, size] as [number, number]].slice(-4);
  const span = Math.max(at - recent[0][0], (recent.length - 1) / 120);
  const speed = recent.slice(1).reduce((sum, [, pixels]) => sum + pixels, 0) / span;
  if (flicks && speed >= current.low * CAR_SNAP.rise && size >= CAR_SNAP.flick) {
    return fresh();
  }
  const falling = speed <= current.speed * 1.1 ? current.falling + 1 : 0;
  const coasting = current.low < Infinity || falling >= CAR_SNAP.falling;
  return {
    ...current,
    at,
    recent,
    speed,
    falling,
    low: flicks && coasting ? Math.min(current.low, speed) : Infinity,
    against: 0,
  };
};

/** The page, as far as reading the wheel goes. Seconds on the events' clock. */
export interface WheelPage {
  /** Which way the page is gliding, or null when it is still. */
  moving: Direction | null;
  /** Which way it last went, and when it came to rest. */
  moved: Direction | null;
  restedAt: number;
}

/**
 * Whether a wheel event asks the page to move a stop, and the gesture it
 * belongs to. A gesture asks once, however long its momentum lasts. While the
 * page is moving, and for `dwell` after it lands, a new gesture the same way is
 * swallowed whole: from here momentum and a second flick look alike, and one
 * scroll must never carry the page past a stop. Turning round is never
 * momentum, so that always counts.
 */
export const readWheel = (
  current: WheelGesture | null,
  pixels: number,
  at: number,
  page: WheelPage,
): { gesture: WheelGesture; move: boolean } => {
  const busy = page.moving !== null || at - page.restedAt < CAR_SNAP.dwell;
  const gesture = wheelGesture(current, pixels, at, !busy);
  if (gesture.used) return { gesture, move: false };
  if (busy && gesture.direction === (page.moving ?? page.moved)) {
    return { gesture: { ...gesture, used: true }, move: false };
  }
  return { gesture, move: true };
};

/** The page on its way to a stop: where it is, and how fast it is going. */
export interface Glide {
  position: number;
  velocity: number;
}

/**
 * One tick of the page travelling to `target`, in pixels and seconds. It speeds
 * up at `accel` to `speed` and brakes at the same rate so that it stops exactly
 * on the stop. Velocity carries over when the target changes, so a second
 * gesture mid-glide sends it on without a stutter, and turning round slows it
 * down first rather than snapping into reverse.
 */
export const glideStep = (
  glide: Glide,
  target: number,
  seconds: number,
  page: number,
): Glide & { done: boolean } => {
  const remaining = target - glide.position;
  if (Math.abs(remaining) < 0.5) return { position: target, velocity: 0, done: true };
  const toward = remaining > 0 ? 1 : -1;
  const accel = CAR_SNAP.accel * page;
  const brake = Math.sqrt(2 * accel * Math.abs(remaining));
  let speed = glide.velocity * toward;
  speed = Math.min(speed + accel * seconds, CAR_SNAP.speed * page, brake);
  const position = glide.position + toward * speed * seconds;
  if ((target - position) * toward <= 0) return { position: target, velocity: 0, done: true };
  return { position, velocity: toward * speed, done: false };
};
