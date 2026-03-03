"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";

const PHOTOS = Array.from({ length: 20 }, (_, i) => `/images/about-${i + 1}.jpg`);

function shuffled<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

type CellDef = {
  startIndex: number;
  interval: number;
  gridArea: string;
  priority?: boolean;
};

const CELL_DEFS: CellDef[] = [
  { startIndex: 0,  interval: 5200, gridArea: "1 / 1 / 3 / 2", priority: true }, // tall left
  { startIndex: 5,  interval: 4100, gridArea: "1 / 2 / 2 / 4", priority: true }, // wide top-right
  { startIndex: 10, interval: 6300, gridArea: "2 / 2 / 3 / 3" },                  // small bottom-mid
  { startIndex: 15, interval: 3800, gridArea: "2 / 3 / 3 / 4" },                  // small bottom-right
];

function ShiftingCell({ photos, startIndex, interval, gridArea, priority }: CellDef & { photos: string[] }) {
  const [bottom, setBottom] = useState(photos[startIndex % photos.length]);
  const [top, setTop] = useState<string | null>(null);
  const [topVisible, setTopVisible] = useState(false);
  const idxRef = useRef(startIndex);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;

    const run = () => {
      idxRef.current = (idxRef.current + 1) % photos.length;
      const next = photos[idxRef.current];
      setTop(next);
      setTopVisible(false);
      // Double rAF ensures the element is painted at opacity:0 before transitioning
      requestAnimationFrame(() =>
        requestAnimationFrame(() => setTopVisible(true))
      );
      setTimeout(() => {
        setBottom(next);
        setTop(null);
        setTopVisible(false);
      }, 1000);
    };

    // Stagger initial fires so cells don't all shift simultaneously
    const initialDelay = Math.random() * 2500;
    const timeoutId = setTimeout(() => {
      run();
      intervalId = setInterval(run, interval);
    }, initialDelay);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [photos, interval]);

  return (
    <div className="relative overflow-hidden" style={{ gridArea }}>
      <Image
        src={bottom}
        alt=""
        fill
        className="object-cover"
        style={{ objectPosition: "center 30%" }}
        sizes="(max-width: 1024px) 50vw, 30vw"
        priority={priority}
      />
      {top && (
        <Image
          src={top}
          alt=""
          fill
          className="object-cover"
          style={{
            objectPosition: "center 30%",
            opacity: topVisible ? 1 : 0,
            transition: "opacity 900ms ease-in-out",
          }}
          sizes="(max-width: 1024px) 50vw, 30vw"
        />
      )}
    </div>
  );
}

export default function AboutBentoGrid() {
  const [photos] = useState(() => shuffled(PHOTOS));

  return (
    <div
      className="w-full h-full"
      style={{
        display: "grid",
        gridTemplateColumns: "1.4fr 1fr 1fr",
        gridTemplateRows: "1.2fr 1fr",
        gap: "3px",
      }}
    >
      {CELL_DEFS.map((def) => (
        <ShiftingCell key={def.gridArea} photos={photos} {...def} />
      ))}
    </div>
  );
}
