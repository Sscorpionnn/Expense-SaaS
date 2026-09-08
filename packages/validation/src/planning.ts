import { z } from "zod";
import {
  BUDGET_PERIOD_TYPES,
  RECURRING_FREQUENCIES,
} from "@expense-saas/types";
import { cuidSchema, currencyCodeSchema, paginationQuerySchema, positiveAmountMinorSchema } from "./common";

export const budgetPeriodTypeSchema = z.enum(BUDGET_PERIOD_TYPES);
export const recurringFrequencySchema = z.enum(RECURRING_FREQUENCIES);
export const recurringTransactionTypeSchema = z.enum(["INCOME", "EXPENSE"]);
export const goalStatusUpdateSchema = z.enum(["ACTIVE", "PAUSED", "CANCELLED"]);

// ---------------------------------------------------------------------------
// Budgets
// ---------------------------------------------------------------------------

export const createBudgetSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    categoryId: cuidSchema.nullable().optional(),
    amountMinor: positiveAmountMinorSchema,
    currency: currencyCodeSchema,
    periodType: budgetPeriodTypeSchema,
    startDate: z.string().datetime({ offset: true }),
    endDate: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.periodType === "CUSTOM") {
      if (!data.endDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["endDate"],
          message: "endDate is required for a CUSTOM period",
        });
      } else if (new Date(data.endDate) <= new Date(data.startDate)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["endDate"],
          message: "endDate must be after startDate",
        });
      }
    } else if (data.endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "endDate must not be set for a MONTHLY budget",
      });
    }
  });
export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;

export const updateBudgetSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    amountMinor: positiveAmountMinorSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .strict();
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;

// ---------------------------------------------------------------------------
// Financial goals
// ---------------------------------------------------------------------------

export const createGoalSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    targetAmountMinor: positiveAmountMinorSchema,
    currency: currencyCodeSchema,
    deadline: z.string().datetime({ offset: true }).nullable().optional(),
    linkedAccountId: cuidSchema.nullable().optional(),
  })
  .strict();
export type CreateGoalInput = z.infer<typeof createGoalSchema>;

export const updateGoalSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    targetAmountMinor: positiveAmountMinorSchema.optional(),
    deadline: z.string().datetime({ offset: true }).nullable().optional(),
    status: goalStatusUpdateSchema.optional(),
  })
  .strict();
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;

export const contributeGoalSchema = z
  .object({
    amountMinor: positiveAmountMinorSchema,
  })
  .strict();
export type ContributeGoalInput = z.infer<typeof contributeGoalSchema>;

// ---------------------------------------------------------------------------
// Recurring transactions
// ---------------------------------------------------------------------------

export const recurringInputSchema = z
  .object({
    accountId: cuidSchema,
    categoryId: cuidSchema,
    type: recurringTransactionTypeSchema,
    amountMinor: positiveAmountMinorSchema,
    currency: currencyCodeSchema,
    description: z.string().trim().max(255).optional(),
    merchant: z.string().trim().max(255).optional(),
    frequency: recurringFrequencySchema,
    interval: z.number().int().min(1).max(365).default(1),
    startDate: z.string().datetime({ offset: true }),
    endDate: z.string().datetime({ offset: true }).nullable().optional(),
    isActive: z.boolean().default(true),
  })
  .strict()
  .refine(
    (data) => !data.endDate || new Date(data.endDate) > new Date(data.startDate),
    { message: "endDate must be after startDate", path: ["endDate"] },
  );
export type RecurringInput = z.infer<typeof recurringInputSchema>;

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export const notificationQuerySchema = paginationQuerySchema
  .extend({ unreadOnly: z.coerce.boolean().optional() })
  .strict();
export type NotificationQuery = z.infer<typeof notificationQuerySchema>;
