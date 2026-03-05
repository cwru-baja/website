"use client";

import { useRef, useEffect, useCallback } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";

gsap.registerPlugin(ScrollTrigger, DrawSVGPlugin);

const TOTAL_FRAMES = 250;
const LINE_PX = 64; // connector line length in px

const frameUrl = (i: number) =>
  `/250-frames/${String(i + 1).padStart(4, "0")}.webp`;

// ─── Hotspot config ───────────────────────────────────────────────────────────
// x / y   : anchor position as % of canvas (tune in browser)
// frameRange : [firstFrame, lastFrame] the pointer is active  (0-indexed)
// side    : which direction the connector extends
interface Hotspot {
  id: string;
  frameRange: [number, number];
  x: number;
  y: number;
  side: "left" | "right";
  label: string;
  description: string;
}

const HOTSPOTS: Hotspot[] = [
  {
    id: "engine",
    frameRange: [10, 70],
    x: 58, y: 52,
    side: "right",
    label: "Engine",
    description: "10 HP Briggs & Stratton 305cc",
  },
  {
    id: "suspension",
    frameRange: [60, 130],
    x: 28, y: 66,
    side: "left",
    label: "Suspension",
    description: "Double A-arm with coilover shocks",
  },
  {
    id: "frame",
    frameRange: [110, 175],
    x: 50, y: 38,
    side: "right",
    label: "Frame",
    description: "4130 chromoly steel roll cage",
  },
  {
    id: "drivetrain",
    frameRange: [165, 235],
    x: 52, y: 64,
    side: "left",
    label: "Drivetrain",
    description: "CVT with limited-slip differential",
  },
];
// ─────────────────────────────────────────────────────────────────────────────

