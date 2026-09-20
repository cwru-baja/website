"use client";

import { useCallback, useRef, useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  CompetitionCard,
  preloadCompetitionImages,
  type CompetitionMarker,
} from "./CompetitionCard";
import {
  completeContentReveal,
  createContentTransition,
  markContentReady,
  type ContentTransitionState,
  type ContentTransitionToken,
} from "./contentTransition";
import { createHoverHandoffController } from "./hoverHandoff";
import { dockCard, nearestWithin, tapAction } from "./mapTouch";

const BASE_R = 0.22;
const MAX_R = 0.38;
const HOVER_RADIUS = 6;
const MAGNETIC_RADIUS = 7; // SVG viewBox units
const CARD_W = 480;
const CARD_H = 330; // approx: header ~55px + 16:9 image ~270px + padding
const CARD_GAP = 18; // gap between cursor and card edge
const HANDOFF_GRACE_MS = 120;

// Touch: a tap lands within this many screen px of a venue to pick it. Phone
// venues are 11-16 px apart, so the nearest one wins.
const TAP_RADIUS_PX = 24;
// A touch that travels further than this is a scroll or a swipe, not a tap.
const TAP_SLOP_PX = 10;
const DOCK_GAP = 12; // between the map and a docked card
const DOCK_MARGIN = 8; // between a docked card and the screen edges
// Scrolling the map this far closes a docked card. Anything less is jitter.
const DOCK_SCROLL_CLOSE_PX = 4;
// Mouse events this soon after a touch are the browser's emulation of it.
const COMPAT_MOUSE_WINDOW_MS = 800;
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
// Touch-first screens, where no mouseenter will warm the photo cache.
const TOUCH_FIRST = "(hover: none), (pointer: coarse)";

interface Props {
  dots: [number, number, 0 | 1][];
  viewBox: string;
  competitions: CompetitionMarker[];
}

