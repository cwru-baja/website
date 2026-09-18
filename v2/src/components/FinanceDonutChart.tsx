"use client";

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Cell, Pie, PieChart } from "recharts";

import {
  ChartContainer,
  type ChartConfig,
} from "@/components/ui/chart";

type FinanceItem = {
  category: string;
  label: string;
  percentage: number;
  fill: string;
};

const financeData: FinanceItem[] = [
  { category: "competition", label: "Competition", percentage: 23.4, fill: "var(--color-competition)" },
  { category: "cnc", label: "CNC", percentage: 20, fill: "var(--color-cnc)" },
  { category: "drivetrain", label: "Drivetrain", percentage: 15.7, fill: "var(--color-drivetrain)" },
  { category: "panels", label: "Panels", percentage: 10.7, fill: "var(--color-panels)" },
  { category: "systems", label: "Systems", percentage: 7.1, fill: "var(--color-systems)" },
  { category: "uncategorized", label: "Uncategorized", percentage: 6.3, fill: "var(--color-uncategorized)" },
  { category: "suspension", label: "Suspension", percentage: 5.6, fill: "var(--color-suspension)" },
  { category: "brakes", label: "Brakes", percentage: 3.6, fill: "var(--color-brakes)" },
  { category: "team-bonding", label: "Team Bonding", percentage: 1.7, fill: "var(--color-team-bonding)" },
  { category: "frame", label: "Frame", percentage: 1.6, fill: "var(--color-frame)" },
  { category: "engine", label: "Engine", percentage: 1.5, fill: "var(--color-engine)" },
  { category: "test-engineering", label: "Test Engineering", percentage: 0.8, fill: "var(--color-test-engineering)" },
  { category: "manufacturing", label: "Manufacturing", percentage: 0.6, fill: "var(--color-manufacturing)" },
  { category: "race-logistics", label: "Race Logistics", percentage: 0.5, fill: "var(--color-race-logistics)" },
  { category: "mini-baja", label: "Mini Baja", percentage: 0.5, fill: "var(--color-mini-baja)" },
  { category: "logistics", label: "Logistics", percentage: 0.3, fill: "var(--color-logistics)" },
];

// Livery slices cycle lead, support and pop hues and alternate light and dark
// mixes, so neighbours never share both. Magenta and blue look alike to
// deuteranopes; the centre label names the hovered slice, not the colour.
const lighter = (livery: string, percent: number) =>
  `color-mix(in oklab, var(${livery}) ${percent}%, white)`;
const deeper = (livery: string, percent: number) =>
  `color-mix(in oklab, var(${livery}) ${percent}%, var(--livery-deep))`;

const chartConfig = {
  percentage: { label: "Percent of total" },
  competition: { label: "Competition", color: "var(--livery)" },
  cnc: { label: "CNC", color: "var(--livery-support)" },
  drivetrain: { label: "Drivetrain", color: "var(--livery-pop)" },
  panels: { label: "Panels", color: lighter("--livery", 55) },
  systems: { label: "Systems", color: "#d6d6d6" },
  uncategorized: { label: "Uncategorized", color: "#5f5f5f" },
  suspension: { label: "Suspension", color: lighter("--livery-support", 55) },
  brakes: { label: "Brakes", color: lighter("--livery-pop", 55) },
  "team-bonding": { label: "Team Bonding", color: "#b4b4b4" },
  frame: { label: "Frame", color: deeper("--livery", 55) },
  engine: { label: "Engine", color: deeper("--livery-support", 60) },
  "test-engineering": { label: "Test Engineering", color: "#858585" },
  manufacturing: { label: "Manufacturing", color: deeper("--livery-pop", 60) },
  "race-logistics": { label: "Race Logistics", color: "#a0a0a0" },
  "mini-baja": { label: "Mini Baja", color: lighter("--livery", 30) },
  logistics: { label: "Logistics", color: "#414141" },
} satisfies ChartConfig;

// The legend sits outside the chart's scope, where the --color-* variables
// aren't defined, so its swatches read the colours from the config directly.
const swatchColor = (category: string) => (chartConfig as ChartConfig)[category]?.color;

const DIMMED_OPACITY = 0.28;

