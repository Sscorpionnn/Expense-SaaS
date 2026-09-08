"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useDeleteGoal, useGoals } from "@/lib/planning-hooks";
import { formatCurrency } from "@/lib/format";
import { GoalFormDialog } from "./goal-form-dialog";
import { ContributeForm } from "./contribute-form";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  ACTIVE: "default",
  COMPLETED: "default",
  PAUSED: "secondary",
  CANCELLED: "destructive",
};

export default function GoalsPage() {
  const goalsQuery = useGoals();
  const deleteGoal = useDeleteGoal();

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Financial goals</h1>
        <GoalFormDialog />
      </div>

      {goalsQuery.data?.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No goals yet — set a savings target to start tracking progress.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {goalsQuery.data?.items.map((goal) => {
          const target = BigInt(goal.targetAmountMinor);
          const current = BigInt(goal.currentAmountMinor);
          const percentage = target > 0n ? Number((current * 10000n) / target) / 100 : 0;

          return (
            <Card key={goal.id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>{goal.name}</CardTitle>
                  <Badge variant={STATUS_VARIANT[goal.status]}>{goal.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <Progress value={Math.min(100, percentage)} />
                <div className="flex items-center justify-between text-sm">
                  <span>{formatCurrency(goal.currentAmountMinor, goal.currency)} saved</span>
                  <span className="text-muted-foreground">
                    of {formatCurrency(goal.targetAmountMinor, goal.currency)}
                  </span>
                </div>
                {goal.deadline ? (
                  <p className="text-xs text-muted-foreground">
                    Deadline {new Date(goal.deadline).toLocaleDateString()}
                  </p>
                ) : null}
                {goal.status === "ACTIVE" ? (
                  <ContributeForm goalId={goal.id} currency={goal.currency} />
                ) : null}
                <Button
                  variant="ghost"
                  size="sm"
                  className="self-start"
                  onClick={() => deleteGoal.mutate(goal.id)}
                  disabled={deleteGoal.isPending}
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
