"use client";

// PROTOTYPE — throwaway. "Mesh flow": a slow, domain-warped mesh gradient
// (navy → blue → teal, one thin magenta vein) confined to a soft region around
// the car. Colours are mixed in OKLab so teal and magenta never meet as grey.

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
uniform vec4 u_car;
uniform vec2 u_carC;

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

void main() {
  vec2 frag = gl_FragCoord.xy;
  // Car-relative space in car widths, y up. The car spans roughly x -0.5..0.5.
  float S = max(u_car.z, 0.45 * u_res.x);
  vec2 q = (frag - u_carC) / S;
  float T = u_time * 0.013;

  // Domain warp: one gentle pass keeps the folds silky rather than turbulent.
  vec2 p = q * 1.6;
  vec2 w = vec2(
    snoise(p * 0.7 + vec2(T * 0.7, -T * 0.4)),
    snoise(p * 0.7 + vec2(4.1 - T * 0.5, 1.7 + T * 0.6)));
  vec2 pw = p + w * 0.7;

  float nA = snoise(pw * 0.9 + vec2(0.0, T * 0.8));
  float nB = snoise(pw * 0.7 + vec2(7.3 - T * 0.4, 2.1));

  // Where colour may live: a rounded box around the car's body, warped so the
  // edge breathes. It spills generously up, right and down (behind the cage,
  // onto the floor) and only briefly toward the headline.
  vec2 half_ = 0.5 * u_car.zw / S;
  vec2 boxC = (u_car.xy + 0.5 * u_car.zw - u_carC) / S;
  vec2 rq = q - boxC;
  const float RAD = 0.22;
  vec2 dd = abs(rq) - (half_ - RAD);
  float sd = length(max(dd, 0.0)) + min(max(dd.x, dd.y), 0.0) - RAD;
  sd += (w.x * 0.5 + 0.5) * 0.08;
  float reach = mix(0.1, 0.34, smoothstep(-0.55, 0.1, rq.x));
  float region = 1.0 - smoothstep(-0.2, reach, sd);
  region *= region;
  region *= smoothstep(0.3, 0.46, frag.x / u_res.x);

  // Palette: navy valleys, blue folds, teal ridges leading up and to the right
  // (where the render's cyan rim light sits).
  float upRight = smoothstep(-0.5, 0.4, q.y * 1.3 + q.x * 0.5);
  float ridge = nA * 0.65 + nB * 0.55;
  vec3 c = mix(NAVY, BLUE, smoothstep(-0.7, 0.1, ridge));
  float wTeal = smoothstep(0.0, 0.75, ridge + upRight * 0.55 - 0.2);

  // The magenta vein: one thin ribbon that slips out from under the car toward
  // the lower left (where the render's magenta rim light sits), carried by the
  // same warp. Teal is pushed away from it so the two only meet through blue.
  vec2 vd = q - vec2(-0.3, -0.32);
  float along = dot(vd, vec2(0.85, 0.53));
  float across = dot(vd, vec2(-0.53, 0.85));
  across += 0.7 * along * along + 0.025 * snoise(vec2(along * 2.2 - T * 1.2, 3.7)) + 0.03 * w.y;
  float veinZone = smoothstep(-0.26, -0.08, along) * (1.0 - smoothstep(0.02, 0.24, along));
  float vc = across / 0.0024;
  float veinCore = exp(-vc * vc) * veinZone;
  float vh = across / 0.035;
  float veinHalo = exp(-vh * vh) * veinZone;
  float vw = across / 0.16;
  float veinClear = exp(-vw * vw) * veinZone;
  wTeal *= 1.0 - veinClear;
  c = mix(c, TEAL, wTeal);

  // Light: ridges glow, valleys fall back toward black, so it reads as a lit
  // surface rather than a blob.
  float lit = smoothstep(-0.8, 0.8, ridge);
  float glow = region * (0.22 + 0.78 * lit * lit) * 0.8;

  vec3 lab = mix(BG, c, glow);
  // Vein on top: a faint blue sheath, then the magenta thread.
  lab = mix(lab, BLUE, veinHalo * 0.16);
  lab = mix(lab, MAGENTA, veinCore * 0.8);
  vec3 rgb = lin2srgb(lab2lin(lab));
  // Triangular dither kills banding in the long dark falloff.
  rgb += (hash12(frag) + hash12(frag + 19.19) - 1.0) / 255.0;
  gl_FragColor = vec4(rgb, 1.0);
}
`;

function MeshFlow() {
  return (
    <div className="absolute inset-0">
      <ShaderCanvas frag={FRAG} />
    </div>
  );
}

export const meshFlow: Variant = {
  id: "mesh-flow",
  name: "Mesh flow",
  motion: "ambient",
  tech: "WebGL",
  idea: "A slow Stripe-style mesh gradient, navy to blue to teal with one thin magenta vein, mixed in OKLab and held behind the car.",
  Component: MeshFlow,
};
