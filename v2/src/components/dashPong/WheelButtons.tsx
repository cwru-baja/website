"use client";

// The eight blue buttons on the wheel in the cockpit still, pressable.
//
// A press is rendered, not styled: each dome was re-rendered in Cycles moved
// 0.5 to 2.5 mm down its own axis, from the still's camera
// (artifacts/render-dash-screen.py), and the crops are swapped in on the press
// clock below. At this framing the dome's travel is along the view axis, so
// what reads is the collar's bore shadowing its rim, not movement.
//
// Only the blue is clickable: each button is an ellipse measured off its rest
// crop (IoU 0.98-0.99 against the blue pixels), not the crop's square.
//
// Mount inside the still's 16:9 box. `dark` swaps to the crops rendered with the
// dash screen off, on the screen's own fade, so none of them carries the dash's
// light after it has gone out.

import { useCallback, useEffect, useRef, useState } from "react";
import { SCREEN_FADE } from "./DashScreen";
import sprites from "./sprites.json";

const DIR = "/renders-sr26/press/";
const { frame: FRAME, sprite: SPRITE, travel: TRAVEL, buttons: BUTTONS } = sprites;
const FILES = sprites.files as Record<string, string>;
const FILES_OFF = sprites.filesOff as Record<string, string>;

/** How far a press goes. The real switch travels ~1.5 mm; 2.5 reads better at ~34 CSS px. */
const DEPTH = 2.5;

// A press is two motions, not one: a smooth roll as the wall loads, then a snap
// (16-32 ms of travel at 240 fps, a sub-25 ms snap), a hold long enough to be
// seen, and a release that doesn't retrace the press. Keyframes are [ms, mm].
const PRESS: [number, number][] = [[0, 0], [16, 0.5], [30, DEPTH]];
const RELEASE: [number, number][] = [[0, DEPTH], [70, 1.0], [140, 0.5], [200, 0]];
const PRESS_MS = 30;
const RELEASE_MS = 200;
const MIN_HOLD = 90;

function sample(keys: [number, number][], t: number) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i];
    if (t <= t1) {
      const [t0, v0] = keys[i - 1];
      return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
    }
  }
  return keys[keys.length - 1][1];
}
const nearest = (mm: number) => TRAVEL.reduce((best, t) => (Math.abs(t - mm) < Math.abs(best - mm) ? t : best), TRAVEL[0]);
const tag = (i: number, mm: number) => `b${i}-t${String(Math.round(mm * 10)).padStart(3, "0")}`;
const pct = (v: number, of: number) => `${(v / of) * 100}%`;

/**
 * Only the dome is ever swapped in. A 2.5 mm press changes nothing more than
 * 4/255 beyond ~26 frame px from the dome's centre; past that, what differs from
 * the still is noise - Cycles resamples the whole crop when anything in it moves,
 * and the lower crops differ out to their corners - plus the still's own WebP
 * artifacts, which the lossless crops don't have. So each crop is cut to a disc
 * opaque to 30 px and gone by 40, and is not shown at all at rest.
 */
const DISC_IN = 30, DISC_OUT = 40;
const discMask = (b: (typeof BUTTONS)[number]) => {
  const cx = b.cx - b.x0, cy = b.cy - b.y0;
  const reach = Math.min(cx, cy, SPRITE - cx, SPRITE - cy); // what closest-side measures
  return `radial-gradient(circle closest-side at ${pct(cx, SPRITE)} ${pct(cy, SPRITE)}, #000 ${pct(DISC_IN, reach)}, transparent ${pct(DISC_OUT, reach)})`;
};

let preloaded = false;
/** Decode every crop once, so a press never waits on one. ~900 KB, fetched on first show. */
function preload() {
  if (preloaded) return;
  preloaded = true;
  for (const files of [FILES, FILES_OFF]) {
    for (const file of Object.values(files)) {
      const img = new Image();
      img.src = DIR + file;
      img.decode().catch(() => {});
    }
  }
}

