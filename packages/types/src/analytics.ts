/**
 * All figures are in the caller's `defaultCurrency` — cross-currency
 * accounts/transactions are excluded from these aggregates (no currency
 * conversion in this phase).
 */
export interface AnalyticsSummaryDto {
  currency: string;
  incomeMinor: string;
  expenseMinor: string;
  netMinor: string;
  totalBalanceMinor: string;
}

export interface CategorySpendingDto {
  categoryId: string | null;
  categoryName: string;
  spentMinor: string;
}

export interface MonthlyTrendDto {
  month: string; // "2025-01"
  incomeMinor: string;
  expenseMinor: string;
}
