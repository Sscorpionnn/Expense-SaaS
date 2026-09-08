import type { CsvImportJob } from "@expense-saas/database";
import type { CsvImportError, CsvImportJobDto } from "@expense-saas/types";

export function toCsvImportJobDto(job: CsvImportJob): CsvImportJobDto {
  return {
    id: job.id,
    status: job.status,
    totalRows: job.totalRows,
    importedRows: job.importedRows,
    skippedRows: job.skippedRows,
    errors: (job.errors as CsvImportError[] | null) ?? null,
    createdAt: job.createdAt.toISOString(),
    completedAt: job.completedAt?.toISOString() ?? null,
  };
}
