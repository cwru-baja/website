"use client";

import { memo, useCallback, useState } from "react";
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

const chartConfig = {
  percentage: { label: "Percent of total" },
  competition: { label: "Competition", color: "#bc2121" },
  cnc: { label: "CNC", color: "#e05252" },
  drivetrain: { label: "Drivetrain", color: "#8f1717" },
  panels: { label: "Panels", color: "#f07b7b" },
  systems: { label: "Systems", color: "#d6d6d6" },
  uncategorized: { label: "Uncategorized", color: "#5f5f5f" },
  suspension: { label: "Suspension", color: "#9d2a2a" },
  brakes: { label: "Brakes", color: "#efaaaa" },
  "team-bonding": { label: "Team Bonding", color: "#b4b4b4" },
  frame: { label: "Frame", color: "#6e1b1b" },
  engine: { label: "Engine", color: "#df7373" },
  "test-engineering": { label: "Test Engineering", color: "#858585" },
  manufacturing: { label: "Manufacturing", color: "#c94c4c" },
  "race-logistics": { label: "Race Logistics", color: "#a0a0a0" },
  "mini-baja": { label: "Mini Baja", color: "#f1c5c5" },
  logistics: { label: "Logistics", color: "#414141" },
} satisfies ChartConfig;

type FinancePieProps = {
  onCategoryEnter: (category: string) => void;
};

const FinancePie = memo(function FinancePie({ onCategoryEnter }: FinancePieProps) {
  return (
    <ChartContainer
      config={chartConfig}
      className="mx-auto aspect-square h-auto w-full [&_.recharts-pie:hover_.recharts-pie-sector]:opacity-[0.28] [&_.recharts-pie:hover_.recharts-pie-sector:hover]:opacity-100"
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
          onMouseEnter={(_data, index) => onCategoryEnter(financeData[index].category)}
        >
          {financeData.map((item) => (
            <Cell
              key={item.category}
              fill={item.fill}
            />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  );
});

export default function FinanceDonutChart() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const activeItem = financeData.find((item) => item.category === activeCategory);
  const handleCategoryEnter = useCallback((category: string) => {
    setActiveCategory(category);
  }, []);
  const handleChartLeave = useCallback(() => {
    setActiveCategory(null);
  }, []);

  return (
    <div className="flex min-w-0 items-center justify-center py-12 sm:py-16 lg:py-24">
      <div
        role="img"
        aria-label="Donut chart showing the percentage distribution of team spending by category"
        className="relative w-full max-w-[30rem]"
        onMouseLeave={handleChartLeave}
      >
        <FinancePie onCategoryEnter={handleCategoryEnter} />

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
