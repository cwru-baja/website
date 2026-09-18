"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import gsap from "gsap";

import MLogo, { M_LOGO_ASPECT } from "@/components/MLogo";

// Initial width of the M logo mask (px). The SVG aspect ratio is ~2.55:1
// so at 320px wide the logo appears as roughly 320×126px centered on screen.
const INITIAL_SIZE = 320;
// Terminal size — large enough to clear any viewport diagonal
const FINAL_SIZE = 16000;
// Keep the reveal readable, then clear the screen quickly once the fly-out starts.
const FLY_OUT_DURATION = 0.9;
// SVG aspect ratio (width / height)
const ASPECT_RATIO = 2.544;

// Zoom origin as a fraction of the logo dimensions from top-left.
// (0.5, 0.5) = logo center. Adjust to pick any point on the logo.
// ~60% from left = middle of the second slanted line; 50% = vertical center.
const ZOOM_FX = 0.60;
const ZOOM_FY = 0.50;

// sessionStorage key. The intro replays in a new tab or a new browser session,
// but not on reloads or client-side navigations within the current one.
const SEEN_KEY = "mIntroSeen";
// <html data-intro> is rendered as "play" and rewritten to "skip" by the
// pre-paint script in layout.tsx. See globals.css for the rule it drives.
const INTRO_ATTR = "data-intro";
const SKIP = "skip";

// Mirrors the inline script in layout.tsx. The attribute is the fast path;
// the direct checks cover the case where that script did not run.
function shouldSkipIntro() {
  if (document.documentElement.getAttribute(INTRO_ATTR) === SKIP) return true;
  // GSAP writes inline styles, so the prefers-reduced-motion block in
  // globals.css cannot tame this animation — skip it outright instead.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
  try {
    return window.sessionStorage.getItem(SEEN_KEY) === "1";
  } catch {
    // Storage throws when the browser blocks site data; treat as not yet seen.
    return false;
  }
}

let hasPlayed = false;

export default function LogoIntro() {
  const [show] = useState(!hasPlayed);
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const logoImageRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!show) return;
    hasPlayed = true;

    if (shouldSkipIntro()) {
      // Setting the attribute rather than state keeps this out of React's
      // render path (no cascading render) and reuses the same CSS rule the
      // pre-paint script drives. It also re-applies "skip" after React's dev
      // remount resets <html> to its JSX-managed attributes.
      document.documentElement.setAttribute(INTRO_ATTR, SKIP);
      return;
    }

    // Marked at the start rather than on completion so a reload mid-flight
    // does not restart the animation.
    try {
      window.sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      // Non-fatal: the intro simply replays on the next load.
    }

    const container = containerRef.current;
    const overlay = overlayRef.current;
    const logo = logoRef.current;
    const logoImage = logoImageRef.current;
    if (!container || !overlay || !logo || !logoImage) return;
    overlay.style.willChange = "mask-size, mask-position";
    logo.style.willChange = "opacity";
    logoImage.style.willChange = "transform";

    // Scale the visible M around the same fixed point as the mask cutout.
    // A shared size state keeps both versions of the logo perfectly aligned
    // during the overlap between the fade and the fly-through.
    gsap.set(logoImage, {
      transformOrigin: `${ZOOM_FX * 100}% ${ZOOM_FY * 100}%`,
    });
    const setLogoScaleX = gsap.quickSetter(logoImage, "scaleX");
    const setLogoScaleY = gsap.quickSetter(logoImage, "scaleY");

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
      const logoScale = size / INITIAL_SIZE;
      setLogoScaleX(logoScale);
      setLogoScaleY(logoScale);
    };

    // Set initial mask before animation starts
    setMask(INITIAL_SIZE);

    const state = { size: INITIAL_SIZE };

    const tl = gsap.timeline({ delay: 0.35 });

    // Phase 1 → Phase 2: fade out the solid M logo
    tl.to(logo, {
      opacity: 0,
      duration: 0.45,
      ease: "power2.in",
    });

    // Phase 2 → Phase 3: scale the transparent hole with increasing acceleration.
    // Cubing progress keeps the beginning restrained, then ramps the mask's
    // speed sharply toward the end of the fly-out.
    // Overlaps with the fade so the expansion begins slightly before M fully disappears
    tl.to(
      state,
      {
        size: FINAL_SIZE,
        duration: FLY_OUT_DURATION,
        ease: (progress: number) => progress * progress * progress,
        onUpdate() {
          setMask(state.size);
        },
        onComplete() {
          overlay.style.willChange = "auto";
          logo.style.willChange = "auto";
          logoImage.style.willChange = "auto";
          container.style.display = "none";
        },
      },
      "-=0.25"
    );

    return () => {
      tl.kill();
      overlay.style.willChange = "auto";
      logo.style.willChange = "auto";
      logoImage.style.willChange = "auto";
    };
  }, [show]);

  if (!show) return null;

  return (
    <div
      ref={containerRef}
      className="logo-intro-root pointer-events-none fixed inset-0 z-[9999]"
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
        Solid M logo, in the livery colour — the visible "solid" phase.
        It sits above the overlay so that before the overlay's mask hole is
        visible, the user sees a clean M on a dark background.
        Once the M fades to 0, the transparent hole in the overlay takes over
        and the fly-through begins.
      */}
      <div
        ref={logoRef}
        className="absolute inset-0 flex items-center justify-center"
      >
        <MLogo
          ref={logoImageRef}
          aria-hidden="true"
          width={INITIAL_SIZE}
          height={INITIAL_SIZE / M_LOGO_ASPECT}
          className="text-livery"
        />
      </div>
    </div>
  );
}
