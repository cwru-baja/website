"use client";

// The recharts half of the spending donut, split out so recharts (~100 KB
// gzipped) is only downloaded by screens that show the chart: FinanceDonutChart
// loads this with next/dynamic once it knows it is on a desktop.

import { memo, type CSSProperties } from "react";
import { Cell, Pie, PieChart } from "recharts";

import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { financeData } from "./financeSpending";

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

export default FinancePie;
