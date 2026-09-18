"use client";

// PROTOTYPE — throwaway. See page.tsx for what this compares.
//
// One press clock drives both treatments, so the magnifier shows them at the
// same instant of the same press. Keys: 1-8 press a button, S/R pick the
// treatment for the main view, [ ] change the pressed depth - all off while a
// game is running, when W/S and the arrows belong to Pong.
//
// Releasing any blue button starts Pong on the dash; releasing one again, or Esc,
// ends it.

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import DashPong from "@/components/dashPong/DashPong";
import { SCREEN_FADE } from "@/components/dashPong/DashScreen";
import sprites from "@/components/dashPong/sprites.json";

const STILL = "/renders-sr26/layers/cockpit-dive-0040.webp";
const PRESS_DIR = "/renders-sr26/press/";
const { frame: FRAME, sprite: SPRITE, travel: TRAVEL, buttons: BUTTONS } = sprites;
const FILES = sprites.files as Record<string, string>;
/** The same crops rendered with the dash dark - what shows while the game runs. */
const FILES_OFF = sprites.filesOff as Record<string, string>;

/** Dome diameter in frame px — projected from the .blend (2 x 23.3px), not eyeballed. */
const DOME = 47;

// ---- Calibration -----------------------------------------------------------
// Sampled off the rendered ladder, averaged over three buttons: ring luminance
// relative to the rest frame, split by where on the rim it sits. The stylised
// treatment is fitted to these rather than guessed.
//
// Two things fall out that you would not get right by eye:
//
//   1. The dome's CENTRE never changes (1.000 -> 1.020). A global brightness
//      filter is the wrong model; the whole effect lives in the outer ~35% of
//      the disc, where the collar's bore starts to overhang the rim.
//   2. The effect is DIRECTIONAL, not a vignette. The top darkens hard (to 0.40)
//      while the bottom BRIGHTENS (to ~1.12) — the collar's lower inner wall
//      catches light and bounces it back up onto the dome. A symmetric rim
//      shadow darkens exactly where the render lifts.
const CALIBRATION: { mm: number; top: number; side: number; bottom: number; scale: number }[] = [
  { mm: 0, top: 1.0, side: 1.0, bottom: 1.0, scale: 1.0 },
  { mm: 0.5, top: 0.973, side: 0.995, bottom: 1.047, scale: 0.9972 },
  { mm: 1.0, top: 0.848, side: 0.947, bottom: 1.096, scale: 0.9944 },
  { mm: 1.5, top: 0.663, side: 0.838, bottom: 1.122, scale: 0.9916 },
  { mm: 2.5, top: 0.403, side: 0.601, bottom: 1.097, scale: 0.986 },
];

/** Luminance at the bottom of the rim in the rest frame — sets how much white a lift needs. */
const REST_RIM = 0.24;

// ---- Timing ----------------------------------------------------------------
// A press is two motions, not one: a smooth roll as the wall loads, then a snap.
// Easing uniformly from rest to pressed is what makes button animations read as
// a scaling sprite. Measured references: 16-32ms of physical travel at 240fps,
// a sub-25ms snap, ~116ms dwell for typing (~219ms for a deliberate tap), and a
// release that does not retrace the press curve.
const pressKeys = (depth: number): [number, number][] => [
  [0, 0],
  [16, 0.5],
  [30, depth],
];
const releaseKeys = (depth: number): [number, number][] => [
  [0, depth],
  [70, 1.0],
  [140, 0.5],
  [200, 0],
];
const PRESS_MS = 30;
const RELEASE_MS = 200;
const MIN_HOLD = 90;

