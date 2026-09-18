export type HeadshotFraming = {
  zoom: number;
  x: number;
  y: number;
};

export const DEFAULT_FRAMING: HeadshotFraming = { zoom: 1, x: 0, y: 0 };

export const ZOOM_RANGE = { min: 1, max: 3, step: 0.01 } as const;

/** Width of the round photo frame in CSS pixels (`h-44 w-44`). */
export const FRAME_SIZE = 176;

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return ZOOM_RANGE.min;
  return Math.min(ZOOM_RANGE.max, Math.max(ZOOM_RANGE.min, zoom));
}

// The frame is square and `object-cover` crops any other shape to its centre
// square, so there is nothing to slide around at zoom 1. Room to pan only
// appears once the photo is scaled past the frame, and it is split evenly
// between the two opposite edges.
export function panLimit(zoom: number): number {
  return ((clampZoom(zoom) - 1) / 2) * 100;
}

export function clampFraming(framing: HeadshotFraming): HeadshotFraming {
  const zoom = clampZoom(framing.zoom);
  const limit = panLimit(zoom);
  const clamp = (value: number) => {
    if (!Number.isFinite(value)) return 0;
    const bounded = Math.min(limit, Math.max(-limit, value));
    // Normalise -0, which would otherwise be copied out as "-0".
    return bounded === 0 ? 0 : bounded;
  };

  return { zoom, x: clamp(framing.x), y: clamp(framing.y) };
}

export function resolveFraming(
  framing?: Partial<HeadshotFraming>,
): HeadshotFraming {
  return clampFraming({ ...DEFAULT_FRAMING, ...framing });
}

// Scale is applied before the translation, so the percentages stay relative to
// the frame rather than the enlarged photo: one step nudges by the same number
// of on-screen pixels whatever the zoom.
export function framingTransform(framing: Partial<HeadshotFraming>): string {
  const { zoom, x, y } = resolveFraming(framing);
  return `translate(${x}%, ${y}%) scale(${zoom})`;
}

// Zooming crops into the file, so the browser needs proportionally more source
// pixels to keep the visible part sharp. Without this the circle goes soft as
// soon as the framing pushes in.
//
// `sizes` describes the width the image is drawn at, and the browser picks from
// srcset with no knowledge of object-fit. A non-square file is scaled until its
// short side fills the frame, so its long side is drawn wider than the frame by
// the aspect ratio - leave that out and a 3:2 photo is fetched a third too small.
export function framedSizes(
  framing?: Partial<HeadshotFraming>,
  aspectRatio = 1,
): string {
  const overflow = Math.max(aspectRatio, 1 / aspectRatio);
  return `${Math.ceil(FRAME_SIZE * overflow * resolveFraming(framing).zoom)}px`;
}

export function isDefaultFraming(framing: Partial<HeadshotFraming>): boolean {
  const { zoom, x, y } = resolveFraming(framing);
  return zoom === DEFAULT_FRAMING.zoom && x === 0 && y === 0;
}

export function roundFraming(framing: HeadshotFraming): HeadshotFraming {
  return {
    zoom: Number(framing.zoom.toFixed(3)),
    x: Number(framing.x.toFixed(2)),
    y: Number(framing.y.toFixed(2)),
  };
}

/** Convert a pointer drag in CSS pixels into frame-relative percentages. */
export function dragToPan(deltaPx: number): number {
  return (deltaPx / FRAME_SIZE) * 100;
}
