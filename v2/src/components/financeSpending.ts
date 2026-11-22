// Team spending by category, shared by the donut's interactive shell and the
// recharts pie it loads on demand (FinancePie).

export type FinanceItem = {
  category: string;
  label: string;
  percentage: number;
  fill: string;
};

export const financeData: FinanceItem[] = [
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
