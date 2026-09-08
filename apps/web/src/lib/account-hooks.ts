"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DeletionRequestDto, UserProfile } from "@expense-saas/types";
import type { ConfirmDeletionInput, UpdatePrivacySettingsInput } from "@expense-saas/validation";
import { apiFetch } from "./api-client";

export function useUpdatePrivacySettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdatePrivacySettingsInput) =>
      apiFetch<{ shareUsageAnalytics: boolean }>("/users/me/privacy", {
        method: "PATCH",
        body: input,
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(["auth", "me"], (prev: { user: UserProfile } | undefined) =>
        prev ? { user: { ...prev.user, shareUsageAnalytics: data.shareUsageAnalytics } } : prev,
      );
    },
  });
}

export function useDeletionRequest() {
  return useQuery({
    queryKey: ["account-deletion", "current"],
    queryFn: () => apiFetch<DeletionRequestDto | null>("/account-deletion-requests/current"),
  });
}

export function useRequestDeletion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<DeletionRequestDto>("/account-deletion-requests", { method: "POST" }),
    onSuccess: (data) => {
      queryClient.setQueryData(["account-deletion", "current"], data);
    },
  });
}

export function useCancelDeletion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/account-deletion-requests/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.setQueryData(["account-deletion", "current"], null);
    },
  });
}

export function useConfirmDeletion() {
  return useMutation({
    mutationFn: (input: ConfirmDeletionInput) =>
      apiFetch<DeletionRequestDto>("/account-deletion-requests/confirm", {
        method: "POST",
        body: input,
      }),
  });
}
