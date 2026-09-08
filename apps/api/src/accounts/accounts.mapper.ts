import type { Account } from "@expense-saas/database";
import type { AccountDto } from "@expense-saas/types";

export function toAccountDto(account: Account): AccountDto {
  return {
    id: account.id,
    name: account.name,
    type: account.type,
    currency: account.currency,
    balanceMinor: account.balanceMinor.toString(),
    isArchived: account.isArchived,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
}
