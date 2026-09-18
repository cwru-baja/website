// PROTOTYPE — throwaway. Every /lab/hero background variant, in switcher order.

import { current } from "./current";
import { groupA } from "./group-a";
import { groupB } from "./group-b";
import { groupC } from "./group-c";
import { groupD } from "./group-d";
import type { Variant } from "./types";

export const VARIANTS: Variant[] = [current, ...groupA, ...groupB, ...groupC, ...groupD];
