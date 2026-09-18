"use client";

// PROTOTYPE — throwaway. Background variants, group B: shaders.

import { halftoneGlow } from "./halftone-glow";
import { meshFlow } from "./mesh-flow";
import { spotlightGrid } from "./spotlight-grid";
import { topoLines } from "./topo-lines";
import type { Variant } from "./types";

export const groupB: Variant[] = [meshFlow, halftoneGlow, topoLines, spotlightGrid];
