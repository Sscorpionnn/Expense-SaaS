/**
 * These string unions are the single source of truth for domain enums and
 * are mirrored exactly by the Prisma enums in packages/database — keep both
 * in sync when changing values.
 */

export const ACCOUNT_TYPES = ["CASH", "BANK", "CREDIT_CARD", "SAVINGS", "WALLET"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const TRANSACTION_TYPES = ["INCOME", "EXPENSE", "TRANSFER"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const CATEGORY_TYPES = ["INCOME", "EXPENSE"] as const;
export type CategoryType = (typeof CATEGORY_TYPES)[number];

export const BUDGET_PERIOD_TYPES = ["MONTHLY", "CUSTOM"] as const;
export type BudgetPeriodType = (typeof BUDGET_PERIOD_TYPES)[number];

export const RECURRING_FREQUENCIES = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"] as const;
export type RecurringFrequency = (typeof RECURRING_FREQUENCIES)[number];

export const GOAL_STATUSES = ["ACTIVE", "COMPLETED", "PAUSED", "CANCELLED"] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export const NOTIFICATION_TYPES = [
  "RECURRING_REMINDER",
  "BUDGET_THRESHOLD",
  "GOAL_DEADLINE",
  "EXPORT_READY",
  "SECURITY_ALERT",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const DATA_EXPORT_STATUSES = ["PENDING", "PROCESSING", "READY", "EXPIRED", "FAILED"] as const;
export type DataExportStatus = (typeof DATA_EXPORT_STATUSES)[number];

export const VERIFICATION_TOKEN_PURPOSES = ["EMAIL_VERIFY", "PASSWORD_RESET"] as const;
export type VerificationTokenPurpose = (typeof VERIFICATION_TOKEN_PURPOSES)[number];

export const AUDIT_ACTIONS = [
  "REGISTER",
  "LOGIN_SUCCESS",
  "LOGIN_FAILURE",
  "LOGOUT",
  "EMAIL_VERIFIED",
  "EMAIL_VERIFICATION_RESENT",
  "PASSWORD_RESET_REQUESTED",
  "PASSWORD_RESET_COMPLETED",
  "SESSION_REVOKED",
  "ACCOUNT_DELETION_REQUESTED",
  "ACCOUNT_DELETION_CONFIRMED",
  "ACCOUNT_DELETION_CANCELLED",
  "FINANCIAL_ACCOUNT_CREATED",
  "FINANCIAL_ACCOUNT_ARCHIVED",
  "FINANCIAL_ACCOUNT_DELETED",
  "TRANSACTION_CREATED",
  "TRANSACTION_UPDATED",
  "TRANSACTION_DELETED",
  "BUDGET_CREATED",
  "BUDGET_DELETED",
  "GOAL_CREATED",
  "GOAL_DELETED",
  "RECURRING_TRANSACTION_CREATED",
  "RECURRING_TRANSACTION_DELETED",
  "CSV_IMPORT_UPLOADED",
  "DATA_EXPORT_REQUESTED",
  "DATA_EXPORT_DOWNLOADED",
  "ACCOUNT_DELETION_PURGED",
  "PRIVACY_SETTINGS_UPDATED",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const DELETION_REQUEST_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "COMPLETED",
  "CANCELLED",
] as const;
export type DeletionRequestStatus = (typeof DELETION_REQUEST_STATUSES)[number];