// Each slice's opacity comes from CSS variables that the chart's wrapper sets
// for the active category. That way the pie never re-renders when the active
// category changes. Recharts restarts its sweep animation whenever <Pie> gets
// new props. With nothing active the variables are unset, so every slice is at 1.
const sliceStyles: Record<string, CSSProperties> = Object.fromEntries(
  financeData.map(({ category }) => [
    category,
    { opacity: `var(--slice-${category}, var(--slice-dim, 1))` },
  ]),
);

type FinancePieProps = {
  onSliceEnter: (index: number) => void;
  onSliceClick: (index: number) => void;
};

const FinancePie = memo(function FinancePie({ onSliceEnter, onSliceClick }: FinancePieProps) {
  return (
    <ChartContainer
      config={chartConfig}
      className="mx-auto aspect-square h-auto w-full"
      initialDimension={{ width: 480, height: 480 }}
    >
      <PieChart accessibilityLayer>
        <Pie
          data={financeData}
          dataKey="percentage"
          nameKey="category"
          innerRadius="55%"
          outerRadius="90%"
          paddingAngle={0}
          stroke="#0a0a0a"
          strokeWidth={2}
          animationDuration={700}
          onMouseEnter={(_data, index) => onSliceEnter(index)}
          onClick={(_data, index) => onSliceClick(index)}
        >
          {financeData.map((item) => (
            <Cell
              key={item.category}
              fill={item.fill}
              style={sliceStyles[item.category]}
            />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  );
});

export default function FinanceDonutChart() {
  // A mouse previews the slice under it. A tap on a slice, or a tap, click or
  // key press on a legend row, selects a category until the same item is
  // tapped again, anything else is tapped, or Escape is pressed. The hover
  // wins while it lasts, so leaving the chart falls back to the selection.
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const activeCategory = hoveredCategory ?? selectedCategory;
  const activeItem = financeData.find((item) => item.category === activeCategory);

  const chartRef = useRef<HTMLDivElement>(null);
  const legendRef = useRef<HTMLUListElement>(null);
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
      if (onSlice || legendRef.current?.contains(target)) return;
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
    <div className="flex min-w-0 flex-col items-center justify-center py-12 [-webkit-tap-highlight-color:transparent] sm:py-16 lg:flex-row lg:py-24">
      <div
        ref={chartRef}
        role="img"
        aria-label="Donut chart showing the percentage distribution of team spending by category"
        className="relative w-full max-w-[30rem]"
        style={sliceOpacities}
        onMouseLeave={handleChartLeave}
        onPointerOver={trackPointer}
        onPointerDown={trackPointer}
      >
        <FinancePie onSliceEnter={handleSliceEnter} onSliceClick={handleSliceClick} />

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

      {/* Phones and tablets get a legend, because the slices under 1% are
          too thin to tap. Ranked, reading down each column. Selecting a row
          changes only colour and opacity, so nothing moves. */}
      <ul
        ref={legendRef}
        aria-label="Spending by category"
        className="mt-6 grid grid-flow-col grid-rows-8 gap-x-4 sm:grid-rows-4 sm:gap-x-8 lg:hidden"
      >
        {financeData.map((item) => {
          const isActive = item.category === activeCategory;
          const isDimmed = activeItem !== undefined && !isActive;
          return (
            <li key={item.category}>
              <button
                type="button"
                aria-pressed={item.category === selectedCategory}
                onClick={() => toggleCategory(item.category)}
                className="group flex min-h-11 w-full items-center gap-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <span
                  aria-hidden="true"
                  className="size-2 shrink-0"
                  style={{
                    backgroundColor: swatchColor(item.category),
                    opacity: isDimmed ? DIMMED_OPACITY : 1,
                  }}
                />
                {/* Label first so the button reads "Competition 23.4%"; shown
                    percentage on top, like the centre of the chart. */}
                <span className="flex flex-col-reverse">
                  <span
                    className={`text-[0.6rem] uppercase tracking-[0.15em] ${
                      isActive
                        ? "text-white/70"
                        : isDimmed
                          ? "text-white/35 group-hover:text-white/55"
                          : "text-white/50 group-hover:text-white/70"
                    }`}
                  >
                    {item.label}
                  </span>
                  <span
                    className={`font-clash text-sm font-medium tabular-nums ${
                      isActive ? "text-white" : isDimmed ? "text-white/45" : "text-white/70"
                    }`}
                  >
                    {item.percentage.toFixed(1)}%
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
