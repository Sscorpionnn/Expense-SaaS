"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  BudgetDto,
  FinancialGoalDto,
  NotificationDto,
  PaginatedResult,
  RecurringTransactionDto,
} from "@expense-saas/types";
import type {
  ContributeGoalInput,
  CreateBudgetInput,
  CreateGoalInput,
  RecurringInput,
  UpdateBudgetInput,
  UpdateGoalInput,
} from "@expense-saas/validation";
import { apiFetch } from "./api-client";

// ---------------------------------------------------------------------------
// Budgets
// ---------------------------------------------------------------------------

export function useBudgets() {
  return useQuery({
    queryKey: ["budgets"],
    queryFn: () => apiFetch<PaginatedResult<BudgetDto>>("/budgets?pageSize=100"),
  });
}

export function useCreateBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBudgetInput) =>
      apiFetch<BudgetDto>("/budgets", { method: "POST", body: input }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["budgets"] }),
  });
}

export function useUpdateBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateBudgetInput }) =>
      apiFetch<BudgetDto>(`/budgets/${id}`, { method: "PATCH", body: input }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["budgets"] }),
  });
}

export function useDeleteBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/budgets/${id}`, { method: "DELETE" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["budgets"] }),
  });
}

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

export function useGoals() {
  return useQuery({
    queryKey: ["goals"],
    queryFn: () => apiFetch<PaginatedResult<FinancialGoalDto>>("/goals?pageSize=100"),
  });
}

export function useCreateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateGoalInput) =>
      apiFetch<FinancialGoalDto>("/goals", { method: "POST", body: input }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["goals"] }),
  });
}

export function useUpdateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateGoalInput }) =>
      apiFetch<FinancialGoalDto>(`/goals/${id}`, { method: "PATCH", body: input }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["goals"] }),
  });
}

export function useContributeGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ContributeGoalInput }) =>
      apiFetch<FinancialGoalDto>(`/goals/${id}/contribute`, { method: "POST", body: input }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["goals"] }),
  });
}

export function useDeleteGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/goals/${id}`, { method: "DELETE" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["goals"] }),
  });
}

// ---------------------------------------------------------------------------
// Recurring transactions
// ---------------------------------------------------------------------------

export function useRecurringTransactions() {
  return useQuery({
    queryKey: ["recurring-transactions"],
    queryFn: () =>
      apiFetch<PaginatedResult<RecurringTransactionDto>>("/recurring-transactions?pageSize=100"),
  });
}

export function useCreateRecurring() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RecurringInput) =>
      apiFetch<RecurringTransactionDto>("/recurring-transactions", {
        method: "POST",
        body: input,
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["recurring-transactions"] }),
  });
}

export function useDeleteRecurring() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/recurring-transactions/${id}`, { method: "DELETE" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["recurring-transactions"] }),
  });
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiFetch<PaginatedResult<NotificationDto>>("/notifications?pageSize=50"),
  });
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => apiFetch<{ count: number }>("/notifications/unread-count"),
    refetchInterval: 60_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<NotificationDto>(`/notifications/${id}/read`, { method: "PATCH" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
