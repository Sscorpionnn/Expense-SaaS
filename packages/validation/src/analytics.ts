import { z } from "zod";

export const analyticsQuerySchema = z
  .object({
    dateFrom: z.string().datetime({ offset: true }).optional(),
    dateTo: z.string().datetime({ offset: true }).optional(),
  })
  .strict();
export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;

export const monthlyTrendsQuerySchema = z
  .object({
    months: z.coerce.number().int().min(1).max(24).default(6),
  })
  .strict();
export type MonthlyTrendsQuery = z.infer<typeof monthlyTrendsQuerySchema>;
