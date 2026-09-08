import type { Budget } from "@expense-saas/database";

export interface PeriodBounds {
  start: Date;
  end: Date;
}

/**
 * The window a budget's "current" period covers. MONTHLY budgets roll to
 * the current calendar month (UTC), never starting before the budget's own
 * anchor `startDate`. CUSTOM budgets have exactly one fixed window.
 */
export function computeCurrentPeriodBounds(
  budget: Pick<Budget, "periodType" | "startDate" | "endDate">,
  now: Date = new Date(),
): PeriodBounds {
  if (budget.periodType === "CUSTOM") {
    return { start: budget.startDate, end: budget.endDate! };
  }

  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const start = monthStart < budget.startDate ? budget.startDate : monthStart;
  return { start, end: monthEnd };
}
