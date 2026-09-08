import { Inject, Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { DATA_EXPORT, formatMinorUnits, QUEUE_NAMES, toCsvRow } from "@expense-saas/config";
import { PrismaService } from "../core/prisma.service";
import { StorageService } from "../core/storage.service";
import { SERVER_ENV, type ServerEnv } from "../core/env.module";

interface GenerateExportJobData {
  requestId: string;
}

const CSV_HEADER = [
  "Date",
  "Type",
  "Account",
  "Category",
  "Amount",
  "Currency",
  "Description",
  "Merchant",
  "Notes",
];

@Processor(QUEUE_NAMES.DATA_EXPORT)
export class DataExportProcessor extends WorkerHost {
  private readonly logger = new Logger(DataExportProcessor.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(StorageService) private readonly storage: StorageService,
    @Inject(SERVER_ENV) private readonly env: ServerEnv,
  ) {
    super();
  }

  async process(job: Job<GenerateExportJobData>): Promise<void> {
    const request = await this.prisma.dataExportRequest.findUnique({
      where: { id: job.data.requestId },
    });
    if (!request) {
      this.logger.warn(`Export request ${job.data.requestId} not found — skipping`);
      return;
    }

    await this.prisma.dataExportRequest.update({
      where: { id: request.id },
      data: { status: "PROCESSING" },
    });

    try {
      const transactions = await this.prisma.transaction.findMany({
        where: { userId: request.userId },
        include: { account: true, category: true, transferAccount: true },
        orderBy: { occurredAt: "asc" },
      });

      const lines = [
        toCsvRow(CSV_HEADER),
        ...transactions.map((tx) =>
          toCsvRow([
            tx.occurredAt.toISOString().slice(0, 10),
            tx.type,
            tx.account.name,
            tx.category?.name ??
              (tx.type === "TRANSFER" ? `Transfer to ${tx.transferAccount?.name ?? "?"}` : ""),
            formatMinorUnits(tx.amountMinor, tx.currency),
            tx.currency,
            tx.description ?? "",
            tx.merchant ?? "",
            tx.notes ?? "",
          ]),
        ),
      ];
      const buffer = Buffer.from(lines.join("\r\n"), "utf-8");

      const key = `${request.userId}/${request.id}.csv`;
      await this.storage.upload(this.env.S3_BUCKET_EXPORTS, key, buffer, "text/csv");

      const expiresAt = new Date(Date.now() + DATA_EXPORT.EXPIRY_HOURS * 60 * 60 * 1000);
      await this.prisma.dataExportRequest.update({
        where: { id: request.id },
        data: {
          status: "READY",
          storageKey: key,
          fileSizeBytes: buffer.byteLength,
          readyAt: new Date(),
          expiresAt,
        },
      });

      await this.prisma.notification.create({
        data: {
          userId: request.userId,
          type: "EXPORT_READY",
          title: "Your data export is ready",
          body: `Your export of ${transactions.length} transaction(s) is ready to download. It expires in ${DATA_EXPORT.EXPIRY_HOURS} hours.`,
          metadata: { dataExportRequestId: request.id },
        },
      });
    } catch (error) {
      this.logger.error(
        `Export request ${request.id} failed`,
        error instanceof Error ? error.stack : String(error),
      );
      await this.prisma.dataExportRequest.update({
        where: { id: request.id },
        data: { status: "FAILED" },
      });
    }
  }
}
