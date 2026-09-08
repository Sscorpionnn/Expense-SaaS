import type { Transaction } from "@expense-saas/database";
import type { TransactionDto } from "@expense-saas/types";

export function toTransactionDto(transaction: Transaction): TransactionDto {
  return {
    id: transaction.id,
    accountId: transaction.accountId,
    categoryId: transaction.categoryId,
    transferAccountId: transaction.transferAccountId,
    type: transaction.type,
    amountMinor: transaction.amountMinor.toString(),
    currency: transaction.currency,
    description: transaction.description,
    merchant: transaction.merchant,
    notes: transaction.notes,
    occurredAt: transaction.occurredAt.toISOString(),
    createdAt: transaction.createdAt.toISOString(),
    updatedAt: transaction.updatedAt.toISOString(),
  };
}
