import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { SERVER_ENV, type ServerEnv } from "../core/env.module";
import { PrismaService } from "../core/prisma.service";
import { StorageService } from "../core/storage.service";

/** Deletes expired export files from object storage — "expire automatically". */
@Injectable()
export class ExportCleanupService {
  private readonly logger = new Logger(ExportCleanupService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(StorageService) private readonly storage: StorageService,
    @Inject(SERVER_ENV) private readonly env: ServerEnv,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async sweep(): Promise<void> {
    const expired = await this.prisma.dataExportRequest.findMany({
      where: { status: "READY", expiresAt: { lt: new Date() } },
    });

    for (const request of expired) {
      if (request.storageKey) {
        await this.storage.delete(this.env.S3_BUCKET_EXPORTS, request.storageKey);
      }
      await this.prisma.dataExportRequest.update({
        where: { id: request.id },
        data: { status: "EXPIRED" },
      });
    }

    if (expired.length > 0) {
      this.logger.log(`Expired ${expired.length} data export(s).`);
    }
  }
}
