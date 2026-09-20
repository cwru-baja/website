"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { labSequence } from "./sequence";

const COLUMNS = [
  {
    id: "today",
    label: "Today",
    note: "16:9 frames, letterboxed on a phone",
    root: "/renders-sr26/",
    contain: true,
  },
  {
    id: "k055",
    label: "K 0.55",
    note: "One setting everywhere. The whole car fits every shot (a few orbit frames lose up to 1.4% on one side).",
    root: "/renders-sr26/portrait-preview/k055/",
    contain: false,
  },
  {
    id: "k070",
    label: "K 0.70",
    note: "One setting everywhere. Closeups 27% bigger than K 0.55; side views lose about 9% a side, orbit frame 24 up to 15%.",
    root: "/renders-sr26/portrait-preview/k070/",
    contain: false,
  },
  {
    id: "kvar",
    label: "K per shot",
    note: "0.70 through brakes, frame and drivetrain; 0.75 at the wheel; 0.55 for the suspension and last orbit. Zoom changes only while orbiting or nearly stopped.",
    root: "/renders-sr26/portrait-preview/kvar/",
    contain: false,
  },
] as const;

type ColumnId = (typeof COLUMNS)[number]["id"];
type LoadState = { loaded: number; missing: number; total: number };

// Scroll per frame. Scrolling is the scrubber, as on the real page.
const STEP_PX = 22;
const CONCURRENCY = 6;

export default function PortraitLab() {
  const frames = useMemo(() => labSequence(), []);
  const [index, setIndex] = useState(0);
  const [phoneColumn, setPhoneColumn] = useState<ColumnId>("k055");
  const [load, setLoad] = useState<Record<string, LoadState>>({});

  // Scroll position is the source of truth; the slider and keys move it.
  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? window.scrollY / max : 0;
      setIndex(Math.min(frames.length - 1, Math.round(progress * (frames.length - 1))));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [frames.length]);

  const goTo = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(frames.length - 1, next));
      const max = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo({ top: (max * clamped) / Math.max(frames.length - 1, 1), behavior: "instant" });
    },
    [frames.length],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const step = event.shiftKey ? 10 : 1;
      if (event.key === "ArrowRight") goTo(index + step);
      else if (event.key === "ArrowLeft") goTo(index - step);
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goTo, index]);

  // Preload and decode every frame of every column, and keep them, so
  // scrubbing never waits. Local only; a few tens of MB.
  useEffect(() => {
    let cancelled = false;
    const keep: HTMLImageElement[] = [];
    const paths = [
      ...new Set(frames.flatMap((frame) => [frame.base, ...(frame.overlay ? [frame.overlay.path] : [])])),
    ];
    for (const column of COLUMNS) {
      const state: LoadState = { loaded: 0, missing: 0, total: paths.length };
      const queue = [...paths];
      const publish = () => {
        if (!cancelled) setLoad((current) => ({ ...current, [column.id]: { ...state } }));
      };
      const next = async (): Promise<void> => {
        const path = queue.shift();
        if (path === undefined || cancelled) return;
        const image = new Image();
        image.src = column.root + path;
        keep.push(image);
        try {
          await image.decode();
          state.loaded += 1;
        } catch {
          state.missing += 1;
        }
        publish();
        return next();
      };
      publish();
      for (let i = 0; i < CONCURRENCY; i += 1) void next();
    }
    return () => {
      cancelled = true;
      keep.length = 0;
    };
  }, [frames]);

  const frame = frames[index];

  return (
    <main className="bg-bg text-white" style={{ height: `calc(100svh + ${frames.length * STEP_PX}px)` }}>
      <div className="sticky top-0 flex h-svh flex-col gap-4 px-4 py-5 sm:px-8">
        <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h1 className="font-coolvetica text-2xl font-bold">Phone framing: pick a K</h1>
          <p className="text-xs text-white/45">
            Scroll, drag the slider, or use ← → (shift for 10) to play the /car sequence. Low-quality preview renders.
          </p>
        </header>

        {/* Phones show one column at a time. */}
        <div className="flex gap-1 md:hidden" role="tablist" aria-label="Framing option">
          {COLUMNS.map((column) => (
            <button
              key={column.id}
              type="button"
              role="tab"
              aria-selected={phoneColumn === column.id}
              onClick={() => setPhoneColumn(column.id)}
              className={`min-h-11 flex-1 rounded-md px-2 text-xs uppercase tracking-[0.12em] ${
                phoneColumn === column.id ? "bg-white/15 text-white" : "text-white/45"
              }`}
            >
              {column.label}
            </button>
          ))}
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-4">
          {COLUMNS.map((column) => {
            const state = load[column.id];
            const unrendered = state && state.missing === state.total;
            return (
              <figure
                key={column.id}
                className={`flex min-h-0 flex-col items-center gap-2 ${phoneColumn === column.id ? "" : "max-md:hidden"}`}
              >
                <div
                  className="relative aspect-[4/5] max-h-full w-full max-w-[26rem] overflow-hidden rounded-2xl bg-black ring-1 ring-white/10"
                  style={{ maxWidth: "min(26rem, calc((100svh - 13rem) * 0.8))" }}
                >
                  {!unrendered && (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element -- raw frames, swapped per scroll step */}
                      <img
                        src={column.root + frame.base}
                        alt=""
                        className={`absolute inset-0 h-full w-full ${column.contain ? "object-contain" : "object-cover"}`}
                      />
                      {frame.overlay && (
                        // eslint-disable-next-line @next/next/no-img-element -- as above
                        <img
                          src={column.root + frame.overlay.path}
                          alt=""
                          className={`absolute inset-0 h-full w-full ${column.contain ? "object-contain" : "object-cover"}`}
                          style={{ opacity: frame.overlay.opacity }}
                        />
                      )}
                    </>
                  )}
                  {unrendered && (
                    <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-xs uppercase tracking-[0.14em] text-white/35">
                      Not rendered yet
                    </p>
                  )}
                </div>
                <figcaption className="w-full max-w-[26rem] text-center">
                  <p className="font-clash text-sm font-medium">{column.label}</p>
                  <p className="text-[0.7rem] text-white/45">{column.note}</p>
                  {state && state.loaded < state.total && !unrendered && (
                    <p className="text-[0.65rem] tabular-nums text-white/30">
                      loading {state.loaded}/{state.total}
                      {state.missing ? ` · ${state.missing} missing` : ""}
                    </p>
                  )}
                </figcaption>
              </figure>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            className="min-h-11 min-w-11 rounded-md bg-white/10 text-sm"
            aria-label="Previous frame"
          >
            ←
          </button>
          <input
            type="range"
            min={0}
            max={frames.length - 1}
            value={index}
            onChange={(event) => goTo(Number(event.target.value))}
            aria-label="Position in the sequence"
            className="min-w-40 flex-1 accent-(--livery)"
          />
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            className="min-h-11 min-w-11 rounded-md bg-white/10 text-sm"
            aria-label="Next frame"
          >
            →
          </button>
          <p className="w-full text-xs tabular-nums text-white/55 sm:w-auto">
            {index + 1}/{frames.length} · {frame.label}
            {frame.chapter && <span className="ml-2 text-livery-ink uppercase tracking-[0.12em]">{frame.chapter}</span>}
          </p>
        </div>
      </div>
    </main>
  );
}
