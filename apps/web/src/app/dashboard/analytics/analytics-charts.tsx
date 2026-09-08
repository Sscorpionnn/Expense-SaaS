"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CategorySpendingDto, MonthlyTrendDto } from "@expense-saas/types";
import { CHART_CATEGORICAL, CHART_EXPENSE, CHART_INCOME } from "@/lib/chart-colors";
import { formatDisplayCurrency, toDisplayNumber } from "@/lib/format";

export function SpendingByCategoryChart({
  data,
  currency,
}: {
  data: CategorySpendingDto[];
  currency: string;
}) {
  const chartData = data
    .map((item) => ({
      name: item.categoryName,
      value: toDisplayNumber(item.spentMinor, currency),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  if (chartData.length === 0) {
    return <p className="text-sm text-muted-foreground">No expenses recorded yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ left: 16, right: 16 }}>
            <CartesianGrid horizontal={false} stroke="var(--border)" />
            <XAxis
              type="number"
              tickFormatter={(value: number) => formatDisplayCurrency(value, currency)}
              stroke="var(--muted-foreground)"
              fontSize={12}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={110}
              stroke="var(--muted-foreground)"
              fontSize={12}
            />
            <Tooltip
              formatter={(value) => formatDisplayCurrency(Number(value ?? 0), currency)}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--popover-foreground)",
              }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {chartData.map((_entry, index) => (
                <rect key={index} fill={CHART_CATEGORICAL[index % CHART_CATEGORICAL.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground sm:grid-cols-3">
        {chartData.map((item) => (
          <li key={item.name} className="flex justify-between gap-2">
            <span className="truncate">{item.name}</span>
            <span className="tabular-nums">{formatDisplayCurrency(item.value, currency)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MonthlyTrendsChart({
  data,
  currency,
}: {
  data: MonthlyTrendDto[];
  currency: string;
}) {
  const chartData = data.map((item) => ({
    month: item.month,
    Income: toDisplayNumber(item.incomeMinor, currency),
    Expense: toDisplayNumber(item.expenseMinor, currency),
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ left: 8, right: 8 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} />
          <YAxis
            tickFormatter={(value: number) => formatDisplayCurrency(value, currency)}
            stroke="var(--muted-foreground)"
            fontSize={12}
            width={70}
          />
          <Tooltip
            formatter={(value) => formatDisplayCurrency(Number(value ?? 0), currency)}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--popover-foreground)",
            }}
          />
          <Legend />
          <Bar dataKey="Income" fill={CHART_INCOME} radius={[4, 4, 0, 0]} />
          <Bar dataKey="Expense" fill={CHART_EXPENSE} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
