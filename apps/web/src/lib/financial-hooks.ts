"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AccountDto, CategoryDto, PaginatedResult, TransactionDto } from "@expense-saas/types";
import type {
  CreateAccountInput,
  CreateCategoryInput,
  TransactionInput,
  UpdateAccountInput,
} from "@expense-saas/validation";
import { apiFetch } from "./api-client";

function queryString(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const str = search.toString();
  return str ? `?${str}` : "";
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export function useAccounts() {
  return useQuery({
    queryKey: ["accounts"],
    queryFn: () => apiFetch<PaginatedResult<AccountDto>>("/accounts?pageSize=100"),
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAccountInput) =>
      apiFetch<AccountDto>("/accounts", { method: "POST", body: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateAccountInput }) =>
      apiFetch<AccountDto>(`/accounts/${id}`, { method: "PATCH", body: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/accounts/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: () => apiFetch<PaginatedResult<CategoryDto>>("/categories?pageSize=100"),
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCategoryInput) =>
      apiFetch<CategoryDto>("/categories", { method: "POST", body: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

export interface TransactionFilters {
  accountId?: string;
  categoryId?: string;
  type?: string;
  page?: number;
}

export function useTransactions(filters: TransactionFilters = {}) {
  return useQuery({
    queryKey: ["transactions", filters],
    queryFn: () =>
      apiFetch<PaginatedResult<TransactionDto>>(
        `/transactions${queryString({
          accountId: filters.accountId,
          categoryId: filters.categoryId,
          type: filters.type,
          page: filters.page ? String(filters.page) : undefined,
          pageSize: "20",
        })}`,
      ),
  });
}

function invalidateAfterTransactionChange(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ["transactions"] });
  void queryClient.invalidateQueries({ queryKey: ["accounts"] }); // balances changed too
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TransactionInput) =>
      apiFetch<TransactionDto>("/transactions", { method: "POST", body: input }),
    onSuccess: () => invalidateAfterTransactionChange(queryClient),
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: TransactionInput }) =>
      apiFetch<TransactionDto>(`/transactions/${id}`, { method: "PATCH", body: input }),
    onSuccess: () => invalidateAfterTransactionChange(queryClient),
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/transactions/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateAfterTransactionChange(queryClient),
  });
}
