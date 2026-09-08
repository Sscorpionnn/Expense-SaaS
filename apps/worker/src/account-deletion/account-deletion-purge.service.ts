import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../core/prisma.service";
import { StorageService } from "../core/storage.service";
import { SERVER_ENV, type ServerEnv } from "../core/env.module";

/**
 * Purges a user's account and all their data once the grace period on a
 * CONFIRMED deletion request has passed. Deleting the User row cascades to
 * every owned table (see schema.prisma onDelete: Cascade) — AuditLog keeps
 * a userId-nulled trail (onDelete: SetNull) so the audit history survives.
 */
@Injectable()
export class AccountDeletionPurgeService {
  private readonly logger = new Logger(AccountDeletionPurgeService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(StorageService) private readonly storage: StorageService,
    @Inject(SERVER_ENV) private readonly env: ServerEnv,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async sweep(): Promise<void> {
    const due = await this.prisma.deletionRequest.findMany({
      where: { status: "CONFIRMED", scheduledPurgeAt: { lte: new Date() } },
    });

    for (const request of due) {
      await this.purgeUser(request.userId, request.id);
    }

    if (due.length > 0) {
      this.logger.log(`Purged ${due.length} account(s) past their deletion grace period.`);
    }
  }

  private async purgeUser(userId: string, requestId: string): Promise<void> {
    const [imports, exports] = await Promise.all([
      this.prisma.csvImportJob.findMany({ where: { userId }, select: { fileKey: true } }),
      this.prisma.dataExportRequest.findMany({
        where: { userId, storageKey: { not: null } },
        select: { storageKey: true },
      }),
    ]);

    await Promise.all([
      ...imports.map((job) =>
        this.storage.delete(this.env.S3_BUCKET_IMPORTS, job.fileKey).catch(() => undefined),
      ),
      ...exports.map((request) =>
        this.storage
          .delete(this.env.S3_BUCKET_EXPORTS, request.storageKey!)
          .catch(() => undefined),
      ),
    ]);

    await this.prisma.$transaction([
      this.prisma.auditLog.create({
        data: {
          userId: null,
          action: "ACCOUNT_DELETION_PURGED",
          targetType: "User",
          targetId: userId,
          metadata: { deletionRequestId: requestId },
        },
      }),
      this.prisma.user.delete({ where: { id: userId } }),
    ]);

    this.logger.log(`Purged user ${userId} (deletion request ${requestId}).`);
  }
}
