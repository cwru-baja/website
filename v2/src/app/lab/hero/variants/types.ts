// PROTOTYPE — throwaway. Shape of a /lab/hero background variant.

import type { ComponentType } from "react";

export type Variant = {
  /** URL slug: /lab/hero?v=<id>. Lowercase kebab-case, unique. */
  id: string;
  /** Short display name, 1–3 words. */
  name: string;
  /** still: no motion · ambient: noticed after a few seconds · calm: visible but slow · lively: clearly moving */
  motion: "still" | "ambient" | "calm" | "lively";
  reactive?: "cursor" | "scroll" | "cursor + scroll";
  tech: "CSS" | "SVG" | "WebGL" | "Canvas 2D" | "Blender + CSS";
  /** One sentence: what it looks like and why it suits the car. */
  idea: string;
  /** Renders the full backdrop. Fills its absolutely-positioned, pointer-events-none parent. */
  Component: ComponentType;
};
