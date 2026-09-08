import { Inject, Injectable, Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { parse } from "csv-parse/sync";
import { CSV_IMPORT, QUEUE_NAMES } from "@expense-saas/config";
import { Prisma, type CategoryType } from "@expense-saas/database";
import { PrismaService } from "../core/prisma.service";
import { StorageService } from "../core/storage.service";
import { SERVER_ENV, type ServerEnv } from "../core/env.module";
import { parseImportRow, type ParsedImportRow } from "./csv-row.util";

interface ProcessCsvImportJobData {
  jobId: string;
}

interface ImportRowError {
  row: number;
  message: string;
}

const MAX_RECORDED_ERRORS = 200;

@Injectable()
@Processor(QUEUE_NAMES.CSV_IMPORT)
export class CsvImportProcessor extends WorkerHost {
  private readonly logger = new Logger(CsvImportProcessor.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(StorageService) private readonly storage: StorageService,
    @Inject(SERVER_ENV) private readonly env: ServerEnv,
  ) {
    super();
  }

  async process(job: Job<ProcessCsvImportJobData>): Promise<void> {
    const importJob = await this.prisma.csvImportJob.findUnique({
      where: { id: job.data.jobId },
      include: { account: true },
    });
    if (!importJob) {
      this.logger.warn(`Import job ${job.data.jobId} not found — skipping`);
      return;
    }

    await this.prisma.csvImportJob.update({
      where: { id: importJob.id },
      data: { status: "PROCESSING" },
    });

    try {
      const buffer = await this.storage.download(this.env.S3_BUCKET_IMPORTS, importJob.fileKey);
      const records = parse(buffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
      }) as Record<string, string>[];

      if (records.length > CSV_IMPORT.MAX_ROWS) {
        await this.markFailed(
          importJob.id,
          `File has ${records.length} rows, exceeding the ${CSV_IMPORT.MAX_ROWS}-row limit`,
        );
        return;
      }

      let importedRows = 0;
      let skippedRows = 0;
      const errors: ImportRowError[] = [];

      for (let i = 0; i < records.length; i++) {
        const rowNumber = i + 2; // account for the header row
        const result = parseImportRow(records[i]!, importJob.account.currency);

        if (!result.ok) {
          skippedRows++;
          if (errors.length < MAX_RECORDED_ERRORS) errors.push({ row: rowNumber, message: result.error });
          continue;
        }

        const isDuplicate = await this.findDuplicate(importJob.userId, importJob.accountId, result.row);
        if (isDuplicate) {
          skippedRows++;
          if (errors.length < MAX_RECORDED_ERRORS) {
            errors.push({ row: rowNumber, message: "Duplicate transaction skipped" });
          }
          continue;
        }

        await this.insertTransaction(
          importJob.userId,
          importJob.accountId,
          importJob.account.currency,
          result.row,
        );
        importedRows++;
      }

      await this.prisma.csvImportJob.update({
        where: { id: importJob.id },
        data: {
          status: "COMPLETED",
          totalRows: records.length,
          importedRows,
          skippedRows,
          errors: errors as unknown as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(
        `CSV import job ${importJob.id} failed`,
        error instanceof Error ? error.stack : String(error),
      );
      await this.markFailed(importJob.id, "Failed to parse or process the CSV file");
    }
  }

  private async findDuplicate(
    userId: string,
    accountId: string,
    row: ParsedImportRow,
  ): Promise<boolean> {
    const dayStart = new Date(
      Date.UTC(row.occurredAt.getUTCFullYear(), row.occurredAt.getUTCMonth(), row.occurredAt.getUTCDate()),
    );
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const existing = await this.prisma.transaction.findFirst({
      where: {
        userId,
        accountId,
        type: row.type,
        amountMinor: BigInt(row.amountMinor),
        description: row.description,
        occurredAt: { gte: dayStart, lt: dayEnd },
      },
      select: { id: true },
    });
    return existing !== null;
  }

  private async resolveCategoryId(
    userId: string,
    name: string,
    type: CategoryType,
  ): Promise<string> {
    const existing = await this.prisma.category.findFirst({
      where: {
        OR: [{ userId: null }, { userId }],
        type,
        name: { equals: name, mode: "insensitive" },
      },
    });
    if (existing) return existing.id;

    const created = await this.prisma.category.create({ data: { userId, name, type } });
    return created.id;
  }

  private async insertTransaction(
    userId: string,
    accountId: string,
    currency: string,
    row: ParsedImportRow,
  ): Promise<void> {
    const categoryId = await this.resolveCategoryId(userId, row.categoryName, row.type);
    const amountMinor = BigInt(row.amountMinor);
    const delta = row.type === "INCOME" ? amountMinor : -amountMinor;

    await this.prisma.$transaction([
      this.prisma.transaction.create({
        data: {
          userId,
          accountId,
          categoryId,
          type: row.type,
          amountMinor,
          currency,
          description: row.description,
          merchant: row.merchant,
          occurredAt: row.occurredAt,
        },
      }),
      this.prisma.account.update({
        where: { id: accountId },
        data: { balanceMinor: { increment: delta } },
      }),
    ]);
  }

  private async markFailed(jobId: string, message: string): Promise<void> {
    await this.prisma.csvImportJob.update({
      where: { id: jobId },
      data: { status: "FAILED", errors: [{ row: 0, message }], completedAt: new Date() },
    });
  }
}
