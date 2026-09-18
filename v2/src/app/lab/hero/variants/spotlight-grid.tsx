"use client";

// PROTOTYPE — throwaway. "Cursor spotlight": a near-invisible 24px grid spans
// the hero. A soft teal light follows the (smoothed) cursor and reveals it in
// livery colours, with a thin magenta fringe at the light's edge. Idle, the
// light rests behind the car and breathes.

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

const float PITCH_CSS = 24.0;
const float TICK_CSS = 4.0;

// Coverage of a 1 CSS px line repeating every pitch, box-filtered per pixel so
// it lands crisp on whole device pixels.
float gridLine(float x, float pitch, float w) {
  float d = abs(mod(x - 0.5 * w + 0.5 * pitch, pitch) - 0.5 * pitch);
  return clamp(0.5 * w + 0.5 - d, 0.0, 1.0);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  float pitch = floor(PITCH_CSS * u_dpr + 0.5);
  float w = max(1.0, floor(u_dpr + 0.5));
  // Grid measured from the top-left, centred horizontally in the hero.
  vec2 g = vec2(frag.x - floor(mod(u_res.x, pitch) * 0.5), u_res.y - frag.y);
  float lx = gridLine(g.x, pitch, w);
  float ly = gridLine(g.y, pitch, w);
  float lines = max(lx, ly);
  // Crosshair ticks: short arms at every intersection.
  vec2 toNode = abs(mod(g - 0.5 * w + 0.5 * pitch, pitch) - 0.5 * pitch);
  float arm = TICK_CSS * u_dpr + 0.5 * w;
  float ticks = max(lx * step(toNode.y, arm), ly * step(toNode.x, arm));

  // The light: idle it sits behind the car, wide, and breathes; under the
  // cursor it tightens into a smaller, sharper spot.
  float z = u_mouse.z;
  float carW = u_car.z / u_dpr;
  float breathe = sin(u_time * 0.9) * (1.0 - z);
  float R = mix(max(0.66 * carW, 220.0), 250.0, z) * (1.0 + 0.035 * breathe) * u_dpr;
  float d = length(frag - u_mouse.xy);
  float u = d / R;
  // Flat core, soft shoulder, then a thin magenta fringe just past the edge.
  float light = 1.0 - smoothstep(0.12, 1.0, u);
  light = pow(light, 1.6);
  float power = 0.93 + 0.07 * breathe;
  float fu = (u - 0.97) / 0.06;
  float fringe = exp(-fu * fu);

  // Core colour steps from teal to blue toward the edge, so the magenta fringe
  // only ever meets blue.
  vec3 core = mix(TEAL, BLUE, smoothstep(0.5, 0.95, u));
  float wf = fringe / (light + fringe + 1e-4);

  // Headline column stays quiet.
  float column = mix(0.35, 1.0, smoothstep(0.24, 0.5, frag.x / u_res.x));

  float lit = light * power * column;
  float fr = fringe * 0.4 * power * column;
  float reveal = lit + fr;
  vec3 base = mix(NAVY, BLUE, 0.35);
  vec3 ink = mix(base, mix(core, MAGENTA, wf), smoothstep(0.0, 0.12, reveal));
  float aLines = 0.04 + 0.2 * reveal;
  float aTicks = 0.06 + 0.72 * reveal;

  vec3 lab = BG;
  // A faint haze so it reads as light, not just recoloured lines.
  lab = mix(lab, TEAL, 0.05 * lit);
  lab = mix(lab, MAGENTA, 0.02 * fr);
  lab = mix(lab, ink, max(lines * aLines, ticks * aTicks));

  vec3 rgb = lin2srgb(lab2lin(lab));
  rgb += (hash12(frag) + hash12(frag + 19.19) - 1.0) / 255.0;
  gl_FragColor = vec4(rgb, 1.0);
}
`;

function SpotlightGrid() {
  // Full device resolution so the 1px grid stays pixel-sharp; the shader is trivial.
  return (
    <div className="absolute inset-0">
      <ShaderCanvas frag={FRAG} scale={1} maxDpr={2} />
    </div>
  );
}

export const spotlightGrid: Variant = {
  id: "spotlight-grid",
  name: "Cursor spotlight",
  motion: "ambient",
  reactive: "cursor",
  tech: "WebGL",
  idea: "A near-invisible measuring grid; a soft teal light with a magenta fringe follows the cursor and reveals it, resting behind the car when idle.",
  Component: SpotlightGrid,
};
