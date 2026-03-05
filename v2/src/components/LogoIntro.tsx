"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

// Initial width of the M logo mask (px). The SVG aspect ratio is ~2.55:1
// so at 320px wide the logo appears as roughly 320×126px centered on screen.
const INITIAL_SIZE = 320;
// Terminal size — large enough to clear any viewport diagonal
const FINAL_SIZE = 16000;

export default function LogoIntro() {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const redLogoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const overlay = overlayRef.current;
    const redLogo = redLogoRef.current;
    if (!container || !overlay || !redLogo) return;

    // Helper: update both standard and webkit mask-size simultaneously
    const setMaskSize = (px: number) => {
      const val = `${px}px, 100%`;
      overlay.style.setProperty("mask-size", val);
      overlay.style.setProperty("-webkit-mask-size", val);
    };

    // Ensure initial mask-size is set before animation starts
    setMaskSize(INITIAL_SIZE);

    const state = { size: INITIAL_SIZE };

    const tl = gsap.timeline({ delay: 0.35 });

    // Phase 1 → Phase 2: fade out the red M logo
    tl.to(redLogo, {
      opacity: 0,
      duration: 0.45,
      ease: "power2.in",
    });

    // Phase 2 → Phase 3: exponentially scale the transparent hole (fly-through)
    // Overlaps with the fade so the expansion begins slightly before M fully disappears
    tl.to(
      state,
      {
        size: FINAL_SIZE,
        duration: 1.55,
        ease: "power4.in",
        onUpdate() {
          setMaskSize(state.size);
        },
        onComplete() {
          container.style.display = "none";
        },
      },
      "-=0.25"
    );

    return () => {
      tl.kill();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none fixed inset-0 z-[9999]"
    >
      {/*
        Dark overlay — the "fly-through" layer.
        mask-composite: exclude inverts the M logo mask so that the M shape
        becomes a transparent hole while everything else stays opaque.
        As GSAP scales the first mask layer from INITIAL_SIZE → FINAL_SIZE,
        the hole expands exponentially until the entire viewport is revealed.
      */}
      <div
        ref={overlayRef}
        className="absolute inset-0"
        style={{
          backgroundColor: "#0a0a0a",
          maskImage:
            "url(/logo/team/m-logo.svg), linear-gradient(black, black)",
          WebkitMaskImage:
            "url(/logo/team/m-logo.svg), linear-gradient(black, black)",
          // Standard spec: 'exclude' = XOR (inverts the logo mask)
          maskComposite: "exclude",
          // Safari uses older keyword
          WebkitMaskComposite: "xor",
          maskPosition: "center, center",
          WebkitMaskPosition: "center, center",
          maskRepeat: "no-repeat, no-repeat",
          WebkitMaskRepeat: "no-repeat, no-repeat",
          // Initial size — will be updated by GSAP onUpdate
          maskSize: `${INITIAL_SIZE}px, 100%`,
          willChange: "mask-size",
          transform: "translateZ(0)",
          backfaceVisibility: "hidden",
        }}
      />

      {/*
        Red M logo — the visible "solid red" phase.
        It sits above the overlay so that before the overlay's mask hole is
        visible, the user sees a clean red M on a dark background.
        Once the M fades to 0, the transparent hole in the overlay takes over
        and the fly-through begins.
      */}
      <div
        ref={redLogoRef}
        className="absolute inset-0 flex items-center justify-center"
      >
        {/* SVG aspect ratio: 86.032 × 33.810mm ≈ 2.544:1 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo/team/m-logo.svg"
          alt=""
          width={INITIAL_SIZE}
          style={{ height: "auto" }}
        />
      </div>
    </div>
  );
}
