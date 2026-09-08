import type { RecurringTransaction } from "@expense-saas/database";
import type { RecurringTransactionDto } from "@expense-saas/types";

export function toRecurringDto(recurring: RecurringTransaction): RecurringTransactionDto {
  return {
    id: recurring.id,
    accountId: recurring.accountId,
    categoryId: recurring.categoryId,
    type: recurring.type,
    amountMinor: recurring.amountMinor.toString(),
    currency: recurring.currency,
    description: recurring.description,
    merchant: recurring.merchant,
    frequency: recurring.frequency,
    interval: recurring.interval,
    startDate: recurring.startDate.toISOString(),
    nextOccurrenceAt: recurring.nextOccurrenceAt.toISOString(),
    endDate: recurring.endDate?.toISOString() ?? null,
    isActive: recurring.isActive,
  };
}