function sample(keys: [number, number][], t: number): number {
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

function interp(mm: number) {
  if (mm <= 0) return CALIBRATION[0];
  for (let i = 1; i < CALIBRATION.length; i++) {
    const b = CALIBRATION[i];
    if (mm <= b.mm) {
      const a = CALIBRATION[i - 1];
      const f = (mm - a.mm) / (b.mm - a.mm);
      const mix = (k: keyof typeof a) => a[k] + (b[k] - a[k]) * f;
      return { mm, top: mix("top"), side: mix("side"), bottom: mix("bottom"), scale: mix("scale") };
    }
  }
  return CALIBRATION[CALIBRATION.length - 1];
}

/** Black over the dome at alpha (1-f) multiplies its luminance by exactly f. */
const shade = (f: number, gain: number) => Math.min(0.95, Math.max(0, (1 - f) * gain));
/** White needed to lift a rim sitting at REST_RIM up to f x its resting luminance. */
const lift = (f: number, gain: number) =>
  Math.min(0.6, Math.max(0, ((REST_RIM * (f - 1)) / (1 - REST_RIM)) * gain));

/** Sprites are discrete, so the rendered treatment snaps to the nearest step. */
function nearestTravel(mm: number): number {
  let best = TRAVEL[0];
  for (const t of TRAVEL) if (Math.abs(t - mm) < Math.abs(best - mm)) best = t;
  return best;
}
const tag = (i: number, mm: number) => `b${i}-t${String(Math.round(mm * 10)).padStart(3, "0")}`;

type Button = (typeof BUTTONS)[number];
type Treatment = "stylised" | "rendered";
type Styling = { ring: number; bounce: number; shrink: number };

/**
 * Confines the rim treatment to the outer third of the disc.
 *
 * `closest-side` is load-bearing: a radial-gradient sizes itself to the farthest
 * CORNER by default, so in a square box 100% lands at r x sqrt(2). The stops
 * would then be measured against 1.41r and the mask would only reach ~52% alpha
 * at the dome's edge — half the calibrated strength, for no visible reason.
 */
const RING_MASK = "radial-gradient(circle closest-side at 50% 50%, transparent 62%, #000 86%, #000 100%)";

// Background maths: show the still at container scale inside a box that is only
// `size` frame-px wide, so the right crop lands in the box at any display size.
function crop(size: number, x: number, y: number): CSSProperties {
  return {
    backgroundImage: `url("${STILL}")`,
    backgroundRepeat: "no-repeat",
    backgroundSize: `${(FRAME.w / size) * 100}% ${(FRAME.h / size) * 100}%`,
    backgroundPosition: `${(x / (FRAME.w - size)) * 100}% ${(y / (FRAME.h - size)) * 100}%`,
  };
}

function Dome({
  b,
  mm,
  treatment,
  styling,
  dark = false,
}: {
  b: Button;
  mm: number;
  treatment: Treatment;
  styling: Styling;
  dark?: boolean;
}) {
  if (treatment === "rendered") {
    const t = tag(b.i, nearestTravel(mm));
    // Both lightings stacked, cross-faded on the screen's own fade, so the crops
    // nearest the dash never show its light after it has gone out.
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={PRESS_DIR + FILES[t]}
          alt=""
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full select-none"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={PRESS_DIR + FILES_OFF[t]}
          alt=""
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full select-none"
          style={{
            opacity: dark ? 1 : 0,
            transition: `opacity ${dark ? SCREEN_FADE.inMs : SCREEN_FADE.outMs}ms ease-out`,
          }}
        />
      </>
    );
  }
  const cal = interp(mm);
  const scale = 1 - (1 - cal.scale) * styling.shrink;
  const dTop = shade(cal.top, styling.ring);
  const dSide = shade(cal.side, styling.ring);
  const bounce = lift(cal.bottom, styling.bounce);
  return (
    <div className="pointer-events-none absolute inset-0">
      {/* the still's own pixels for this crop, so the component stands alone in the magnifier */}
      <div className="absolute inset-0" style={crop(SPRITE, b.x0, b.y0)} />
      <div
        className="absolute rounded-full"
        style={{
          left: "50%",
          top: "50%",
          width: `${(DOME / SPRITE) * 100}%`,
          height: `${(DOME / SPRITE) * 100}%`,
          transform: `translate(-50%, -50%) scale(${scale})`,
          ...crop(DOME, b.cx - DOME / 2, b.cy - DOME / 2),
        }}
      >
        {/* The collar's bore overhanging the rim: shadow down the top, bounce up
            the bottom. Masked to the outer third so the dome's centre is left
            alone, which is what the render does. */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: [
              `linear-gradient(to bottom, transparent 58%, rgba(255,255,255,${bounce.toFixed(3)}) 100%)`,
              `linear-gradient(to bottom, rgba(0,0,0,${dTop.toFixed(3)}) 0%, rgba(0,0,0,${dSide.toFixed(3)}) 52%, rgba(0,0,0,0) 90%)`,
            ].join(", "),
            maskImage: RING_MASK,
            WebkitMaskImage: RING_MASK,
          }}
        />
      </div>
    </div>
  );
}

