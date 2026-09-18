"use client";

// PROTOTYPE — throwaway. "Terrain contours": hairline topographic contours of a
// slowly evolving noise terrain. Dim navy/blue across the hero, teal near the
// car, magenta in the low basins beside it. The cursor raises a gentle hill the
// contours bend around.

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

const FRAG = /* glsl */ `#extension GL_OES_standard_derivatives : enable
uniform vec2 u_res;
uniform float u_time;
uniform float u_dpr;
uniform vec4 u_car;
uniform vec2 u_carC;
uniform vec3 u_mouse;

const vec3 BG = ${labVec(PALETTE.bg)};
const vec3 NAVY = ${labVec(PALETTE.navy)};
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

const float LEVELS = 5.0;     // contour lines per unit of height

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 css = frag / u_dpr;
  float T = u_time * 0.02;

  // Terrain: two broad octaves sliding in different directions, so it morphs
  // rather than scrolls.
  vec2 p = css / 720.0;
  float h = snoise(p + vec2(T * 0.6, 0.25 * T)) * 0.72
          + snoise(p * 1.9 + vec2(4.7, -T * 0.9)) * 0.28;

  // Shape the land around the car: a rise behind
  // the cage (teal high ground) and sink a basin off its lower-left corner
  // (where magenta pools, like the render's magenta rim light).
  vec2 carCss = u_carC / u_dpr;
  float carW = u_car.z / u_dpr;
  float landW = max(carW, 600.0); // feature size: don't shrink into a bullseye on phones
  vec2 dr = css - (carCss + vec2(0.1, 0.18) * carW);
  float rise = exp(-dot(dr, dr) / (0.12 * landW * landW));
  h += 0.35 * rise;
  vec2 db = css - (carCss + vec2(-0.44 + 0.02 * sin(T * 2.0), -0.37) * carW);
  float basin = exp(-dot(db, db) / (0.05 * landW * landW));
  h -= 0.9 * basin;

  // Cursor hill: a gentle bump, only while the pointer is over the hero.
  vec2 dm = (frag - u_mouse.xy) / u_dpr;
  float hill = u_mouse.z * exp(-dot(dm, dm) / (210.0 * 210.0));
  h += 0.6 * hill;

  // Proximity to the car's outline (CSS px), for colour and brightness.
  vec2 half_ = 0.5 * u_car.zw / u_dpr;
  vec2 rq = (frag - (u_car.xy + 0.5 * u_car.zw)) / u_dpr;
  vec2 dd = abs(rq) - (half_ - 90.0);
  float sd = length(max(dd, 0.0)) + min(max(dd.x, dd.y), 0.0) - 90.0;
  float near = 1.0 - smoothstep(-160.0, 230.0, sd);
  near *= near;

  // Distance to the nearest contour, in device px, from screen-space derivatives.
  float v = h * LEVELS;
  float fw = max(fwidth(v), 1e-4);
  float dist = abs(fract(v + 0.5) - 0.5) / fw;
  float halfW = 0.5 * mix(0.9, 1.25, near) * u_dpr;
  float cov = 1.0 - smoothstep(halfW - 0.5, halfW + 0.5, dist);
  // Every fourth line is an index contour: a touch brighter.
  float idx = step(abs(mod(floor(v + 0.5), 4.0)), 0.5);

  // Colour: navy/blue far away, teal near the car, magenta in low basins near it
  // (reached through blue, never straight from teal).
  vec3 far = mix(NAVY, BLUE, 0.45);
  // The basin's inner contours read magenta; its rim steps through blue.
  float low = smoothstep(0.22, 0.62, basin);
  vec3 nearCol = low < 0.5 ? mix(TEAL, BLUE, low * 2.0) : mix(BLUE, MAGENTA, low * 2.0 - 1.0);
  float warm = max(near, low);
  vec3 col = mix(far, nearCol, warm);

  float alpha = mix(0.38, 0.95, warm) * mix(0.72, 1.0, idx);
  // Very dim behind the headline column; the hill's rings catch a little light.
  alpha *= mix(0.25, 1.0, smoothstep(0.22, 0.5, frag.x / u_res.x));
  alpha = min(1.0, alpha * (1.0 + 0.6 * hill));

  vec3 lab = mix(BG, col, cov * alpha);
  vec3 rgb = lin2srgb(lab2lin(lab));
  rgb += (hash12(frag) + hash12(frag + 19.19) - 1.0) / 255.0;
  gl_FragColor = vec4(rgb, 1.0);
}
`;

function TopoLines() {
  // Full device resolution: hairlines go soft when upscaled.
  return (
    <div className="absolute inset-0">
      <ShaderCanvas frag={FRAG} scale={1} maxDpr={2} />
    </div>
  );
}

export const topoLines: Variant = {
  id: "topo-lines",
  name: "Terrain contours",
  motion: "calm",
  reactive: "cursor",
  tech: "WebGL",
  idea: "An off-road nod: hairline contours of a slowly shifting terrain, teal near the car with magenta basins; the cursor raises a hill the lines bend around.",
  Component: TopoLines,
};
