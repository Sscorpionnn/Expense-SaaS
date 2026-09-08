import { z } from "zod";

export const confirmDeletionSchema = z
  .object({
    token: z.string().min(1).max(512),
  })
  .strict();
export type ConfirmDeletionInput = z.infer<typeof confirmDeletionSchema>;

export const updatePrivacySettingsSchema = z
  .object({
    shareUsageAnalytics: z.boolean(),
  })
  .strict();
export type UpdatePrivacySettingsInput = z.infer<typeof updatePrivacySettingsSchema>;