export default function CarSequence() {
  const sectionRef   = useRef<HTMLDivElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const imagesRef    = useRef<HTMLImageElement[]>([]);
  const drawnFrame   = useRef(-1);

  // Per-hotspot refs
  const pathRefs     = useRef<(SVGPathElement | null)[]>([]);
  const termRefs     = useRef<(SVGCircleElement | null)[]>([]);   // terminal dot on line
  const labelRefs    = useRef<(HTMLDivElement | null)[]>([]);
  const timelinesRef = useRef<gsap.core.Timeline[]>([]);

  // ── Canvas draw ─────────────────────────────────────────────────────────────
  const drawFrame = useCallback((index: number) => {
    if (index === drawnFrame.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = imagesRef.current[index];
    if (!img?.complete || !img.naturalWidth) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    drawnFrame.current = index;
  }, []);

  // ── Image preload ────────────────────────────────────────────────────────────
  useEffect(() => {
    const imgs: HTMLImageElement[] = [];
    for (let i = 0; i < TOTAL_FRAMES; i++) {
      const img = new Image();
      img.src = frameUrl(i);
      if (i === 0) {
        img.onload = () => {
          const canvas = canvasRef.current;
          if (canvas) {
            canvas.width  = img.naturalWidth;
            canvas.height = img.naturalHeight;
          }
          drawFrame(0);
        };
      }
      imgs.push(img);
    }
    imagesRef.current = imgs;
  }, [drawFrame]);

  // ── GSAP ─────────────────────────────────────────────────────────────────────
  useGSAP(() => {
    // Build a paused timeline per hotspot.
    // Each timeline describes the full enter → hold → exit sequence.
    // We scrub it via .progress() based on the current frame.
    timelinesRef.current = HOTSPOTS.map((_, i) => {
      const path  = pathRefs.current[i];
      const term  = termRefs.current[i];
      const label = labelRefs.current[i];
      if (!path || !label) return gsap.timeline({ paused: true });

      // Start state
      gsap.set(path,  { drawSVG: "0% 0%" });
      gsap.set(term,  { opacity: 0, scale: 0, transformOrigin: "center" });
      gsap.set(label, { opacity: 0, x: 0 });

      const tl = gsap.timeline({ paused: true });

      // 1. Line draws out from the dot toward the label
      tl.to(path, {
        drawSVG: "0% 100%",
        duration: 0.45,
        ease: "power2.out",
      });

      // 2. Terminal dot pops in at the end of the line
      tl.to(term, {
        opacity: 1,
        scale: 1,
        duration: 0.2,
        ease: "back.out(2)",
      }, "-=0.1");

      // 3. Label fades + slides in
      tl.to(label, {
        opacity: 1,
        x: 0,
        duration: 0.25,
        ease: "power1.out",
      }, "-=0.15");

      // 4. Hold
      tl.to({}, { duration: 0.55 });

      // 5. Label fades out
      tl.to(label, { opacity: 0, duration: 0.2 });

      // 6. Terminal dot disappears
      tl.to(term, { opacity: 0, scale: 0, duration: 0.15 }, "-=0.1");

      // 7. Line retracts back to the dot
      tl.to(path, {
        drawSVG: "0% 0%",
        duration: 0.35,
        ease: "power2.in",
      });

      return tl;
    });

    // Main scroll-scrub that drives both the canvas frame and all timelines
    const obj = { frame: 0 };

    gsap.to(obj, {
      frame: TOTAL_FRAMES - 1,
      ease: "none",
      scrollTrigger: {
        trigger: sectionRef.current,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.3,
      },
      onUpdate() {
        const frame = Math.round(obj.frame);
        drawFrame(frame);

        HOTSPOTS.forEach((hs, i) => {
          const tl = timelinesRef.current[i];
          if (!tl) return;
          const [start, end] = hs.frameRange;
          const p =
            frame < start || frame > end
              ? 0
              : (frame - start) / (end - start);
          tl.progress(p);
        });
      },
    });
  }, { scope: sectionRef });

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div ref={sectionRef} style={{ height: "500vh" }}>
      <div className="sticky top-0 h-screen flex items-center justify-center bg-bg overflow-hidden">

        {/* inline-block so the overlay covers exactly the canvas bounds */}
        <div className="relative" style={{ display: "inline-block", lineHeight: 0 }}>
          <canvas
            ref={canvasRef}
            style={{ maxWidth: "100vw", maxHeight: "100vh", display: "block" }}
          />

          {/* Hotspot overlay */}
          <div className="absolute inset-0 pointer-events-none select-none">
            {HOTSPOTS.map((hs, i) => {
              const isRight = hs.side === "right";

              return (
                <div
                  key={hs.id}
                  className="absolute"
                  style={{ left: `${hs.x}%`, top: `${hs.y}%` }}
                >
                  {/* Anchor dot on the car */}
                  <div className="absolute -translate-x-1/2 -translate-y-1/2 w-[7px] h-[7px] rounded-full bg-red ring-[3px] ring-red/30" />

                  {/* Connector + label — flex row, direction mirrors side */}
                  <div
                    className={`absolute top-1/2 -translate-y-1/2 flex items-center ${
                      isRight ? "left-0 flex-row" : "right-0 flex-row-reverse"
                    }`}
                    style={{ [isRight ? "paddingLeft" : "paddingRight"]: 10 }}
                  >
                    {/* DrawSVG line */}
                    <svg
                      width={LINE_PX}
                      height={2}
                      fill="none"
                      style={{ overflow: "visible", flexShrink: 0 }}
                    >
                      <path
                        ref={(el) => { pathRefs.current[i] = el; }}
                        // Right: draws left→right (dot→label)
                        // Left:  draws right→left (dot→label)
                        d={isRight ? `M 0 1 H ${LINE_PX}` : `M ${LINE_PX} 1 H 0`}
                        stroke="rgba(255,255,255,0.35)"
                        strokeWidth="1"
                        strokeLinecap="round"
                      />
                      {/* Terminal dot at label end of line */}
                      <circle
                        ref={(el) => { termRefs.current[i] = el; }}
                        cx={isRight ? LINE_PX : 0}
                        cy={1}
                        r={2.5}
                        fill="rgba(255,255,255,0.5)"
                      />
                    </svg>

                    {/* Label */}
                    <div
                      ref={(el) => { labelRefs.current[i] = el; }}
                      className={`whitespace-nowrap ${isRight ? "pl-3" : "pr-3 text-right"}`}
                    >
                      <p className="font-coolvetica text-[0.6rem] tracking-[0.22em] uppercase text-white leading-none">
                        {hs.label}
                      </p>
                      <p className="text-[0.57rem] text-white/38 mt-[3px] tracking-wide">
                        {hs.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
