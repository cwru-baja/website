"use client";

// PROTOTYPE — throwaway. "Halftone glow": the livery's halftone print, used as
// light. A soft teal glow behind the car (magenta low-left) is screened into a
// rotated dot grid whose dot radius encodes intensity; the field drifts, so the
// dots swell and shrink.

import { PALETTE, ShaderCanvas, hexToVec3 } from "../lab";
import type { Variant } from "./types";

/** sRGB hex → OKLab, as a GLSL vec3 literal. */
function labVec(hex: string): string {
  const lin = hexToVec3(hex).map((c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  const [r, g, b] = lin;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return `vec3(${L.toFixed(5)}, ${A.toFixed(5)}, ${B.toFixed(5)})`;
}

const FRAG = /* glsl */ `
uniform vec2 u_res;
uniform float u_time;
uniform float u_dpr;
uniform vec4 u_car;
uniform vec2 u_carC;

const vec3 BG = ${labVec(PALETTE.bg)};
const vec3 BLUE = ${labVec(PALETTE.blue)};
const vec3 TEAL = ${labVec(PALETTE.teal)};
const vec3 MAGENTA = ${labVec(PALETTE.magentaLight)};

vec3 lab2lin(vec3 c) {
  float l = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
  float m = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
  float s = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
  l = l * l * l; m = m * m * m; s = s * s * s;
  return vec3(
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s);
}
vec3 lin2srgb(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// 2D simplex noise (Ashima Arts / Stefan Gustavson, MIT).
vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

const float ANGLE = 0.35; // ~20 degrees

void main() {
  vec2 frag = gl_FragCoord.xy;
  // ~10 CSS px at desktop; finer when the car is drawn small (phones).
  float pitch = clamp(u_car.z / u_dpr / 80.0, 6.0, 10.0) * u_dpr;
  float cs = cos(ANGLE);
  float sn = sin(ANGLE);
  mat2 rot = mat2(cs, sn, -sn, cs);

  // Screen the field: find this pixel's dot and sample the glow at its centre,
  // so every dot stays a clean circle.
  vec2 g = (rot * frag) / pitch;
  vec2 cell = floor(g) + 0.5;
  vec2 local = (g - cell) * pitch;
  vec2 centre = (cell * pitch) * rot; // inverse rotation (transpose)

  float S = max(u_car.z, 0.45 * u_res.x);
  vec2 q = (centre - u_carC) / S;
  float T = u_time * 0.045;

  // Slow drift: the lobes wander a little and a low-frequency swell rolls through.
  float n = snoise(q * 1.7 + vec2(T, -T * 0.6));
  float n2 = snoise(q * 3.1 + vec2(-T * 0.8, T * 0.5) + 11.0);

  // Teal: a lobe hugging the car, lifted up and to the right like the render's
  // cyan rim light. Unit distance is roughly the car's own outline.
  vec2 tq = (q - vec2(0.07 + 0.025 * sin(T * 1.3), 0.1 + 0.02 * cos(T))) / vec2(0.55, 0.47);
  float teal = exp(-dot(tq, tq) * 1.7) * (0.85 + 0.25 * n + 0.08 * n2);
  // Magenta: a small lobe low and left, where the magenta rim light sits.
  vec2 mq = (q - vec2(-0.36 + 0.02 * cos(T * 1.1), -0.3)) / vec2(0.2, 0.15);
  float mag = exp(-dot(mq, mq) * 1.2) * (0.5 + 0.15 * n2);

  float I = teal + mag;
  I *= smoothstep(0.32, 0.5, centre.x / u_res.x); // keep the headline clean
  I = smoothstep(0.08, 1.0, I);

  // Dot: radius from intensity (area ~ intensity), anti-aliased over ~1 device px.
  float rMax = 0.47 * pitch;
  float rad = rMax * I;
  float dist = length(local);
  float aa = max(0.6, 0.7 * u_dpr);
  float cov = clamp((rad - dist) / aa + 0.5, 0.0, 1.0);
  cov *= smoothstep(0.35 * u_dpr, 1.1 * u_dpr, rad); // sub-pixel dots fade instead of sparkling

  // Ink: teal, meeting magenta only through blue.
  float m = smoothstep(0.25, 0.75, mag / (teal + mag + 1e-4));
  vec3 ink = m < 0.5 ? mix(TEAL, BLUE, m * 2.0) : mix(BLUE, MAGENTA, m * 2.0 - 1.0);
  float strength = mix(0.6, 0.88, I);

  vec3 lab = mix(BG, ink, cov * strength);
  vec3 rgb = lin2srgb(lab2lin(lab));
  rgb += (hash12(frag) + hash12(frag + 19.19) - 1.0) / 255.0;
  gl_FragColor = vec4(rgb, 1.0);
}
`;

function HalftoneGlow() {
  // Full device resolution: the dots are the whole idea and must stay crisp.
  return (
    <div className="absolute inset-0">
      <ShaderCanvas frag={FRAG} scale={1} maxDpr={2} />
    </div>
  );
}

export const halftoneGlow: Variant = {
  id: "halftone-glow",
  name: "Halftone glow",
  motion: "ambient",
  tech: "WebGL",
  idea: "The livery's halftone print as light: a teal glow behind the car (magenta low-left) screened into a rotated dot grid that slowly swells and shrinks.",
  Component: HalftoneGlow,
};
