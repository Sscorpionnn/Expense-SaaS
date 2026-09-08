/**
 * References CSS custom properties (defined in globals.css, themed for
 * light/dark) rather than hardcoded hex — Recharts renders real SVG, so
 * `var(--token)` works directly as a fill/stroke value.
 */
export const CHART_CATEGORICAL = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
] as const;

export const CHART_INCOME = "var(--chart-income)";
export const CHART_EXPENSE = "var(--chart-expense)";
