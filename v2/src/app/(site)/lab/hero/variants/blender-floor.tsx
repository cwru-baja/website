"use client";

// PROTOTYPE — throwaway. #20's showroom floor, rendered physically in Blender instead
// of faked in CSS: the car's real reflection (underside included), contact shadows and
// a light-linked teal spot pool, from the same camera as homepage-car-sr26.webp.
// Renders: v2/artifacts/floor/v5 (floor view layer with the car Indirect Only),
// exported by premultiplying, dithering and unmultiplying to straight-alpha 8-bit PNG.
//
// The pool breathes by crossfading full renders at 2000 W and 1500 W. Rendering the
// pool as its own layer and adding it in CSS was measured and rejected: AgX isn't
// additive, so the split sum came out 7-17 levels too bright where they overlap.

import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { StaticImageData } from "next/image";
import { useLabReducedMotion } from "../lab";
import type { Variant } from "./types";
import box from "./blender-floor/box.json";
import g20s100p2000 from "./blender-floor/g20-s100-p2000.png";
import g20s100p1500 from "./blender-floor/g20-s100-p1500.png";
import g20s065p2000 from "./blender-floor/g20-s065-p2000.png";
import g20s065p1500 from "./blender-floor/g20-s065-p1500.png";
import g20s040p2000 from "./blender-floor/g20-s040-p2000.png";
import g20s040p1500 from "./blender-floor/g20-s040-p1500.png";
import g28s100p2000 from "./blender-floor/g28-s100-p2000.png";
import g28s100p1500 from "./blender-floor/g28-s100-p1500.png";
import g28s065p2000 from "./blender-floor/g28-s065-p2000.png";
import g28s065p1500 from "./blender-floor/g28-s065-p1500.png";
import g28s040p2000 from "./blender-floor/g28-s040-p2000.png";
import g28s040p1500 from "./blender-floor/g28-s040-p1500.png";

type Gloss = "20" | "28";
type Strength = "100" | "065" | "040";

const RENDERS: Record<`${Gloss}-${Strength}`, { bright: StaticImageData; dim: StaticImageData }> = {
  "20-100": { bright: g20s100p2000, dim: g20s100p1500 },
  "20-065": { bright: g20s065p2000, dim: g20s065p1500 },
  "20-040": { bright: g20s040p2000, dim: g20s040p1500 },
  "28-100": { bright: g28s100p2000, dim: g28s100p1500 },
  "28-065": { bright: g28s065p2000, dim: g28s065p1500 },
  "28-040": { bright: g28s040p2000, dim: g28s040p1500 },
};

// The floor image's box is stored in units of the car PNG's drawn box; the shell's
// --car-* variables give the car *body* box, so undo the PNG margins first.
const CSS = `
.blender-floor-hero {
  position: absolute;
  inset: 0;
  /* Never end in a hard line at the hero's bottom edge. */
  -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - 110px), transparent);
  mask-image: linear-gradient(to bottom, #000 calc(100% - 110px), transparent);
}
.blender-floor-box {
  position: absolute;
  --iw: calc(var(--car-w) / 0.944);
  --ih: calc(var(--car-h) / 0.976);
  left: calc(var(--car-l) - 0.013 * var(--iw) + ${box.left} * var(--iw));
  top: calc(var(--car-t) - 0.011 * var(--ih) + ${box.top} * var(--ih));
  width: calc(${box.width} * var(--iw));
  height: calc(${box.height} * var(--ih));
  /* The render's right and bottom edges still carry light; fade them so wide or tall
     viewports never show the frame. */
  -webkit-mask-image: linear-gradient(to right, transparent 0%, #000 6%, #000 88%, transparent 100%),
    linear-gradient(to bottom, #000 62%, transparent 100%);
  -webkit-mask-composite: source-in;
  mask-image: linear-gradient(to right, transparent 0%, #000 6%, #000 88%, transparent 100%),
    linear-gradient(to bottom, #000 62%, transparent 100%);
  mask-composite: intersect;
}
.blender-floor-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  /* Additive inside the box, so opacity 1-t and t sum to an exact crossfade. */
  mix-blend-mode: plus-lighter;
}
.blender-floor-bright { animation: blender-floor-out 14s ease-in-out infinite alternate; }
.blender-floor-dim { opacity: 0; animation: blender-floor-in 14s ease-in-out infinite alternate; }
@keyframes blender-floor-out { from { opacity: 1; } to { opacity: 0; } }
@keyframes blender-floor-in { from { opacity: 0; } to { opacity: 1; } }
[data-reduced-motion] .blender-floor-bright { animation: none; opacity: 1; }
[data-reduced-motion] .blender-floor-dim { animation: none; opacity: 0; }
`;

const panel: React.CSSProperties = {
  position: "fixed",
  top: 80,
  right: 16,
  zIndex: 1000,
  padding: "10px 12px",
  borderRadius: 14,
  background: "rgba(20,20,22,0.92)",
  border: "1px solid rgba(255,255,255,0.14)",
  color: "white",
  fontFamily: "ui-sans-serif, system-ui, sans-serif",
  fontSize: 12,
  display: "grid",
  gap: 8,
  pointerEvents: "auto",
};

function Choice<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 70, color: "rgba(255,255,255,0.55)" }}>{label}</span>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          style={{
            padding: "3px 8px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.2)",
            background: value === o.value ? "rgba(255,255,255,0.9)" : "transparent",
            color: value === o.value ? "#0a0a0a" : "rgba(255,255,255,0.75)",
            cursor: "pointer",
            fontSize: 11,
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const noopSubscribe = () => () => {};

function BlenderFloor() {
  const reduced = useLabReducedMotion();
  const [gloss, setGloss] = useState<Gloss>("28");
  const [strength, setStrength] = useState<Strength>("065");
  // The controls portal into <body>, which only exists on the client.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const r = RENDERS[`${gloss}-${strength}`];

  return (
    <>
      <style>{CSS}</style>
      <div className="blender-floor-hero">
        <div className="blender-floor-box">
          {/* Plain <img>: next/image would re-encode to lossy 8-bit WebP and band the gradient. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="blender-floor-img blender-floor-bright" src={r.bright.src} alt="" />
          {!reduced && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="blender-floor-img blender-floor-dim" src={r.dim.src} alt="" />
          )}
        </div>
      </div>
      {mounted &&
        createPortal(
          <div style={panel} data-lab-floor-controls>
            <Choice
              label="Gloss"
              value={gloss}
              onChange={setGloss}
              options={[
                { value: "20", label: "sharper (0.20)" },
                { value: "28", label: "softer (0.28)" },
              ]}
            />
            <Choice
              label="Reflection"
              value={strength}
              onChange={setStrength}
              options={[
                { value: "100", label: "100%" },
                { value: "065", label: "65%" },
                { value: "040", label: "40%" },
              ]}
            />
          </div>,
          document.body,
        )}
    </>
  );
}

export const blenderFloor: Variant = {
  id: "blender-floor",
  name: "Blender floor",
  motion: "ambient",
  tech: "Blender + CSS",
  idea: "#20 rendered physically: the car's real reflection and contact shadows on a dark coated floor, a light-linked teal pool breathing between two renders, no wall glow.",
  Component: BlenderFloor,
};