const PANEL = "rounded-lg border border-white/15 bg-black/70 backdrop-blur";
const LABEL = "text-[10px] uppercase tracking-[0.08em] text-white/50";

export default function ButtonLab() {
  // Rendered at 2.5mm is the pick (2026-09-17). Stylised stays switchable for reference.
  const [treatment, setTreatment] = useState<Treatment>("rendered");
  const [depth, setDepth] = useState(2.5);
  // Gain 1.0 = matches the rendered ladder. Push past 1 to exaggerate.
  const [styling, setStyling] = useState<Styling>({ ring: 1, bounce: 1, shrink: 1 });
  const [zoom, setZoom] = useState(2);
  const [active, setActive] = useState(0);
  const [mm, setMm] = useState(0);
  const [playing, setPlaying] = useState(false);

  const anim = useRef<{ btn: number; depth: number; phase: "down" | "up"; t0: number } | null>(null);
  const raf = useRef(0);

  const start = useCallback(() => {
    cancelAnimationFrame(raf.current);
    const step = () => {
      const a = anim.current;
      if (!a) return;
      const t = performance.now() - a.t0;
      if (a.phase === "down") {
        setMm(sample(pressKeys(a.depth), t));
      } else if (t < 0) {
        setMm(a.depth);
      } else if (t >= RELEASE_MS) {
        setMm(0);
        anim.current = null;
        return;
      } else {
        setMm(sample(releaseKeys(a.depth), t));
      }
      raf.current = requestAnimationFrame(step);
    };
    step();
  }, []);

  const press = useCallback(
    (i: number) => {
      setActive(i);
      anim.current = { btn: i, depth, phase: "down", t0: performance.now() };
      start();
    },
    [depth, start],
  );

  const release = useCallback(() => {
    const a = anim.current;
    if (!a || a.phase === "up") return;
    // Even a flick of a click holds long enough to be seen as a press.
    anim.current = { ...a, phase: "up", t0: Math.max(performance.now(), a.t0 + PRESS_MS + MIN_HOLD) };
    // The button acts on release, as it springs back.
    setPlaying((p) => !p);
  }, []);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "SELECT" || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey || playing) return;
      if (e.key >= "1" && e.key <= "8") {
        const i = Number(e.key) - 1;
        press(i);
        window.setTimeout(release, 130);
      } else if (e.key === "s") setTreatment("stylised");
      else if (e.key === "r") setTreatment("rendered");
      else if (e.key === "[") setDepth((d) => TRAVEL[Math.max(1, TRAVEL.indexOf(d) - 1)]);
      else if (e.key === "]") setDepth((d) => TRAVEL[Math.min(TRAVEL.length - 1, TRAVEL.indexOf(d) + 1)]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press, release, playing]);

  const liveMm = (i: number) => (i === active ? mm : 0);
  const b = BUTTONS[active];

  return (
    <main className="flex min-h-svh flex-col items-center bg-[#0a0a0a] text-white">
      {/* ---- controls ---- */}
      <div className={`sticky top-0 z-50 m-3 flex flex-wrap items-center gap-4 px-4 py-2 ${PANEL}`}>
        <span className="text-xs font-medium">Button press</span>
        <div className="flex gap-1">
          {(["stylised", "rendered"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTreatment(t)}
              className={`rounded px-2 py-1 text-[11px] capitalize ${treatment === t ? "bg-white text-black" : "bg-white/10 text-white/70"}`}
            >
              {t}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2">
          <span className={LABEL}>depth</span>
          <select
            value={depth}
            onChange={(e) => setDepth(Number(e.target.value))}
            className="rounded bg-white/10 px-1 py-1 text-[11px]"
          >
            {TRAVEL.filter((t) => t > 0).map((t) => (
              <option key={t} value={t}>
                {t.toFixed(1)} mm{t === 1.5 ? " (real)" : ""}
              </option>
            ))}
          </select>
        </label>
        {treatment === "stylised" && (
          <>
            {(
              [
                ["ring", "ring", 0, 2.5],
                ["bounce", "bounce", 0, 4],
                ["shrink", "shrink", 0, 8],
              ] as const
            ).map(([key, label, min, max]) => (
              <label key={key} className="flex items-center gap-2">
                <span className={LABEL}>{label}</span>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={0.05}
                  value={styling[key]}
                  onChange={(e) => setStyling((s) => ({ ...s, [key]: Number(e.target.value) }))}
                  className="w-20"
                />
                <span className="w-7 text-[10px] tabular-nums text-white/50">{styling[key].toFixed(2)}</span>
              </label>
            ))}
          </>
        )}
        <span className="text-[10px] text-white/35">1-8 press · S/R treatment · [ ] depth</span>
      </div>

      {/* ---- the still, with all eight buttons live ---- */}
      <div className="relative inline-block max-w-full leading-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={STILL} alt="" draggable={false} className="block max-h-[calc(100svh-7rem)] max-w-[100vw]" />
        <DashPong playing={playing} onEnd={() => setPlaying(false)} />
        {BUTTONS.map((btn) => (
          <div key={btn.i}>
            {/* The sprite is the whole 108px crop (it carries the collar's shading),
                so it draws but never takes the pointer. */}
            <div
              className="pointer-events-none absolute"
              style={{
                left: `${(btn.x0 / FRAME.w) * 100}%`,
                top: `${(btn.y0 / FRAME.h) * 100}%`,
                width: `${(SPRITE / FRAME.w) * 100}%`,
                height: `${(SPRITE / FRAME.h) * 100}%`,
              }}
            >
              <Dome b={btn} mm={liveMm(btn.i)} treatment={treatment} styling={styling} dark={playing} />
            </div>
            {/* Only the blue dome is clickable: an ellipse measured off the rest
                sprite by the exporter. border-radius clips hit-testing as well as
                paint, so the corners of this box don't take clicks. */}
            <button
              aria-label={`Press dash button ${btn.i + 1}`}
              onPointerDown={(e) => {
                press(btn.i);
                // Captured, so a pointer that drifts off a ~34px target mid-press
                // doesn't release it early — it releases on pointerup, like a real
                // switch. Throws only for a pointer that isn't live (synthetic
                // events), which must not cost the press itself.
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {}
              }}
              onPointerUp={release}
              onPointerCancel={release}
              onLostPointerCapture={release}
              // A click shouldn't leave focus here: the first W/S of the game would
              // then light a focus ring round the button for the rest of it. Tab
              // still reaches it, and a keyboard player should see the ring.
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                // Enter/Space arrive as a click with no pointer behind it.
                if (e.detail !== 0) return;
                press(btn.i);
                window.setTimeout(release, 130);
              }}
              className="absolute cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              style={{
                // 50%, not rounded-full: 9999px on a non-square box is a pill, not an ellipse.
                borderRadius: "50%",
                left: `${((btn.hit.cx - btn.hit.rx) / FRAME.w) * 100}%`,
                top: `${((btn.hit.cy - btn.hit.ry) / FRAME.h) * 100}%`,
                width: `${((2 * btn.hit.rx) / FRAME.w) * 100}%`,
                height: `${((2 * btn.hit.ry) / FRAME.h) * 100}%`,
              }}
            />
          </div>
        ))}
      </div>

      <p
        className="mt-2 text-[11px] tracking-[0.08em] text-white/55 uppercase"
        style={{ visibility: playing ? "visible" : "hidden" }}
      >
        W / S or mouse &middot; &uarr; &darr; player two &middot; Esc to leave
      </p>

      {/* ---- side-by-side at the same instant of the same press ---- */}
      <div className={`fixed right-3 bottom-3 z-50 flex items-end gap-4 px-4 py-3 ${PANEL}`}>
        {(["stylised", "rendered"] as const).map((t) => (
          <div key={t} className="flex flex-col items-center gap-1">
            <span className={LABEL}>{t}</span>
            <div className="relative overflow-hidden rounded" style={{ width: SPRITE * zoom, height: SPRITE * zoom }}>
              <Dome b={b} mm={mm} treatment={t} styling={styling} />
            </div>
          </div>
        ))}
        <div className="flex flex-col gap-2 pb-1">
          <span className={LABEL}>
            button {active + 1} · {mm.toFixed(2)} mm
          </span>
          <label className="flex items-center gap-2">
            <span className={LABEL}>zoom</span>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-24"
            />
            <span className="text-[10px] tabular-nums text-white/50">{zoom}x</span>
          </label>
          <button
            onClick={() => {
              press(active);
              window.setTimeout(release, 130);
            }}
            className="rounded bg-white/10 px-2 py-1 text-[11px] text-white/80"
          >
            Press again
          </button>
        </div>
      </div>
    </main>
  );
}
