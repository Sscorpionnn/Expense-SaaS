"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useDeleteBudget, useBudgets } from "@/lib/planning-hooks";
import { formatCurrency } from "@/lib/format";
import { BudgetFormDialog } from "./budget-form-dialog";

export default function BudgetsPage() {
  const budgetsQuery = useBudgets();
  const deleteBudget = useDeleteBudget();

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Budgets</h1>
        <BudgetFormDialog />
      </div>

      {budgetsQuery.data?.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No budgets yet — create one to start tracking spending against a limit.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {budgetsQuery.data?.items.map((budget) => {
          const overBudget = budget.currentPeriod.percentage > 100;
          return (
            <Card key={budget.id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>{budget.name}</CardTitle>
                  {overBudget ? <Badge variant="destructive">Over budget</Badge> : null}
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">
                  {budget.categoryName ?? "All expense categories"} ·{" "}
                  {budget.periodType === "MONTHLY" ? "Monthly" : "Custom period"}
                </p>
                <Progress value={Math.min(100, budget.currentPeriod.percentage)} />
                <div className="flex items-center justify-between text-sm">
                  <span>
                    {formatCurrency(budget.currentPeriod.spentMinor, budget.currency)} spent
                  </span>
                  <span className="text-muted-foreground">
                    of {formatCurrency(budget.currentPeriod.amountMinor, budget.currency)}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="self-start"
                  onClick={() => deleteBudget.mutate(budget.id)}
                  disabled={deleteBudget.isPending}
                >
                  Delete
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </main>
  );
}