export default function WheelButtons({
  dark,
  onPress,
}: {
  dark: boolean;
  /** A button was pressed and let go - it acts on release, as it springs back. */
  onPress: (button: number) => void;
}) {
  const [active, setActive] = useState(0);
  const [mm, setMm] = useState(0);
  const anim = useRef<{ phase: "down" | "up"; t0: number } | null>(null);
  const raf = useRef(0);
  const onPressRef = useRef(onPress);

  useEffect(() => {
    onPressRef.current = onPress;
  }, [onPress]);
  useEffect(() => {
    preload();
    return () => cancelAnimationFrame(raf.current);
  }, []);

  const run = useCallback(() => {
    cancelAnimationFrame(raf.current);
    const step = () => {
      const a = anim.current;
      if (!a) return;
      const t = performance.now() - a.t0;
      if (a.phase === "down") setMm(sample(PRESS, t));
      else if (t < 0) setMm(DEPTH);
      else if (t >= RELEASE_MS) {
        setMm(0);
        anim.current = null;
        return;
      } else setMm(sample(RELEASE, t));
      raf.current = requestAnimationFrame(step);
    };
    step();
  }, []);

  const press = useCallback(
    (i: number) => {
      setActive(i);
      anim.current = { phase: "down", t0: performance.now() };
      run();
    },
    [run],
  );

  const release = useCallback(
    (i: number) => {
      const a = anim.current;
      if (!a || a.phase === "up") return;
      // Even a flick of a click holds long enough to be seen as a press.
      anim.current = { phase: "up", t0: Math.max(performance.now(), a.t0 + PRESS_MS + MIN_HOLD) };
      onPressRef.current(i);
    },
    [],
  );

  return (
    <>
      {BUTTONS.map((b) => {
        const pressed = b.i === active && mm > 0;
        const t = tag(b.i, nearest(pressed ? mm : 0));
        const mask = discMask(b);
        return (
          <div key={b.i}>
            {/* The dome's crop, cut to a disc and only while pressed; never hit. */}
            <div
              aria-hidden
              className="pointer-events-none absolute"
              style={{
                left: pct(b.x0, FRAME.w),
                top: pct(b.y0, FRAME.h),
                width: pct(SPRITE, FRAME.w),
                height: pct(SPRITE, FRAME.h),
                opacity: pressed ? 1 : 0,
                maskImage: mask,
                WebkitMaskImage: mask,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={DIR + FILES[t]} alt="" decoding="sync" draggable={false} className="absolute inset-0 h-full w-full select-none" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={DIR + FILES_OFF[t]}
                alt=""
                decoding="sync"
                draggable={false}
                className="absolute inset-0 h-full w-full select-none"
                style={{ opacity: dark ? 1 : 0, transition: `opacity ${dark ? SCREEN_FADE.inMs : SCREEN_FADE.outMs}ms ease-out` }}
              />
            </div>
            <button
              type="button"
              aria-label={`Wheel button ${b.i + 1}: ${dark ? "stop" : "play"} Pong on the dash`}
              onPointerDown={(e) => {
                press(b.i);
                // Captured, so a pointer drifting off a ~34 px target mid-press
                // doesn't let go early. Throws only for a pointer that isn't live.
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {}
              }}
              onPointerUp={() => release(b.i)}
              onPointerCancel={() => release(b.i)}
              onLostPointerCapture={() => release(b.i)}
              // A click shouldn't leave focus here, or the game's first W/S lights a
              // focus ring round the button. Tab still reaches it.
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                // Enter/Space arrive as a click with no pointer behind it.
                if (e.detail !== 0) return;
                press(b.i);
                window.setTimeout(() => release(b.i), 130);
              }}
              className="absolute cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              style={{
                // The layers above the still are pointer-events: none so they never
                // block the page; a button has to opt back in.
                pointerEvents: "auto",
                // 50%, not rounded-full: 9999px on a non-square box is a pill, not an ellipse.
                borderRadius: "50%",
                left: pct(b.hit.cx - b.hit.rx, FRAME.w),
                top: pct(b.hit.cy - b.hit.ry, FRAME.h),
                width: pct(2 * b.hit.rx, FRAME.w),
                height: pct(2 * b.hit.ry, FRAME.h),
              }}
            />
          </div>
        );
      })}
    </>
  );
}
