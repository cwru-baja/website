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

const BASE_R = 0.22;
const MAX_R = 0.38;
const HOVER_RADIUS = 6;
const MAGNETIC_RADIUS = 7; // SVG viewBox units
const CARD_W = 480;
const CARD_H = 330; // approx: header ~55px + 16:9 image ~270px + padding
const CARD_GAP = 18; // gap between cursor and card edge
const HANDOFF_GRACE_MS = 120;

interface Props {
  dots: [number, number, 0 | 1][];
  viewBox: string;
  competitions: CompetitionMarker[];
}

export function USADotMap({ dots, viewBox, competitions }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef(0);
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

    return () => { tween.kill(); };
  }, []);

  // Magnetic cursor + hover radius effect
  useEffect(() => {
    const svg = svgRef.current;
    const card = cardRef.current;
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

    svg.addEventListener("mouseenter", onMouseEnter, { once: true });
    svg.addEventListener("mousemove", onMouseMove);
    svg.addEventListener("mouseleave", onMouseLeave);

    return () => {
      cancelAnimationFrame(rafId);
      handoff.dispose();
      xTo.tween.kill();
      yTo.tween.kill();
      gsap.killTweensOf(card);
      svg.removeEventListener("mouseenter", onMouseEnter);
      svg.removeEventListener("mousemove", onMouseMove);
      svg.removeEventListener("mouseleave", onMouseLeave);
    };
  }, [competitions]);

  return (
    <>
      <svg
        ref={svgRef}
        viewBox={viewBox}
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto cursor-crosshair"
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

      <CompetitionCard
        ref={cardRef}
        transition={cardTransition}
        onIncomingReady={handleIncomingReady}
        onIncomingRevealed={handleIncomingRevealed}
      />
    </>
  );
}
