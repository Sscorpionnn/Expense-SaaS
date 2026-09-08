import type { FinancialGoal } from "@expense-saas/database";
import type { FinancialGoalDto } from "@expense-saas/types";

export function toGoalDto(goal: FinancialGoal): FinancialGoalDto {
  return {
    id: goal.id,
    name: goal.name,
    targetAmountMinor: goal.targetAmountMinor.toString(),
    currentAmountMinor: goal.currentAmountMinor.toString(),
    currency: goal.currency,
    deadline: goal.deadline?.toISOString() ?? null,
    status: goal.status,
    linkedAccountId: goal.linkedAccountId,
    createdAt: goal.createdAt.toISOString(),
  };
}
