import type { DeletionRequestStatus } from "./enums";

export interface DeletionRequestDto {
  id: string;
  status: DeletionRequestStatus;
  requestedAt: string;
  confirmedAt: string | null;
  scheduledPurgeAt: string | null;
}
