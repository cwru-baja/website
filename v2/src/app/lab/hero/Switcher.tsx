"use client";

// PROTOTYPE — throwaway. Floating variant switcher for /lab/hero. Dev only.
// ← → cycle variants · T hide copy · C hide car · M simulate reduced motion · B hide this bar

import { useEffect } from "react";
import type { Variant } from "./variants/types";

type Toggles = { hideCopy: boolean; hideCar: boolean; reducedMotion: boolean; hideBar: boolean };

const pill: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  height: 20,
  padding: "0 7px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.18)",
  fontSize: 10,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.7)",
  whiteSpace: "nowrap",
};

const button: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.2)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  fontSize: 16,
  cursor: "pointer",
  flexShrink: 0,
};

export default function Switcher({
  variants,
  index,
  onSelect,
  toggles,
  onToggle,
}: {
  variants: Variant[];
  index: number;
  onSelect: (i: number) => void;
  toggles: Toggles;
  onToggle: (key: keyof Toggles) => void;
}) {
  const v = variants[index];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const n = variants.length;
      if (e.key === "ArrowRight") onSelect((index + 1) % n);
      else if (e.key === "ArrowLeft") onSelect((index - 1 + n) % n);
      else if (e.key === "t") onToggle("hideCopy");
      else if (e.key === "c") onToggle("hideCar");
      else if (e.key === "m") onToggle("reducedMotion");
      else if (e.key === "b") onToggle("hideBar");
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, variants.length, onSelect, onToggle]);

  if (toggles.hideBar) return null;

  const toggle = (key: keyof Toggles, label: string, hotkey: string) => (
    <button
      type="button"
      onClick={() => onToggle(key)}
      title={`Hotkey: ${hotkey}`}
      style={{
        ...pill,
        cursor: "pointer",
        background: toggles[key] ? "rgba(255,255,255,0.9)" : "transparent",
        color: toggles[key] ? "#0a0a0a" : "rgba(255,255,255,0.6)",
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      data-lab-switcher
      style={{
        position: "fixed",
        left: "50%",
        bottom: 16,
        transform: "translateX(-50%)",
        zIndex: 1000,
        width: "min(720px, calc(100vw - 24px))",
        padding: "10px 12px",
        borderRadius: 18,
        background: "rgba(20,20,22,0.92)",
        border: "1px solid rgba(255,255,255,0.14)",
        boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
        backdropFilter: "blur(10px)",
        color: "white",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button type="button" aria-label="Previous variant" style={button} onClick={() => onSelect((index - 1 + variants.length) % variants.length)}>
          ←
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", fontVariantNumeric: "tabular-nums" }}>
              {index + 1}/{variants.length}
            </span>
            <select
              value={v.id}
              onChange={(e) => onSelect(variants.findIndex((x) => x.id === e.target.value))}
              style={{
                background: "transparent",
                color: "white",
                border: "none",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                maxWidth: 220,
              }}
            >
              {variants.map((x, i) => (
                <option key={x.id} value={x.id} style={{ background: "#141416" }}>
                  {i + 1}. {x.name}
                </option>
              ))}
            </select>
            <span style={pill}>{v.motion}</span>
            {v.reactive && <span style={pill}>{v.reactive}</span>}
            <span style={pill}>{v.tech}</span>
          </div>
          <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.35, color: "rgba(255,255,255,0.55)" }}>{v.idea}</div>
        </div>
        <button type="button" aria-label="Next variant" style={button} onClick={() => onSelect((index + 1) % variants.length)}>
          →
        </button>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
        {toggle("hideCopy", "Hide copy (T)", "T")}
        {toggle("hideCar", "Hide car (C)", "C")}
        {toggle("reducedMotion", "Reduced motion (M)", "M")}
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginLeft: "auto" }}>← → cycle · B hides bar</span>
      </div>
    </div>
  );
}
