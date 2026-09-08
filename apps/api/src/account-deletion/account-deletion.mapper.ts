import type { DeletionRequest } from "@expense-saas/database";
import type { DeletionRequestDto } from "@expense-saas/types";

export function toDeletionRequestDto(request: DeletionRequest): DeletionRequestDto {
  return {
    id: request.id,
    status: request.status,
    requestedAt: request.requestedAt.toISOString(),
    confirmedAt: request.confirmedAt?.toISOString() ?? null,
    scheduledPurgeAt: request.scheduledPurgeAt?.toISOString() ?? null,
  };
}
