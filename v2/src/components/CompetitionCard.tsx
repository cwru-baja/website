"use client";

import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import Image from "next/image";

export interface CompetitionMarker {
  id: string;
  name: string;
  location: string;
  svgX: number;
  svgY: number;
}

// Images for each competition live in /public/images/competitions/{id}/
// Add files named 1.jpg, 2.jpg, 3.jpg … and list them here.
const img = (id: string, count: number) =>
  Array.from({ length: count }, (_, i) => `/images/competitions/${id}/${i + 1}.jpg`);

const IMAGES: Record<string, string[]> = {
  // Years competed: 2023, 2018, 2015
  oregon:       img("oregon",       3),
  // Years competed: 2023
  ohio:         img("ohio",         3),
  // Years competed: 2025
  carolina:     img("carolina",     3),
  // Years competed: 2025, 2018, 2015
  maryland:     img("maryland",     3),
  // Years competed: 2025, 2022
  arizona:      img("arizona",      3),
  // Years competed: 2024
  michigan:     img("michigan",     3),
  // Years competed: 2024
  williamsport: img("williamsport", 3),
  // Years competed: 2024, 2019, 2017, 2016
  california:   img("california",   3),
  // Years competed: 2023
  oshkosh:      img("oshkosh",      3),
  // Years competed: 2022, 2019, 2016
  tennessee:    img("tennessee",    3),
  // Years competed: 2022, 2019, 2016, 2013
  rochester:    img("rochester",    3),
  // Years competed: 2018, 2017, 2014
  kansas:       img("kansas",       3),
  // Years competed: 2015
  auburn:       img("auburn",       3),
  // Years competed: 2014
  illinois:     img("illinois",     3),
};

/** A single slot — manages its own image cycling. */
function SlotContent({ comp }: { comp: CompetitionMarker }) {
  const images = IMAGES[comp.id] ?? [];
  const [imgIdx, setImgIdx] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    const id = setInterval(() => setImgIdx((i) => (i + 1) % images.length), 1800);
    return () => clearInterval(id);
  }, [comp.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {/* Header */}
      <div className="bg-black/85 backdrop-blur-md px-3 py-2.5 border-b border-white/10">
        <p className="font-coolvetica text-white text-[11px] tracking-widest leading-tight uppercase">
          {comp.name}
        </p>
        <p className="text-white/45 text-[9px] tracking-wide mt-0.5 font-mono">
          {comp.location}
        </p>
      </div>

      {/* Images — 16:9 */}
      <div className="relative aspect-video bg-neutral-900">
        {images.map((src, i) => (
          <div
            key={src}
            className="absolute inset-0 transition-opacity duration-500"
            style={{ opacity: i === imgIdx ? 1 : 0 }}
          >
            <Image src={src} alt="" fill sizes="480px" className="object-cover" />
          </div>
        ))}

        {/* Dot indicators */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-1.5 py-2 bg-gradient-to-t from-black/60 to-transparent">
          {images.map((_, i) => (
            <div
              key={i}
              className="w-1 h-1 rounded-full transition-all duration-300"
              style={{
                backgroundColor: i === imgIdx ? "white" : "rgba(255,255,255,0.2)",
                transform: i === imgIdx ? "scale(1.4)" : "scale(1)",
              }}
            />
          ))}
        </div>
      </div>
    </>
  );
}

interface Props {
  comp: CompetitionMarker | null;
}

export const CompetitionCard = forwardRef<HTMLDivElement, Props>(
  function CompetitionCard({ comp }, ref) {
    // Two slots — we crossfade between them so there is never a dark flash
    // when switching between nearby competitions.
    const [slotA, setSlotA] = useState<CompetitionMarker | null>(null);
    const [slotB, setSlotB] = useState<CompetitionMarker | null>(null);
    const refA = useRef<HTMLDivElement>(null);
    const refB = useRef<HTMLDivElement>(null);
    const frontIsA = useRef(true); // which slot is currently on top
    const initialized = useRef(false);
    const prevId = useRef<string | null>(null);

    // useLayoutEffect flushes state updates synchronously before paint,
    // so the new slot content is in the DOM when GSAP runs — no flushSync needed.
    useLayoutEffect(() => {
      if (!comp || comp.id === prevId.current) return;
      prevId.current = comp.id;

      if (!initialized.current) {
        // First show — load into A, make it immediately visible (parent fades the container in)
        initialized.current = true;
        setSlotA(comp);
        gsap.set(refA.current, { opacity: 1 });
        frontIsA.current = true;
        return;
      }

      if (frontIsA.current) {
        // A is visible → load new comp into B, crossfade A → B
        setSlotB(comp);
        gsap.to(refA.current, { opacity: 0, duration: 0.2, ease: "power2.out" });
        gsap.fromTo(refB.current, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: "power2.in" });
        frontIsA.current = false;
      } else {
        // B is visible → load new comp into A, crossfade B → A
        setSlotA(comp);
        gsap.to(refB.current, { opacity: 0, duration: 0.2, ease: "power2.out" });
        gsap.fromTo(refA.current, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: "power2.in" });
        frontIsA.current = true;
      }
    }, [comp?.id]);

    return (
      <div
        ref={ref}
        className="fixed top-0 left-0 z-50 pointer-events-none w-[480px] rounded-xl overflow-hidden border border-white/15 shadow-2xl"
        style={{ willChange: "transform, opacity" }}
      >
        {/*
          Invisible height-setter: keeps the card's intrinsic dimensions
          stable while the absolute slots crossfade inside.
        */}
        <div className="invisible pointer-events-none select-none" aria-hidden>
          <div className="px-3 py-2.5">
            <p className="text-[11px] leading-tight">&#8203;</p>
            <p className="text-[9px] mt-0.5">&#8203;</p>
          </div>
          <div className="aspect-video" />
        </div>

        {/* Slot A */}
        <div ref={refA} className="absolute inset-0" style={{ opacity: 0 }}>
          {slotA && <SlotContent comp={slotA} />}
        </div>

        {/* Slot B */}
        <div ref={refB} className="absolute inset-0" style={{ opacity: 0 }}>
          {slotB && <SlotContent comp={slotB} />}
        </div>
      </div>
    );
  }
);
