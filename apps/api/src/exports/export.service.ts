import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import { QUEUE_NAMES } from "@expense-saas/config";
import type { DataExportRequestDto } from "@expense-saas/types";
import { PrismaService } from "../core/prisma.service";
import { StorageService } from "../core/storage.service";
import { AuditService } from "../core/audit.service";
import { SERVER_ENV, type ServerEnv } from "../core/env.module";
import { toExportRequestDto } from "./export.mapper";

export interface GenerateExportJobData {
  requestId: string;
}

/** Signed download URLs are short-lived — the export request's own longer expiry is separate. */
const DOWNLOAD_URL_TTL_SECONDS = 300;

@Injectable()
export class ExportService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(StorageService) private readonly storage: StorageService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(SERVER_ENV) private readonly env: ServerEnv,
    @InjectQueue(QUEUE_NAMES.DATA_EXPORT) private readonly exportQueue: Queue<GenerateExportJobData>,
  ) {}

  async createExportRequest(userId: string): Promise<DataExportRequestDto> {
    const request = await this.prisma.dataExportRequest.create({
      data: { userId, status: "PENDING" },
    });
    await this.exportQueue.add("generate-export", { requestId: request.id });

    await this.audit.record({
      userId,
      action: "DATA_EXPORT_REQUESTED",
      targetType: "DataExportRequest",
      targetId: request.id,
    });

    return toExportRequestDto(request);
  }

  private async findOwnedOrThrow(userId: string, id: string) {
    const request = await this.prisma.dataExportRequest.findFirst({ where: { id, userId } });
    if (!request) throw new NotFoundException("Export request not found");
    return request;
  }

  async getStatus(userId: string, id: string): Promise<DataExportRequestDto> {
    return toExportRequestDto(await this.findOwnedOrThrow(userId, id));
  }

  async getDownloadUrl(userId: string, id: string): Promise<string> {
    const request = await this.findOwnedOrThrow(userId, id);

    if (request.status !== "READY" || !request.storageKey) {
      throw new BadRequestException("Export is not ready yet");
    }
    if (request.expiresAt && request.expiresAt < new Date()) {
      throw new NotFoundException("This export has expired — request a new one");
    }

    const url = await this.storage.getSignedDownloadUrl(
      this.env.S3_BUCKET_EXPORTS,
      request.storageKey,
      DOWNLOAD_URL_TTL_SECONDS,
    );

    await this.prisma.dataExportRequest.update({
      where: { id: request.id },
      data: { downloadedAt: new Date() },
    });
    await this.audit.record({
      userId,
      action: "DATA_EXPORT_DOWNLOADED",
      targetType: "DataExportRequest",
      targetId: request.id,
    });

    return url;
  }
}
