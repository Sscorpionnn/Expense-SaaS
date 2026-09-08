import type { AccountType, CategoryType, TransactionType } from "./enums";

/**
 * Every monetary field is a base-10 integer string in minor units (see
 * @expense-saas/validation's amountMinorSchema) — never a JS number — to
 * avoid float precision loss and support non-2-decimal currencies.
 */
export interface AccountDto {
  id: string;
  name: string;
  type: AccountType;
  currency: string;
  balanceMinor: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryDto {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  type: CategoryType;
  /** True for shared system defaults; false for a user's own custom category. */
  isSystem: boolean;
}

export interface TransactionDto {
  id: string;
  accountId: string;
  categoryId: string | null;
  transferAccountId: string | null;
  type: TransactionType;
  amountMinor: string;
  currency: string;
  description: string | null;
  merchant: string | null;
  notes: string | null;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
}
