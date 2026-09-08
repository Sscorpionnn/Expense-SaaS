import type {
  BudgetPeriodType,
  GoalStatus,
  NotificationType,
  RecurringFrequency,
  TransactionType,
} from "./enums";

export interface BudgetPeriodProgressDto {
  periodStart: string;
  periodEnd: string;
  amountMinor: string;
  spentMinor: string;
  remainingMinor: string;
  /** 0-100+ (can exceed 100 when over budget). */
  percentage: number;
}

export interface BudgetDto {
  id: string;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
  amountMinor: string;
  currency: string;
  periodType: BudgetPeriodType;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  currentPeriod: BudgetPeriodProgressDto;
}

export interface FinancialGoalDto {
  id: string;
  name: string;
  targetAmountMinor: string;
  currentAmountMinor: string;
  currency: string;
  deadline: string | null;
  status: GoalStatus;
  linkedAccountId: string | null;
  createdAt: string;
}

export interface RecurringTransactionDto {
  id: string;
  accountId: string;
  categoryId: string;
  type: TransactionType;
  amountMinor: string;
  currency: string;
  description: string | null;
  merchant: string | null;
  frequency: RecurringFrequency;
  interval: number;
  startDate: string;
  nextOccurrenceAt: string;
  endDate: string | null;
  isActive: boolean;
}

export interface NotificationDto {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}