export function USADotMap({ dots, viewBox, competitions }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef(0);
  const [vbX, vbY, vbW, vbH] = viewBox.split(/[\s,]+/).map(Number);
  const [cardTransition, setCardTransition] =
    useState<ContentTransitionState<CompetitionMarker> | null>(null);

  const handleIncomingReady = useCallback((token: ContentTransitionToken) => {
    setCardTransition((current) =>
      current ? markContentReady(current, token) : current,
    );
  }, []);

  const handleIncomingRevealed = useCallback((token: ContentTransitionToken) => {
    setCardTransition((current) =>
      current
        ? completeContentReveal(
            current,
            token,
            (left, right) => left.id === right.id,
          )
        : current,
    );
  }, []);

  // GSAP scroll entrance animation
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const svg = svgRef.current;
    if (!svg) return;

    const circles = svg.querySelectorAll<SVGCircleElement>(".dot");
    if (!circles.length) return;

    gsap.set(circles, { opacity: 0 });

    const tween = gsap.to(circles, {
      opacity: 1,
      duration: 0.3,
      stagger: { amount: 0.8, from: "random" },
      ease: "power2.out",
      scrollTrigger: {
        trigger: svg,
        start: "top 80%",
        toggleActions: "play none none none",
      },
    });

    // The touch venue markers arrive as the last dots do.
    const markers = markersRef.current;
    let markersTween: gsap.core.Tween | undefined;
    if (markers) {
      gsap.set(markers, { opacity: 0 });
      markersTween = gsap.to(markers, {
        opacity: 1,
        duration: 0.4,
        delay: 0.6,
        ease: "power2.out",
        scrollTrigger: {
          trigger: svg,
          start: "top 80%",
          toggleActions: "play none none none",
        },
      });
    }

    return () => {
      tween.kill();
      markersTween?.kill();
    };
  }, []);

  // Magnetic cursor + hover radius effect for a mouse; tap-to-dock for touch
  useEffect(() => {
    const svg = svgRef.current;
    const card = cardRef.current;
    const markers = markersRef.current;
    if (!svg || !card) return;

    const circles = Array.from(svg.querySelectorAll<SVGCircleElement>(".dot"));
    const positions = circles.map((c) => ({
      cx: parseFloat(c.getAttribute("cx")!),
      cy: parseFloat(c.getAttribute("cy")!),
    }));

    gsap.set(card, { opacity: 0, scale: 0.88, x: 0, y: 0 });

    const xTo = gsap.quickTo(card, "x", { duration: 0.4, ease: "power3.out" });
    const yTo = gsap.quickTo(card, "y", { duration: 0.4, ease: "power3.out" });

    let rafId: number;
    let shellGeneration = 0;
    let shellPhase: "hidden" | "showing" | "visible" | "hiding" = "hidden";
    // Whether the card sits above the cursor rather than below it.
    let above = false;
    // The competition the card's content currently holds, until a finished
    // fade-out clears it.
    let contentId: string | null = null;

    const placeCard = (anchorX: number, anchorY: number) => {
      // Narrower than the card plus margins, the card shrinks to fit (its CSS
      // width is min(480px, 100vw - 16px)) and loses height with its 16:9 photo.
      const cardW = Math.min(CARD_W, window.innerWidth - 16);
      const cardH = CARD_H - ((CARD_W - cardW) * 9) / 16;
      // Centered horizontally, clamped within the viewport with an 8px margin.
      const cardX = Math.max(
        8,
        Math.min(anchorX - cardW / 2, window.innerWidth - cardW - 8),
      );

      // Change sides only when the current one would overflow the viewport.
      // A fresh card starts below; hysteresis keeps cursor jitter near an edge
      // from flipping it back and forth.
      if (shellPhase === "hidden") above = false;
      if (!above && anchorY + CARD_GAP + cardH > window.innerHeight - 8) {
        above = true;
      } else if (above && anchorY - CARD_GAP - cardH < 8) {
        above = false;
      }
      const cardY = above
        ? anchorY - cardH - CARD_GAP
        : anchorY + CARD_GAP;

      // A visible card always glides. A fully hidden one is placed before it
      // fades in, so it never appears somewhere else and slides over.
      if (shellPhase === "hidden") {
        xTo(cardX, cardX);
        yTo(cardY, cardY);
      } else {
        xTo(cardX);
        yTo(cardY);
      }
    };

    const showCard = (comp: CompetitionMarker) => {
      // Only the content swaps on a competition change — the shell keeps its
      // opacity, scale and glide. flushSync commits the new name and image
      // before the shell tweens, so no frame shows stale or empty content.
      // First images are preloaded on map enter so the swap isn't blank.
      // Returning to the same competition mid fade-out keeps its content, so
      // a brief slip off the marker doesn't restart the photo carousel.
      if (comp.id !== contentId) {
        contentId = comp.id;
        const session = ++sessionRef.current;
        flushSync(() => setCardTransition(createContentTransition(comp, session)));
      }

      if (shellPhase === "showing" || shellPhase === "visible") return;

      const generation = ++shellGeneration;
      shellPhase = "showing";
      gsap.killTweensOf(card, "opacity,scale");
      gsap.to(card, {
        opacity: 1,
        scale: 1,
        duration: 0.22,
        ease: "power2.out",
        overwrite: "auto",
        onComplete: () => {
          if (handoff.current() !== null && generation === shellGeneration) {
            shellPhase = "visible";
          }
        },
      });
    };

    const hideCard = () => {
      const generation = ++shellGeneration;
      shellPhase = "hiding";
      gsap.killTweensOf(card, "opacity,scale");
      gsap.to(card, {
        opacity: 0,
        scale: 0.88,
        duration: 0.12,
        ease: "power2.in",
        overwrite: "auto",
        onComplete: () => {
          if (handoff.current() === null && generation === shellGeneration) {
            shellPhase = "hidden";
            contentId = null;
            setCardTransition(null);
          }
        },
      });
    };

    const handoff = createHoverHandoffController<CompetitionMarker>({
      delayMs: HANDOFF_GRACE_MS,
      isSame: (current, next) => current.id === next.id,
      onActivate: showCard,
      onDismiss: hideCard,
    });

    const onMouseMove = (e: MouseEvent) => {
      cancelAnimationFrame(rafId);
      const ctm = svg.getScreenCTM();
      if (!ctm) return;

      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const { x: mx, y: my } = pt.matrixTransform(ctm.inverse());

      // Resolve hover state synchronously so a target entered near the end of
      // the grace window cancels dismissal before the grace timer can fire.
      let nearestComp: CompetitionMarker | null = null;
      let nearestDist = Infinity;
      for (const comp of competitions) {
        const dx = comp.svgX - mx;
        const dy = comp.svgY - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestComp = comp;
        }
      }

      const hoveredComp = nearestComp && nearestDist < MAGNETIC_RADIUS ? nearestComp : null;
      if (hoveredComp) {
        const cpt = svg.createSVGPoint();
        cpt.x = hoveredComp.svgX;
        cpt.y = hoveredComp.svgY;
        const compScreen = cpt.matrixTransform(ctm);

        const t = 1 - nearestDist / MAGNETIC_RADIUS;
        placeCard(
          e.clientX + (compScreen.x - e.clientX) * t * 0.5,
          e.clientY + (compScreen.y - e.clientY) * t * 0.5,
        );
        handoff.activate(hoveredComp);
      } else {
        // Keep following the cursor across empty map while the card is still
        // on screen, so reaching the next competition never means a long
        // catch-up slide.
        if (shellPhase !== "hidden") placeCard(e.clientX, e.clientY);
        handoff.schedule();
      }

      rafId = requestAnimationFrame(() => {
        // Dot hover radius — grow dots near cursor
        for (let i = 0; i < circles.length; i++) {
          const dx = positions[i].cx - mx;
          const dy = positions[i].cy - my;
          const dist = Math.sqrt(dx * dx + dy * dy);
          circles[i].setAttribute(
            "r",
            dist < HOVER_RADIUS
              ? (BASE_R + (MAX_R - BASE_R) * (1 - dist / HOVER_RADIUS)).toFixed(3)
              : BASE_R.toFixed(3)
          );
        }
      });
    };

    const onMouseEnter = () => preloadCompetitionImages(competitions);

    const onMouseLeave = () => {
      cancelAnimationFrame(rafId);
      for (const c of circles) c.setAttribute("r", BASE_R.toFixed(3));
      handoff.dismissNow();
    };

    // ---- Touch and pen: tap a venue to dock its card ----------------------
    // The docked card holds one position until it closes, so tapping another
    // venue only swaps its content. It closes on a second tap of its venue, a
    // tap anywhere else, Escape, scrolling or a resize.

    // The venue whose card is docked, or null.
    let docked: CompetitionMarker | null = null;
    let dockedMapTop = 0;
    let dockedScale = 1;
    let tap: { id: number; x: number; y: number } | null = null;

    const reducedMotion = () => window.matchMedia(REDUCED_MOTION).matches;

    const markSelected = (id: string | null) => {
      if (!markers) return;
      for (const marker of markers.children) {
        // The data-selected variant (shadcn's) matches data-selected="true".
        if ((marker as HTMLElement).dataset.venue === id) {
          marker.setAttribute("data-selected", "true");
        } else {
          marker.removeAttribute("data-selected");
        }
      }
    };

    // Bottom of the fixed navbar, so a card docked above the map clears it.
    const topInset = () => {
      let inset = 0;
      for (const el of document.querySelectorAll("nav, header")) {
        if (getComputedStyle(el).position !== "fixed") continue;
        const rect = el.getBoundingClientRect();
        if (rect.top <= 0 && rect.bottom < window.innerHeight / 2) {
          inset = Math.max(inset, rect.bottom);
        }
      }
      return inset + DOCK_MARGIN;
    };

    const openDocked = (comp: CompetitionMarker, venue: { x: number; y: number }) => {
      // A mouse hover card (touchscreen laptops) gives way to the docked one.
      if (handoff.current() !== null) handoff.dismissNow();

      const mapRect = svg.getBoundingClientRect();
      const dock = dockCard({
        map: mapRect,
        // Layout size, unaffected by the scale transform. The card's height is
        // set by its invisible sizer, so it's the same with or without content.
        card: { width: card.offsetWidth, height: card.offsetHeight },
        viewport: { width: window.innerWidth, height: window.innerHeight },
        venueX: venue.x,
        venueY: venue.y,
        topInset: topInset(),
        gap: DOCK_GAP,
        margin: DOCK_MARGIN,
      });

      docked = comp;
      dockedMapTop = mapRect.top;
      dockedScale = dock.scale;
      markSelected(comp.id);
      // Catch taps on the card itself, so they don't close it or reach
      // whatever is underneath.
      card.style.pointerEvents = "auto";

      if (comp.id !== contentId) {
        contentId = comp.id;
        const session = ++sessionRef.current;
        flushSync(() => setCardTransition(createContentTransition(comp, session)));
      }

      const reduce = reducedMotion();
      const generation = ++shellGeneration;
      const wasHidden = shellPhase === "hidden";
      shellPhase = "showing";
      gsap.killTweensOf(card, "opacity,scale");
      if (wasHidden) {
        // Placed before it fades in, like the hover card.
        xTo(dock.x, dock.x);
        yTo(dock.y, dock.y);
        gsap.set(card, { scale: reduce ? dock.scale : dock.scale * 0.88 });
      } else {
        xTo(dock.x);
        yTo(dock.y);
      }
      gsap.to(card, {
        opacity: 1,
        scale: dock.scale,
        duration: reduce ? 0 : 0.22,
        ease: "power2.out",
        overwrite: "auto",
        onComplete: () => {
          if (docked !== null && generation === shellGeneration) {
            shellPhase = "visible";
          }
        },
      });
    };

    const swapDocked = (comp: CompetitionMarker) => {
      // Content only: the card's position, scale and opacity are untouched.
      docked = comp;
      markSelected(comp.id);
      contentId = comp.id;
      const session = ++sessionRef.current;
      flushSync(() => setCardTransition(createContentTransition(comp, session)));
    };

    const closeDocked = () => {
      if (docked === null) return;
      docked = null;
      markSelected(null);
      card.style.pointerEvents = "";

      const reduce = reducedMotion();
      const generation = ++shellGeneration;
      shellPhase = "hiding";
      gsap.killTweensOf(card, "opacity,scale");
      gsap.to(card, {
        opacity: 0,
        scale: reduce ? dockedScale : dockedScale * 0.88,
        duration: reduce ? 0 : 0.12,
        ease: "power2.in",
        overwrite: "auto",
        onComplete: () => {
          if (
            docked === null &&
            handoff.current() === null &&
            generation === shellGeneration
          ) {
            shellPhase = "hidden";
            contentId = null;
            setCardTransition(null);
            // Leave the shell as the hover card expects to find it.
            gsap.set(card, { scale: 0.88 });
          }
        },
      });
    };

    const onTap = (x: number, y: number) => {
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const venues = competitions.map((comp) => {
        const pt = svg.createSVGPoint();
        pt.x = comp.svgX;
        pt.y = comp.svgY;
        const screen = pt.matrixTransform(ctm);
        return { comp, x: screen.x, y: screen.y };
      });
      const hit = nearestWithin(venues, x, y, TAP_RADIUS_PX);

      switch (tapAction(docked?.id ?? null, hit?.comp.id ?? null)) {
        case "open":
          openDocked(hit!.comp, hit!);
          break;
        case "swap":
          swapDocked(hit!.comp);
          break;
        case "close":
          closeDocked();
          break;
      }
    };

    // ---- Input routing ----------------------------------------------------
    // A mouse keeps the hover path on the same mouse events as ever (pointer
    // events would change it: their coordinates are fractional). A tap is
    // followed by compatibility mouse events (mouseover, mousemove, ...); a
    // mousemove from one would open a hover card that no mouseleave ever
    // closes, so mouse events straight after a touch are dropped. Safari has
    // no sourceCapabilities, hence the time window.
    let touchedAt = -Infinity;

    const noteTouch = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") touchedAt = performance.now();
    };

    const isCompatMouse = (e: MouseEvent) =>
      performance.now() - touchedAt < COMPAT_MOUSE_WINDOW_MS ||
      (e as MouseEvent & { sourceCapabilities?: { firesTouchEvents?: boolean } })
        .sourceCapabilities?.firesTouchEvents === true;

    const onMouseMoveFromMouse = (e: MouseEvent) => {
      if (isCompatMouse(e)) return;
      // A mouse on a touchscreen laptop takes over from a docked card.
      if (docked !== null) closeDocked();
      onMouseMove(e);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" || !e.isPrimary) {
        tap = null;
        return;
      }
      preloadCompetitionImages(competitions);
      tap = { id: e.pointerId, x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      if (tap === null || e.pointerId !== tap.id) return;
      const start = tap;
      tap = null;
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > TAP_SLOP_PX) return;
      onTap(start.x, start.y);
    };

    const onPointerCancel = (e: PointerEvent) => {
      // The browser took the touch for scrolling or zooming.
      if (tap !== null && e.pointerId === tap.id) tap = null;
    };

    // Any press outside the map and the card closes it. Presses on the map are
    // taps, handled on pointerup.
    const onDocumentPointerDown = (e: PointerEvent) => {
      noteTouch(e);
      if (docked === null) return;
      const target = e.target as Node | null;
      if (target && (svg.contains(target) || card.contains(target))) return;
      closeDocked();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDocked();
    };

    // Closes when the map moves on screen, not on any change to scrollY:
    // scroll anchoring changes scrollY when something above resizes (the race
    // countdown wraps as its digits tick on a phone) while the map holds still.
    const onScroll = () => {
      if (
        docked !== null &&
        Math.abs(svg.getBoundingClientRect().top - dockedMapTop) >
          DOCK_SCROLL_CLOSE_PX
      ) {
        closeDocked();
      }
    };

    // The dock was worked out for the old viewport.
    const onResize = () => closeDocked();

    // Phones have no mouseenter to warm the photo cache, so warm it as the
    // map comes into view; the first touch on the map does it too.
    let preloadObserver: IntersectionObserver | undefined;
    if (
      window.matchMedia(TOUCH_FIRST).matches &&
      typeof IntersectionObserver !== "undefined"
    ) {
      preloadObserver = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          preloadCompetitionImages(competitions);
          preloadObserver?.disconnect();
        },
        { rootMargin: "200px 0px" },
      );
      preloadObserver.observe(svg);
    }

    svg.addEventListener("mouseenter", onMouseEnter, { once: true });
    svg.addEventListener("mousemove", onMouseMoveFromMouse);
    svg.addEventListener("mouseleave", onMouseLeave);
    svg.addEventListener("pointerdown", onPointerDown);
    svg.addEventListener("pointerup", onPointerUp);
    svg.addEventListener("pointercancel", onPointerCancel);
    document.addEventListener("pointerdown", onDocumentPointerDown, true);
    document.addEventListener("pointerup", noteTouch, true);
    document.addEventListener("pointercancel", noteTouch, true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(rafId);
      handoff.dispose();
      xTo.tween.kill();
      yTo.tween.kill();
      gsap.killTweensOf(card);
      card.style.pointerEvents = "";
      markSelected(null);
      preloadObserver?.disconnect();
      svg.removeEventListener("mouseenter", onMouseEnter);
      svg.removeEventListener("mousemove", onMouseMoveFromMouse);
      svg.removeEventListener("mouseleave", onMouseLeave);
      svg.removeEventListener("pointerdown", onPointerDown);
      svg.removeEventListener("pointerup", onPointerUp);
      svg.removeEventListener("pointercancel", onPointerCancel);
      document.removeEventListener("pointerdown", onDocumentPointerDown, true);
      document.removeEventListener("pointerup", noteTouch, true);
      document.removeEventListener("pointercancel", noteTouch, true);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [competitions]);

  return (
    <>
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={viewBox}
          xmlns="http://www.w3.org/2000/svg"
          // manipulation: no double-tap zoom when a venue is tapped twice.
          className="w-full h-auto cursor-crosshair touch-manipulation"
        >
          {dots.map(([cx, cy, isVenue], i) => (
            <circle
              key={i}
              className={isVenue ? "dot fill-livery-pop" : "dot"}
              cx={cx}
              cy={cy}
              r={BASE_R}
              fill={isVenue ? undefined : "rgba(255,255,255,0.5)"}
            />
          ))}
        </svg>

        {/* Venue markers sized in screen pixels. The map's own venue dots are
            about a pixel across on a phone, so small and touch screens show
            these instead; elsewhere only a selected venue's ring shows. */}
        <div
          ref={markersRef}
          aria-hidden
          className="pointer-events-none absolute inset-0"
        >
          {competitions.map((comp) => (
            <span
              key={comp.id}
              data-venue={comp.id}
              className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-livery-pop opacity-0 shadow-[0_0_0_2px_rgba(0,0,0,0.55)] transition-[background-color] duration-150 max-md:opacity-100 pointer-coarse:opacity-100 data-selected:bg-white data-selected:opacity-100 motion-reduce:transition-none after:absolute after:top-1/2 after:left-1/2 after:size-[18px] after:-translate-x-1/2 after:-translate-y-1/2 after:rounded-full after:border-[1.5px] after:border-white after:opacity-0 after:transition-opacity after:duration-150 data-selected:after:opacity-100 motion-reduce:after:transition-none"
              style={{
                left: `${((comp.svgX - vbX) / vbW) * 100}%`,
                top: `${((comp.svgY - vbY) / vbH) * 100}%`,
              }}
            />
          ))}
        </div>
      </div>

      <CompetitionCard
        ref={cardRef}
        transition={cardTransition}
        onIncomingReady={handleIncomingReady}
        onIncomingRevealed={handleIncomingRevealed}
      />
    </>
  );
}
