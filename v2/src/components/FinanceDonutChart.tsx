"use client";

import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { financeData } from "./financeSpending";

// Fetched only when isDesktop mounts it, so phones never download recharts.
const FinancePie = dynamic(() => import("./FinancePie"), { ssr: false });

const DIMMED_OPACITY = 0.28;

// Phones and tablets get no spending chart: the section is hidden below
// Tailwind's lg. The donut doesn't even mount there, because hidden, recharts
// would still measure its 0 x 0 box and warn about it, production included.
// The server never draws the pie anyway, so desktop loses nothing.
const DESKTOP_QUERY = "(min-width: 64rem)";
const subscribeDesktop = (onChange: () => void) => {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
const readDesktop = () => window.matchMedia(DESKTOP_QUERY).matches;
const readServerDesktop = () => false;

export default function FinanceDonutChart() {
  // A mouse previews the slice under it. A tap on a slice selects its category
  // until the same slice is tapped again, anything else is tapped, or Escape
  // is pressed. The hover wins while it lasts, so leaving the chart falls back
  // to the selection.
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const isDesktop = useSyncExternalStore(subscribeDesktop, readDesktop, readServerDesktop);
  const activeCategory = hoveredCategory ?? selectedCategory;
  const activeItem = financeData.find((item) => item.category === activeCategory);

  const chartRef = useRef<HTMLDivElement>(null);
  // A tap also sends the slice compatibility mouse events (mouseenter, then
  // click), so the slice handlers check which kind of pointer is behind them.
  const pointerType = useRef("mouse");
  const trackPointer = useCallback((event: ReactPointerEvent) => {
    pointerType.current = event.pointerType;
  }, []);

  const toggleCategory = useCallback((category: string) => {
    setSelectedCategory((current) => (current === category ? null : category));
  }, []);
  const handleSliceEnter = useCallback((index: number) => {
    if (pointerType.current === "mouse") setHoveredCategory(financeData[index].category);
  }, []);
  // Hover already shows a mouse user the slice, so a mouse click does nothing, as before.
  const handleSliceClick = useCallback(
    (index: number) => {
      if (pointerType.current !== "mouse") toggleCategory(financeData[index].category);
    },
    [toggleCategory],
  );
  const handleChartLeave = useCallback(() => {
    setHoveredCategory(null);
  }, []);

  useEffect(() => {
    if (!selectedCategory) return;
    // pointerup, not pointerdown or click. A touch that turns into a scroll
    // ends in pointercancel, so scrolling past keeps the selection. And iOS
    // sends no click for a tap on plain text.
    const clearOnTapElsewhere = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const onSlice = chartRef.current?.contains(target) && target.closest(".recharts-pie-sector");
      if (onSlice) return;
      setSelectedCategory(null);
    };
    const clearOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedCategory(null);
    };
    document.addEventListener("pointerup", clearOnTapElsewhere);
    document.addEventListener("keydown", clearOnEscape);
    return () => {
      document.removeEventListener("pointerup", clearOnTapElsewhere);
      document.removeEventListener("keydown", clearOnEscape);
    };
  }, [selectedCategory]);

  const sliceOpacities = activeItem
    ? ({ "--slice-dim": DIMMED_OPACITY, [`--slice-${activeItem.category}`]: 1 } as CSSProperties)
    : undefined;

  return (
    <div className="hidden min-w-0 justify-center py-24 [-webkit-tap-highlight-color:transparent] lg:flex">
      <div
        ref={chartRef}
        role="img"
        aria-label="Donut chart showing the percentage distribution of team spending by category"
        className="relative aspect-square w-full max-w-[30rem]"
        style={sliceOpacities}
        onMouseLeave={handleChartLeave}
        onPointerOver={trackPointer}
        onPointerDown={trackPointer}
      >
        {isDesktop && (
          <FinancePie onSliceEnter={handleSliceEnter} onSliceClick={handleSliceClick} />
        )}

        <div
          aria-live="polite"
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"
        >
          <span className="font-clash text-3xl font-medium tabular-nums text-white">
            {activeItem ? `${activeItem.percentage.toFixed(1)}%` : "100%"}
          </span>
          <span className="mt-1 whitespace-nowrap text-[0.6rem] uppercase tracking-[0.15em] text-white/35">
            {activeItem?.label ?? "Total spending"}
          </span>
        </div>
      </div>
    </div>
  );
}
