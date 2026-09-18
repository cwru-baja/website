"use client";

// The dash screen as a live surface over the cockpit still.
//
// Mount it inside the still's own box (the relative, 16:9 element the still
// fills). While `on`, it does two things:
//   - fades in the screen-off plate: the frame with the dash dark, but only where
//     the dash was lighting something (its bezel, the LED cover, the knob lenses,
//     a few reflections), so the light goes out with the screen;
//   - shows a canvas pinned to the screen with matrix3d, drawn by raster.ts so
//     what is on it tone-maps and softens like the render around it.
// The caller draws through the ref; nothing re-renders per frame.

import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { homography, project, scaleQuad, toMatrix3d, type Point, type Quad } from "./homography";
import { CANVAS, createRaster, TEXTURE, type Raster, type Rect } from "./raster";
import screen from "./screen.json";

export interface DashScreenHandle {
  /** Replace what's on the screen. Rects are in texture px (480x272). */
  draw(rects: readonly Rect[]): void;
  /** A viewport point in texture px - may fall outside 0..480 x 0..272. */
  toTexture(clientX: number, clientY: number): Point | null;
}

const FRAME = screen.frame;
const TEXTURE_CORNERS = screen.textureCorners as unknown as Quad;
const CANVAS_BOX: Quad = [[0, 0], [CANVAS.w, 0], [CANVAS.w, CANVAS.h], [0, CANVAS.h]];
const TEXTURE_BOX: Quad = [[0, 0], [TEXTURE.w, 0], [TEXTURE.w, TEXTURE.h], [0, TEXTURE.h]];
const FRAME_TO_TEXTURE = homography(TEXTURE_CORNERS, TEXTURE_BOX);
const pct = (v: number, of: number) => `${(v / of) * 100}%`;

/**
 * The dash going dark is quick, like a mode switch; coming back is a touch
 * slower. Anything else lit by the dash (the press sprites' screen-on and
 * screen-off crops) has to cross-fade on the same clock or it steps.
 */
export const SCREEN_FADE = { inMs: 110, outMs: 240 } as const;

// Shared across mounts: the LUT is 15 KB and never changes within a deploy.
let lutPromise: Promise<Uint8Array> | null = null;
const loadLut = () =>
  (lutPromise ??= fetch(screen.lut.url)
    .then((r) => {
      if (!r.ok) throw new Error(`dash LUT: ${r.status}`);
      return r.arrayBuffer();
    })
    .then((b) => new Uint8Array(b))
    .catch((e) => {
      lutPromise = null;
      throw e;
    }));

export default function DashScreen({
  on,
  ref,
  fadeInMs = SCREEN_FADE.inMs,
  fadeOutMs = SCREEN_FADE.outMs,
}: {
  on: boolean;
  ref?: Ref<DashScreenHandle>;
  fadeInMs?: number;
  fadeOutMs?: number;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const plateRef = useRef<HTMLImageElement>(null);
  const rasterRef = useRef<Raster | null>(null);
  const imageRef = useRef<ImageData | null>(null);
  const pendingRef = useRef<readonly Rect[] | null>(null);
  const [transform, setTransform] = useState<string | null>(null);

  // Only touches refs, so it's stable. Draws that arrive before the LUT has
  // loaded are held and painted when it lands.
  const paint = useCallback((rects: readonly Rect[]) => {
    const raster = rasterRef.current, image = imageRef.current, ctx = canvasRef.current?.getContext("2d");
    if (!raster || !image || !ctx) {
      pendingRef.current = rects;
      return;
    }
    pendingRef.current = null;
    raster.draw(rects);
    ctx.putImageData(image, 0, 0);
  }, []);

  // matrix3d from the canvas's own px onto where the texture lands, at this size.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const fit = () => {
      const s = box.clientWidth / FRAME.w;
      if (s > 0) setTransform(toMatrix3d(homography(CANVAS_BOX, scaleQuad(TEXTURE_CORNERS, s))));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let live = true;
    loadLut()
      .then((lut) => {
        if (!live) return;
        rasterRef.current = createRaster(lut);
        imageRef.current = new ImageData(rasterRef.current.pixels as ImageDataArray, CANVAS.w, CANVAS.h);
        if (pendingRef.current) paint(pendingRef.current);
      })
      .catch((e) => console.error(e));
    // Decode the plate up front: a hidden image decodes lazily and can paint
    // stale for a tick when it's revealed.
    plateRef.current?.decode().catch(() => {});
    return () => {
      live = false;
    };
  }, [paint]);

  useImperativeHandle(ref, () => ({
    draw: paint,
    toTexture(clientX, clientY) {
      const box = boxRef.current?.getBoundingClientRect();
      if (!box || box.width === 0) return null;
      const fx = ((clientX - box.left) / box.width) * FRAME.w;
      const fy = ((clientY - box.top) / box.height) * FRAME.h;
      return project(FRAME_TO_TEXTURE, fx, fy);
    },
  }));

  // Clear the glass when switched off, so the next start doesn't flash the last frame.
  useEffect(() => {
    if (!on) paint([]);
  }, [on, paint]);

  const fade = `opacity ${on ? fadeInMs : fadeOutMs}ms ease-out`;
  return (
    <div ref={boxRef} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={plateRef}
        src={screen.plate.url}
        alt=""
        decoding="sync"
        draggable={false}
        className="absolute select-none"
        style={{
          left: pct(screen.plate.x, FRAME.w),
          top: pct(screen.plate.y, FRAME.h),
          width: pct(screen.plate.w, FRAME.w),
          height: pct(screen.plate.h, FRAME.h),
          opacity: on ? 1 : 0,
          transition: fade,
        }}
      />
      <canvas
        ref={canvasRef}
        width={CANVAS.w}
        height={CANVAS.h}
        className="absolute top-0 left-0"
        style={{
          width: CANVAS.w,
          height: CANVAS.h,
          transformOrigin: "0 0",
          transform: transform ?? undefined,
          visibility: transform ? "visible" : "hidden",
          opacity: on ? 1 : 0,
          transition: fade,
        }}
      />
    </div>
  );
}
