"use client";

import { useCallback, useRef, useEffect, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { CompetitionCard, type CompetitionMarker } from "./CompetitionCard";
import {
  completeContentReveal,
  createContentTransition,
  markContentReady,
  requestContentTransition,
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
const HANDOFF_GRACE_MS = 250;

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

    const showCard = (comp: CompetitionMarker, wasActive: boolean) => {
      const session = ++sessionRef.current;
      setCardTransition((current) => {
        if (!wasActive || current === null) {
          return createContentTransition(comp, session);
        }

        return requestContentTransition(
          current,
          comp,
          (left, right) => left.id === right.id,
        );
      });

      // A normal active-to-active handoff changes content only. The shell's
      // opacity and scale remain completely untouched.
      if (wasActive && (shellPhase === "showing" || shellPhase === "visible")) {
        return;
      }

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
        duration: 0.18,
        ease: "power2.in",
        overwrite: "auto",
        onComplete: () => {
          if (handoff.current() === null && generation === shellGeneration) {
            shellPhase = "hidden";
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
      // the grace window cancels dismissal before the 250 ms timer can fire.
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
        handoff.activate(hoveredComp);
      } else {
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

        if (hoveredComp) {
          const cpt = svg.createSVGPoint();
          cpt.x = hoveredComp.svgX;
          cpt.y = hoveredComp.svgY;
          const compScreen = cpt.matrixTransform(ctm);

          const t = 1 - nearestDist / MAGNETIC_RADIUS;
          const pulledX = e.clientX + (compScreen.x - e.clientX) * t * 0.5;
          const pulledY = e.clientY + (compScreen.y - e.clientY) * t * 0.5;

          // Default: centered horizontally, below cursor
          let cardX = pulledX - CARD_W / 2;
          let cardY = pulledY + CARD_GAP;

          // Clamp horizontal — keep within viewport with 8px margin
          const vw = window.innerWidth;
          cardX = Math.max(8, Math.min(cardX, vw - CARD_W - 8));

          // Flip above cursor if card would overflow bottom of viewport
          if (cardY + CARD_H > window.innerHeight - 8) {
            cardY = pulledY - CARD_H - CARD_GAP;
          }

          xTo(cardX);
          yTo(cardY);
        }
      });
    };

    const onMouseLeave = () => {
      cancelAnimationFrame(rafId);
      for (const c of circles) c.setAttribute("r", BASE_R.toFixed(3));
      handoff.dismissNow();
    };

    svg.addEventListener("mousemove", onMouseMove);
    svg.addEventListener("mouseleave", onMouseLeave);

    return () => {
      cancelAnimationFrame(rafId);
      handoff.dispose();
      xTo.tween.kill();
      yTo.tween.kill();
      gsap.killTweensOf(card);
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
        {dots.map(([cx, cy, isRed], i) => (
          <circle
            key={i}
            className="dot"
            cx={cx}
            cy={cy}
            r={BASE_R}
            fill={isRed ? "#bc2121" : "rgba(255,255,255,0.5)"}
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
