"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAnalyticsSummary, useMonthlyTrends, useSpendingByCategory } from "@/lib/analytics-hooks";
import { formatCurrency } from "@/lib/format";
import { MonthlyTrendsChart, SpendingByCategoryChart } from "./analytics-charts";

export default function AnalyticsPage() {
  const summaryQuery = useAnalyticsSummary();
  const spendingQuery = useSpendingByCategory();
  const trendsQuery = useMonthlyTrends(6);
  const currency = summaryQuery.data?.currency ?? "USD";

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">Analytics</h1>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Income</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold">
              {summaryQuery.data ? formatCurrency(summaryQuery.data.incomeMinor, currency) : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold">
              {summaryQuery.data ? formatCurrency(summaryQuery.data.expenseMinor, currency) : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Net</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold">
              {summaryQuery.data ? formatCurrency(summaryQuery.data.netMinor, currency) : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Total balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold">
              {summaryQuery.data
                ? formatCurrency(summaryQuery.data.totalBalanceMinor, currency)
                : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Spending by category</CardTitle>
        </CardHeader>
        <CardContent>
          {spendingQuery.data ? (
            <SpendingByCategoryChart data={spendingQuery.data} currency={currency} />
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Monthly trends</CardTitle>
        </CardHeader>
        <CardContent>
          {trendsQuery.data ? (
            <MonthlyTrendsChart data={trendsQuery.data} currency={currency} />
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
