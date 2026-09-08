import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import { QUEUE_NAMES } from "@expense-saas/config";
import type { CsvImportJobDto } from "@expense-saas/types";
import { PrismaService } from "../core/prisma.service";
import { StorageService } from "../core/storage.service";
import { AuditService } from "../core/audit.service";
import { SERVER_ENV, type ServerEnv } from "../core/env.module";
import { assertValidCsvUpload, type UploadedCsvFile } from "./csv-file-guard";
import { toCsvImportJobDto } from "./import.mapper";

export interface ProcessCsvImportJobData {
  jobId: string;
}

@Injectable()
export class ImportService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(StorageService) private readonly storage: StorageService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(SERVER_ENV) private readonly env: ServerEnv,
    @InjectQueue(QUEUE_NAMES.CSV_IMPORT) private readonly importQueue: Queue<ProcessCsvImportJobData>,
  ) {}

  async createImportJob(
    userId: string,
    accountId: string,
    file: UploadedCsvFile | undefined,
  ): Promise<CsvImportJobDto> {
    assertValidCsvUpload(file);

    const account = await this.prisma.account.findFirst({ where: { id: accountId, userId } });
    if (!account) throw new NotFoundException("Account not found");
    if (account.isArchived) throw new BadRequestException("Cannot import into an archived account");

    const job = await this.prisma.csvImportJob.create({
      data: { userId, accountId, fileKey: "", status: "PENDING" },
    });

    const key = `${userId}/${job.id}.csv`;
    await this.storage.upload(this.env.S3_BUCKET_IMPORTS, key, file.buffer, "text/csv");

    const updated = await this.prisma.csvImportJob.update({
      where: { id: job.id },
      data: { fileKey: key },
    });

    await this.importQueue.add("process-csv-import", { jobId: job.id });

    await this.audit.record({
      userId,
      action: "CSV_IMPORT_UPLOADED",
      targetType: "CsvImportJob",
      targetId: job.id,
    });

    return toCsvImportJobDto(updated);
  }

  async getStatus(userId: string, jobId: string): Promise<CsvImportJobDto> {
    const job = await this.prisma.csvImportJob.findFirst({ where: { id: jobId, userId } });
    if (!job) throw new NotFoundException("Import job not found");
    return toCsvImportJobDto(job);
  }
}
