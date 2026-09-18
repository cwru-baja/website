// The site's accent colours follow the current car's livery. Each car lists
// the raw colours from its livery sheet; liveryTheme() turns them into roles
// that are safe on the site's near-black background, and the root layout
// writes those roles onto <html> as --livery-* variables (see globals.css).
//
// Roles, not swatches: a livery colour that looks right on the car can be
// unreadable as text here (SR26's magenta is 2.8:1 on #0a0a0a), so text and
// line roles are lightened until they pass, and text on a filled accent picks
// whichever of near-black or white actually reads on it.

export type Livery = {
  /** Buttons, active rows, header bars, the M logo, the coloured word in page titles (not the hero). */
  lead: string;
  /** Section titles' and the hero's coloured word, stat suffixes, podiums, countdown seconds. */
  pop: string;
  /** Secondary lines, chart slices, map accents. */
  support: string;
  /** Dark tints: background bands and glows. Never text. */
  deep: string;
};

export type Car = {
  name: string;
  year: number;
  livery: Livery;
};

export const CARS = {
  sr26: {
    name: "SR26",
    year: 2026,
    livery: { lead: "#26B0BD", pop: "#AB0472", support: "#1E6EBD", deep: "#122243" },
  },
} as const satisfies Record<string, Car>;

export type CarId = keyof typeof CARS;

/** Flip when the new car is revealed; its renders change at the same time. */
export const CURRENT_CAR: CarId = "sr26";

export const SITE_BACKGROUND = "#0a0a0a";
/** The lightest dark surface text sits on (bg-surface); contrast is solved against it. */
export const SITE_SURFACE = "#111111";

const DARK_TEXT = "#0a0a0a";
const LIGHT_TEXT = "#ffffff";
/** WCAG 2.2 SC 1.4.3, normal-size text. */
const TEXT_CONTRAST = 4.5;
/** WCAG 2.2 SC 1.4.11, lines, rings and chart marks. */
const NON_TEXT_CONTRAST = 3;
const HOVER_STEP = 0.06;

export type LiveryTheme = {
  livery: string;
  liveryInk: string;
  onLivery: string;
  liveryHover: string;
  liveryPop: string;
  liverySupport: string;
  liveryDeep: string;
};

export function liveryTheme(livery: Livery): LiveryTheme {
  const lead = normalizeHex(livery.lead);
  const onLivery =
    contrastRatio(DARK_TEXT, lead) >= contrastRatio(LIGHT_TEXT, lead) ? DARK_TEXT : LIGHT_TEXT;
  if (contrastRatio(onLivery, lead) < TEXT_CONTRAST) {
    throw new Error(
      `Livery lead ${lead} is a mid-tone: neither ${DARK_TEXT} nor ${LIGHT_TEXT} text reaches ${TEXT_CONTRAST}:1 on it. Pick a lighter or darker lead.`,
    );
  }

  return {
    livery: lead,
    liveryInk: raiseContrast(lead, SITE_SURFACE, TEXT_CONTRAST),
    onLivery,
    // Hover moves away from the label colour, so the label only gets clearer.
    liveryHover: shiftLightness(lead, onLivery === DARK_TEXT ? HOVER_STEP : -HOVER_STEP),
    liveryPop: raiseContrast(normalizeHex(livery.pop), SITE_SURFACE, TEXT_CONTRAST),
    liverySupport: raiseContrast(normalizeHex(livery.support), SITE_SURFACE, NON_TEXT_CONTRAST),
    liveryDeep: normalizeHex(livery.deep),
  };
}

export const CURRENT_THEME = liveryTheme(CARS[CURRENT_CAR].livery);

/** The --livery-* custom properties globals.css maps to Tailwind colours. */
export function liveryVariables(theme: LiveryTheme): Record<`--${string}`, string> {
  return {
    "--livery": theme.livery,
    "--livery-ink": theme.liveryInk,
    "--on-livery": theme.onLivery,
    "--livery-hover": theme.liveryHover,
    "--livery-pop": theme.liveryPop,
    "--livery-support": theme.liverySupport,
    "--livery-deep": theme.liveryDeep,
  };
}

// ---- Colour maths -----------------------------------------------------------
// sRGB <-> OKLCH (Björn Ottosson's OKLab) and WCAG 2 contrast. Lightness is
// adjusted in OKLCH so hue holds steady; chroma is reduced only when the
// lighter colour would leave the sRGB gamut.

type Rgb = [number, number, number];
type Oklch = { l: number; c: number; h: number };

function normalizeHex(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Expected a #rrggbb colour, got "${hex}"`);
  return `#${m[1].toUpperCase()}`;
}

function hexToRgb(hex: string): Rgb {
  const h = normalizeHex(hex);
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as Rgb;
}

function rgbToHex(rgb: Rgb): string {
  return `#${rgb
    .map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

function toLinear(v: number): number {
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function fromLinear(v: number): number {
  return v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function hexToOklch(hex: string): Oklch {
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  return { l: L, c: Math.hypot(A, B), h: Math.atan2(B, A) };
}

function oklchToLinear({ l, c, h }: Oklch): Rgb {
  const A = c * Math.cos(h);
  const B = c * Math.sin(h);
  const l_ = (l + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m_ = (l - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s_ = (l - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
}

function inGamut(rgb: Rgb): boolean {
  return rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4);
}

function oklchToHex(color: Oklch): string {
  let { c } = color;
  if (!inGamut(oklchToLinear(color))) {
    let lo = 0;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + c) / 2;
      if (inGamut(oklchToLinear({ ...color, c: mid }))) lo = mid;
      else c = mid;
    }
    c = lo;
  }
  return rgbToHex(oklchToLinear({ ...color, c }).map(fromLinear) as Rgb);
}

function shiftLightness(hex: string, delta: number): string {
  const color = hexToOklch(hex);
  return oklchToHex({ ...color, l: Math.min(1, Math.max(0, color.l + delta)) });
}

/**
 * The least-lightened version of `hex` that reaches `target`:1 against a dark
 * `background`. Colours that already pass come back unchanged.
 */
export function raiseContrast(hex: string, background: string, target: number): string {
  const start = normalizeHex(hex);
  if (contrastRatio(start, background) >= target) return start;
  const color = hexToOklch(start);
  let lo = color.l;
  let hi = 1;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (contrastRatio(oklchToHex({ ...color, l: mid }), background) >= target) hi = mid;
    else lo = mid;
  }
  // hi always passes; rounding to 8-bit channels can shave a hair off, so step on.
  let result = oklchToHex({ ...color, l: hi });
  for (let l = hi; contrastRatio(result, background) < target && l < 1; l += 0.002) {
    result = oklchToHex({ ...color, l });
  }
  return result;
}
