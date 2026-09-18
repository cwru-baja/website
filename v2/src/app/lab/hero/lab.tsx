"use client";

// PROTOTYPE — throwaway. Shared plumbing for the /lab/hero background variants.
// Delete the whole src/app/lab directory once a background has been chosen.

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
  type CSSProperties,
  type MutableRefObject,
} from "react";
import { CARS, CURRENT_CAR, CURRENT_THEME } from "@/lib/livery";

// ---- Palette ----------------------------------------------------------------
// Raw livery swatches (true to the paint) and the site's contrast-safe roles.
// Backgrounds aren't text, so either is fair game.

const raw = CARS[CURRENT_CAR].livery;

export const PALETTE = {
  bg: "#0a0a0a",
  teal: raw.lead, //        #26B0BD
  magenta: raw.pop, //      #AB0472 (raw paint)
  magentaLight: CURRENT_THEME.liveryPop, // #D63F96-ish, what "TO WIN." uses
  blue: raw.support, //     #1E6EBD
  navy: raw.deep, //        #122243
} as const;

export function hexToVec3(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
}

// ---- Hero geometry ----------------------------------------------------------
// HeroShell measures where the car is actually drawn (object-contain maths plus
// the PNG's measured alpha bounds) and tracks the pointer and scroll. Values
// are in CSS px relative to the hero section's top-left. Mutated in place, never
// re-rendered: read it inside rAF loops, or use the CSS variables below.
//
// CSS variables set on the background wrapper (all px unless noted):
//   --car-l --car-t --car-w --car-h   car body bounding box
//   --car-cx --car-cy                 car visual centre (alpha centroid)
//   --car-floor                       lowest point of the front tyre (y)
//   --car-gx --car-gy                 centre of the tyre footprint on the ground (perspective floor point)
//   --mx --my                         smoothed pointer (rests on the car centre when idle)
//   --pointer                         0..1, eases to 1 while the pointer is over the hero
//   --scroll                          0..1, how far the hero has scrolled out of view
//   --hero-w --hero-h                 section size

export type HeroGeometry = {
  width: number;
  height: number;
  car: { l: number; t: number; w: number; h: number; cx: number; cy: number; floor: number; gx: number; gy: number };
  pointer: { x: number; y: number; active: number };
  scroll: number;
};

export function emptyGeometry(): HeroGeometry {
  return {
    width: 1,
    height: 1,
    car: { l: 0, t: 0, w: 1, h: 1, cx: 0, cy: 0, floor: 0, gx: 0, gy: 0 },
    pointer: { x: 0, y: 0, active: 0 },
    scroll: 0,
  };
}

type LabContextValue = {
  geometry: MutableRefObject<HeroGeometry>;
  /** True when the OS asks for reduced motion OR the lab's "M" toggle is on. */
  reducedMotion: boolean;
};

export const LabContext = createContext<LabContextValue | null>(null);

export function useHeroGeometry(): MutableRefObject<HeroGeometry> {
  const ctx = useContext(LabContext);
  if (!ctx) throw new Error("useHeroGeometry must be used inside HeroShell");
  return ctx.geometry;
}

export function useLabReducedMotion(): boolean {
  return useContext(LabContext)?.reducedMotion ?? false;
}

function subscribeReducedMotion(cb: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

export function useOsReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

// ---- rAF loop helper --------------------------------------------------------
// Runs `frame(tSeconds, dt)` every animation frame while the hero is on screen
// and the tab is visible. With reduced motion it runs one frame and stops.

export function useFrameLoop(
  frame: (t: number, dt: number) => void,
  target: MutableRefObject<Element | null>,
) {
  const reduced = useLabReducedMotion();
  const frameRef = useRef(frame);
  useEffect(() => {
    frameRef.current = frame;
  });

  useEffect(() => {
    let raf = 0;
    let visible = true;
    let last = performance.now();
    const start = last;

    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      frameRef.current((now - start) / 1000, dt);
      if (!reduced && visible && !document.hidden) raf = requestAnimationFrame(tick);
      else raf = 0;
    };
    const kick = () => {
      if (!raf && visible && !document.hidden) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      kick();
    });
    if (target.current) io.observe(target.current);
    document.addEventListener("visibilitychange", kick);
    // Reduced motion still draws once (and again on resize via the caller).
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", kick);
    };
  }, [reduced, target]);
}

// ---- Minimal WebGL fragment-shader canvas -----------------------------------
// No dependencies. Draws one full-screen triangle with your fragment shader.
// Uniforms provided to every shader (declare the ones you use):
//   uniform vec2  u_res;      // canvas size in device px
//   uniform float u_time;     // seconds (frozen at u_time = 12.0 under reduced motion)
//   uniform float u_dpr;      // device px per CSS px (after the render scale)
//   uniform vec4  u_car;      // car box l, t, w, h in device px, origin BOTTOM-left like gl_FragCoord
//   uniform vec2  u_carC;     // car centre in device px (bottom-left origin)
//   uniform float u_floor;    // lowest front-tyre point y in device px (bottom-left origin)
//   uniform vec2  u_ground;   // centre of the tyre footprint in device px (bottom-left origin)
//   uniform vec3  u_mouse;    // smoothed pointer x, y (device px, bottom-left) and active 0..1
//   uniform float u_scroll;   // 0..1
//   uniform vec3  u_bg, u_teal, u_magenta, u_blue, u_navy;  // linear-ish 0..1 sRGB
// `precision highp float;` is prepended for you, after any `#extension` lines.
// OES_standard_derivatives is switched on, so `#extension GL_OES_standard_derivatives : enable`
// gives you fwidth()/dFdx().

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

