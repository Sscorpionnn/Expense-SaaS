import type { DataExportStatus } from "./enums";

export type CsvImportStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface CsvImportError {
  row: number;
  message: string;
}

export interface CsvImportJobDto {
  id: string;
  status: CsvImportStatus;
  totalRows: number | null;
  importedRows: number | null;
  skippedRows: number | null;
  errors: CsvImportError[] | null;
  createdAt: string;
  completedAt: string | null;
}

export interface DataExportRequestDto {
  id: string;
  status: DataExportStatus;
  requestedAt: string;
  readyAt: string | null;
  expiresAt: string | null;
}
