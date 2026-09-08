import type { DataExportRequest } from "@expense-saas/database";
import type { DataExportRequestDto } from "@expense-saas/types";

export function toExportRequestDto(request: DataExportRequest): DataExportRequestDto {
  return {
    id: request.id,
    status: request.status,
    requestedAt: request.requestedAt.toISOString(),
    readyAt: request.readyAt?.toISOString() ?? null,
    expiresAt: request.expiresAt?.toISOString() ?? null,
  };
}
