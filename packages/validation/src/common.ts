import { z } from "zod";
import { PAGINATION } from "@expense-saas/config";

/** ISO 4217 currency code, e.g. "USD", "JPY". */
export const currencyCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "must be a 3-letter ISO 4217 currency code");

/**
 * Monetary amounts cross the wire as a base-10 integer string (minor units,
 * e.g. cents) — never as a JS number/float — to avoid float precision loss
 * and to support currencies whose minor unit isn't 2 decimal places.
 * Parse with BigInt(...) server-side after validation.
 */
export const amountMinorSchema = z
  .string()
  .regex(/^-?[0-9]{1,18}$/, "must be an integer string in minor units")
  .refine((value) => BigInt(value) !== 0n || value === "0", "invalid amount");

export const positiveAmountMinorSchema = amountMinorSchema.refine(
  (value) => BigInt(value) > 0n,
  "amount must be greater than zero",
);

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(PAGINATION.MAX_PAGE_SIZE)
    .default(PAGINATION.DEFAULT_PAGE_SIZE),
});

export const cuidSchema = z.string().cuid2();
