import { z } from "zod";
import { ACCOUNT_TYPES, CATEGORY_TYPES, TRANSACTION_TYPES } from "@expense-saas/types";
import {
  amountMinorSchema,
  cuidSchema,
  currencyCodeSchema,
  paginationQuerySchema,
  positiveAmountMinorSchema,
} from "./common";

export const accountTypeSchema = z.enum(ACCOUNT_TYPES);
export const categoryTypeSchema = z.enum(CATEGORY_TYPES);
export const transactionTypeSchema = z.enum(TRANSACTION_TYPES);

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export const createAccountSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    type: accountTypeSchema,
    currency: currencyCodeSchema,
    // Lets a user record a pre-existing balance when they first add an
    // account. Not clamped to >= 0 — a credit card or overdrawn account can
    // legitimately start negative.
    initialBalanceMinor: amountMinorSchema.default("0"),
  })
  .strict();
export type CreateAccountInput = z.infer<typeof createAccountSchema>;

export const updateAccountSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    isArchived: z.boolean().optional(),
  })
  .strict();
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export const createCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(50),
    icon: z.string().trim().max(50).optional(),
    color: z
      .string()
      .trim()
      .regex(/^#[0-9a-fA-F]{6}$/, "must be a 6-digit hex color, e.g. #4F46E5")
      .optional(),
    type: categoryTypeSchema,
  })
  .strict();
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(50).optional(),
    icon: z.string().trim().max(50).optional(),
    color: z
      .string()
      .trim()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
  })
  .strict();
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

const transactionShape = z.object({
  accountId: cuidSchema,
  categoryId: cuidSchema.nullable().optional(),
  transferAccountId: cuidSchema.nullable().optional(),
  type: transactionTypeSchema,
  amountMinor: positiveAmountMinorSchema,
  currency: currencyCodeSchema,
  description: z.string().trim().max(255).optional(),
  merchant: z.string().trim().max(255).optional(),
  notes: z.string().trim().max(2000).optional(),
  occurredAt: z.string().datetime({ offset: true }),
});

function refineTransactionShape<T extends z.ZodTypeAny>(schema: T) {
  return schema.superRefine((data, ctx) => {
    const { type, categoryId, transferAccountId, accountId } = data as z.infer<
      typeof transactionShape
    >;
    if (type === "TRANSFER") {
      if (!transferAccountId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["transferAccountId"],
          message: "transferAccountId is required for a TRANSFER",
        });
      } else if (transferAccountId === accountId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["transferAccountId"],
          message: "Cannot transfer an account to itself",
        });
      }
      if (categoryId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["categoryId"],
          message: "categoryId must not be set for a TRANSFER",
        });
      }
    } else {
      if (!categoryId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["categoryId"],
          message: "categoryId is required for INCOME/EXPENSE",
        });
      }
      if (transferAccountId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["transferAccountId"],
          message: "transferAccountId must not be set for INCOME/EXPENSE",
        });
      }
    }
  });
}

/**
 * Used for both create and update (PATCH replaces the full transaction body
 * rather than merging partial fields) — keeps the cross-field invariants
 * above from ever being checked against a partially-updated, inconsistent
 * shape.
 */
export const transactionInputSchema = refineTransactionShape(transactionShape.strict());
export type TransactionInput = z.infer<typeof transactionShape>;

export const transactionQuerySchema = paginationQuerySchema
  .extend({
    accountId: cuidSchema.optional(),
    categoryId: cuidSchema.optional(),
    type: transactionTypeSchema.optional(),
    dateFrom: z.string().datetime({ offset: true }).optional(),
    dateTo: z.string().datetime({ offset: true }).optional(),
  })
  .strict();
export type TransactionQuery = z.infer<typeof transactionQuerySchema>;
