"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import gsap from "gsap";

// Initial width of the M logo mask (px). The SVG aspect ratio is ~2.55:1
// so at 320px wide the logo appears as roughly 320×126px centered on screen.
const INITIAL_SIZE = 320;
// Terminal size — large enough to clear any viewport diagonal
const FINAL_SIZE = 16000;
// SVG aspect ratio (width / height)
const ASPECT_RATIO = 2.544;

// Zoom origin as a fraction of the logo dimensions from top-left.
// (0.5, 0.5) = logo center. Adjust to pick any point on the logo.
// ~60% from left = middle of the second slanted line; 50% = vertical center.
const ZOOM_FX = 0.60;
const ZOOM_FY = 0.50;

let hasPlayed = false;

export default function LogoIntro() {
  const [show] = useState(!hasPlayed);
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const redLogoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!show) return;
    hasPlayed = true;

    const container = containerRef.current;
    const overlay = overlayRef.current;
    const redLogo = redLogoRef.current;
    if (!container || !overlay || !redLogo) return;
    overlay.style.willChange = "mask-size, mask-position";

    // Update mask-size AND mask-position together so the zoom appears to
    // originate from (ZOOM_FX, ZOOM_FY) within the logo, not from its center.
    //
    // Math: the desired zoom-origin point P is fixed at its initial screen
    // position. At mask-size = S, the mask top-left must be placed such that
    // P (a fixed fraction of the mask image) stays at that fixed screen coord.
    //
    //   mask_left = vw/2 + (ZOOM_FX - 0.5)*S0  -  ZOOM_FX * S
    //   mask_top  = vh/2 + (ZOOM_FY - 0.5)*S0/AR  -  ZOOM_FY * S/AR
    const setMask = (size: number) => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const maskLeft = vw / 2 + (ZOOM_FX - 0.5) * INITIAL_SIZE - ZOOM_FX * size;
      const maskTop =
        vh / 2 +
        ((ZOOM_FY - 0.5) * INITIAL_SIZE) / ASPECT_RATIO -
        (ZOOM_FY * size) / ASPECT_RATIO;

      const sizeStr = `${size}px, 100%`;
      const posStr = `${maskLeft}px ${maskTop}px, center center`;

      overlay.style.setProperty("mask-size", sizeStr);
      overlay.style.setProperty("-webkit-mask-size", sizeStr);
      overlay.style.setProperty("mask-position", posStr);
      overlay.style.setProperty("-webkit-mask-position", posStr);
    };

    // Set initial mask before animation starts
    setMask(INITIAL_SIZE);

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
          setMask(state.size);
        },
        onComplete() {
          overlay.style.willChange = "auto";
          container.style.display = "none";
        },
      },
      "-=0.25"
    );

    return () => {
      tl.kill();
      overlay.style.willChange = "auto";
    };
  }, [show]);

  if (!show) return null;

  return (
    <div
      ref={containerRef}
      className="pointer-events-none fixed inset-0 z-[9999]"
    >
      {/*
        Dark overlay — the "fly-through" layer.
        mask-composite: exclude inverts the M logo mask so that the M shape
        becomes a transparent hole while everything else stays opaque.
        Both mask-size and mask-position are animated by GSAP so the hole
        grows from the configured zoom-origin point on the logo.
      */}
      <div
        ref={overlayRef}
        className="logo-intro-mask absolute inset-0"
        style={
          { "--logo-intro-mask-size": `${INITIAL_SIZE}px` } as CSSProperties
        }
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
