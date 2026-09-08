"use client";

import { useQuery } from "@tanstack/react-query";
import type { AnalyticsSummaryDto, CategorySpendingDto, MonthlyTrendDto } from "@expense-saas/types";
import { apiFetch } from "./api-client";

export function useAnalyticsSummary() {
  return useQuery({
    queryKey: ["analytics", "summary"],
    queryFn: () => apiFetch<AnalyticsSummaryDto>("/analytics/summary"),
  });
}

export function useSpendingByCategory() {
  return useQuery({
    queryKey: ["analytics", "spending-by-category"],
    queryFn: () => apiFetch<CategorySpendingDto[]>("/analytics/spending-by-category"),
  });
}

export function useMonthlyTrends(months = 6) {
  return useQuery({
    queryKey: ["analytics", "monthly-trends", months],
    queryFn: () => apiFetch<MonthlyTrendDto[]>(`/analytics/monthly-trends?months=${months}`),
  });
}
