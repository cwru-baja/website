"use client";

// PROTOTYPE — throwaway. Background variants, group A: studio lighting, CSS only.

import { conicHalo } from "./conic-halo";
import { lightSweep } from "./light-sweep";
import { splitRim } from "./split-rim";
import { stageFloor } from "./stage-floor";
import { studioHalo } from "./studio-halo";
import type { Variant } from "./types";

export const groupA: Variant[] = [studioHalo, stageFloor, splitRim, lightSweep, conicHalo];
