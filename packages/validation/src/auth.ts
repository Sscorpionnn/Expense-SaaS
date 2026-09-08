import { z } from "zod";

/**
 * Password policy follows NIST SP 800-63B guidance: prioritize length over
 * forced composition rules, but block a small set of extremely common
 * passwords outright. No external breach-check API is called (would require
 * a real third-party network call, out of scope for this project).
 */
const COMMON_PASSWORD_DENYLIST = new Set([
  "password",
  "password1",
  "12345678",
  "123456789",
  "qwerty123",
  "letmein123",
  "iloveyou1",
  "admin1234",
  "welcome123",
  "changeme1",
]);

export const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(128, "Password must be at most 128 characters")
  .refine(
    (value) => !COMMON_PASSWORD_DENYLIST.has(value.toLowerCase()),
    "This password is too common — please choose a different one",
  );

export const emailSchema = z.string().trim().toLowerCase().email().max(255);

export const registerSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    name: z.string().trim().min(1).max(100),
  })
  .strict();
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1).max(128),
  })
  .strict();
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z
  .object({
    email: emailSchema,
  })
  .strict();
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1).max(512),
    newPassword: passwordSchema,
  })
  .strict();
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const verifyEmailSchema = z
  .object({
    token: z.string().min(1).max(512),
  })
  .strict();
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const resendVerificationSchema = z
  .object({
    email: emailSchema,
  })
  .strict();
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
