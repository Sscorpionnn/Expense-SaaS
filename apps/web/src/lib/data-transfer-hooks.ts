"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ApiErrorBody, CsvImportJobDto, DataExportRequestDto } from "@expense-saas/types";
import { apiFetch, ApiError, ensureCsrfToken } from "./api-client";
import { SESSION } from "@expense-saas/config";

export function useCreateExport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<DataExportRequestDto>("/exports", { method: "POST" }),
    onSuccess: (data) => {
      queryClient.setQueryData(["exports", data.id], data);
    },
  });
}

export function useExportStatus(id: string | null) {
  return useQuery({
    queryKey: ["exports", id],
    queryFn: () => apiFetch<DataExportRequestDto>(`/exports/${id}`),
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "READY" || status === "FAILED" || status === "EXPIRED" ? false : 2000;
    },
  });
}

/** Downloads must be plain browser navigations (so cookies are sent), not fetch(). */
export function exportDownloadUrl(id: string): string {
  const base = process.env.NEXT_PUBLIC_API_URL;
  return `${base}/exports/${id}/download`;
}

export function useUploadCsvImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ accountId, file }: { accountId: string; file: File }) => {
      const csrfToken = await ensureCsrfToken();
      const formData = new FormData();
      formData.append("accountId", accountId);
      formData.append("file", file);

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/import/csv`, {
        method: "POST",
        credentials: "include",
        headers: { [SESSION.CSRF_HEADER_NAME]: csrfToken },
        body: formData,
      });
      const body = (await res.json()) as CsvImportJobDto | ApiErrorBody;
      if (!res.ok) throw new ApiError(body as ApiErrorBody, res.status);
      return body as CsvImportJobDto;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["imports", data.id], data);
    },
  });
}

export function useImportStatus(id: string | null) {
  return useQuery({
    queryKey: ["imports", id],
    queryFn: () => apiFetch<CsvImportJobDto>(`/import/${id}/status`),
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "COMPLETED" || status === "FAILED" ? false : 2000;
    },
  });
}