export function ShaderCanvas({
  frag,
  /** Fraction of device resolution to render at. Soft gradients look identical at 0.5 and cost a quarter. */
  scale = 0.5,
  maxDpr = 2,
  style,
  className,
  onUniforms,
}: {
  frag: string;
  scale?: number;
  maxDpr?: number;
  style?: CSSProperties;
  className?: string;
  /** Set extra uniforms each frame. */
  onUniforms?: (gl: WebGLRenderingContext, program: WebGLProgram, t: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const geometry = useHeroGeometry();
  const reduced = useLabReducedMotion();
  const glState = useRef<{
    gl: WebGLRenderingContext;
    program: WebGLProgram;
    loc: Record<string, WebGLUniformLocation | null>;
    ratio: number;
  } | null>(null);
  const onUniformsRef = useRef(onUniforms);
  useEffect(() => {
    onUniformsRef.current = onUniforms;
  });

  useEffect(() => {
    const canvas = canvasRef.current!;
    const gl = canvas.getContext("webgl", { premultipliedAlpha: false, antialias: false, alpha: true });
    if (!gl) return;
    gl.getExtension("OES_standard_derivatives");
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error("[lab shader]", gl.getShaderInfoLog(s), src);
      return s;
    };
    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
    const lines = frag.split("\n");
    const extensions = lines.filter((l) => l.trim().startsWith("#extension"));
    const body = lines.filter((l) => !l.trim().startsWith("#extension"));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, [...extensions, "precision highp float;", ...body].join("\n")));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) console.error("[lab shader link]", gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const p = gl.getAttribLocation(program, "p");
    gl.enableVertexAttribArray(p);
    gl.vertexAttribPointer(p, 2, gl.FLOAT, false, 0, 0);

    const names = ["u_res", "u_time", "u_dpr", "u_car", "u_carC", "u_floor", "u_ground", "u_mouse", "u_scroll", "u_bg", "u_teal", "u_magenta", "u_blue", "u_navy"];
    const loc: Record<string, WebGLUniformLocation | null> = {};
    for (const n of names) loc[n] = gl.getUniformLocation(program, n);
    const set3 = (n: string, hex: string) => loc[n] && gl.uniform3fv(loc[n], hexToVec3(hex));
    set3("u_bg", PALETTE.bg);
    set3("u_teal", PALETTE.teal);
    set3("u_magenta", PALETTE.magenta);
    set3("u_blue", PALETTE.blue);
    set3("u_navy", PALETTE.navy);
    glState.current = { gl, program, loc, ratio: 1 };

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, maxDpr) * scale;
      const w = Math.max(1, Math.round(canvas.clientWidth * ratio));
      const h = Math.max(1, Math.round(canvas.clientHeight * ratio));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      glState.current!.ratio = ratio;
      gl.viewport(0, 0, w, h);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    return () => {
      ro.disconnect();
      // Don't loseContext() here: StrictMode re-runs this effect on the same canvas,
      // and getContext() would hand back the dead context. The browser frees it
      // when the canvas is removed.
      gl.deleteBuffer(buf);
      gl.deleteProgram(program);
      glState.current = null;
    };
  }, [frag, scale, maxDpr]);

  useFrameLoop((t) => {
    const s = glState.current;
    if (!s) return;
    const { gl, program, loc, ratio } = s;
    const g = geometry.current;
    const H = gl.drawingBufferHeight;
    const time = reduced ? 12 : t;
    gl.uniform2f(loc.u_res, gl.drawingBufferWidth, H);
    gl.uniform1f(loc.u_time, time);
    gl.uniform1f(loc.u_dpr, ratio);
    const c = g.car;
    gl.uniform4f(loc.u_car, c.l * ratio, H - (c.t + c.h) * ratio, c.w * ratio, c.h * ratio);
    gl.uniform2f(loc.u_carC, c.cx * ratio, H - c.cy * ratio);
    gl.uniform1f(loc.u_floor, H - c.floor * ratio);
    gl.uniform2f(loc.u_ground, c.gx * ratio, H - c.gy * ratio);
    gl.uniform3f(loc.u_mouse, g.pointer.x * ratio, H - g.pointer.y * ratio, g.pointer.active);
    gl.uniform1f(loc.u_scroll, g.scroll);
    onUniformsRef.current?.(gl, program, time);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }, canvasRef);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", ...style }}
    />
  );
}
