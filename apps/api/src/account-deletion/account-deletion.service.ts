import { BadRequestException, Inject, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { ACCOUNT_DELETION } from "@expense-saas/config";
import type { DeletionRequestDto } from "@expense-saas/types";
import { PrismaService } from "../core/prisma.service";
import { MailerService } from "../core/mailer.service";
import { AuditService } from "../core/audit.service";
import { SERVER_ENV, type ServerEnv } from "../core/env.module";
import { generateOpaqueToken, hashToken } from "../auth/token.util";
import { toDeletionRequestDto } from "./account-deletion.mapper";

interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AccountDeletionService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MailerService) private readonly mailer: MailerService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(SERVER_ENV) private readonly env: ServerEnv,
  ) {}

  async getCurrent(userId: string): Promise<DeletionRequestDto | null> {
    const request = await this.prisma.deletionRequest.findFirst({
      where: { userId, status: { in: ["PENDING", "CONFIRMED"] } },
      orderBy: { requestedAt: "desc" },
    });
    return request ? toDeletionRequestDto(request) : null;
  }

  async requestDeletion(userId: string, meta: RequestMeta): Promise<DeletionRequestDto> {
    const existing = await this.prisma.deletionRequest.findFirst({
      where: { userId, status: { in: ["PENDING", "CONFIRMED"] } },
    });
    if (existing) return toDeletionRequestDto(existing);

    const rawToken = generateOpaqueToken();
    const request = await this.prisma.deletionRequest.create({
      data: { userId, confirmationTokenHash: hashToken(rawToken) },
    });

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const confirmUrl = `${this.env.WEB_URL}/account/confirm-deletion?token=${rawToken}`;
    await this.mailer.sendAccountDeletionConfirmationEmail(
      user.email,
      confirmUrl,
      ACCOUNT_DELETION.GRACE_PERIOD_DAYS,
    );

    await this.audit.record({
      userId,
      action: "ACCOUNT_DELETION_REQUESTED",
      targetType: "DeletionRequest",
      targetId: request.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return toDeletionRequestDto(request);
  }

  async confirm(rawToken: string): Promise<DeletionRequestDto> {
    const tokenHash = hashToken(rawToken);
    const request = await this.prisma.deletionRequest.findUnique({ where: { confirmationTokenHash: tokenHash } });
    if (!request || request.status !== "PENDING") {
      throw new UnauthorizedException("Invalid or expired confirmation link");
    }

    const scheduledPurgeAt = new Date(
      Date.now() + ACCOUNT_DELETION.GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000,
    );
    const updated = await this.prisma.deletionRequest.update({
      where: { id: request.id },
      data: {
        status: "CONFIRMED",
        confirmedAt: new Date(),
        scheduledPurgeAt,
        confirmationTokenHash: null,
      },
    });

    await this.audit.record({
      userId: request.userId,
      action: "ACCOUNT_DELETION_CONFIRMED",
      targetType: "DeletionRequest",
      targetId: request.id,
    });

    return toDeletionRequestDto(updated);
  }

  async cancel(userId: string, id: string, meta: RequestMeta): Promise<void> {
    const request = await this.prisma.deletionRequest.findFirst({ where: { id, userId } });
    if (!request) throw new NotFoundException("Deletion request not found");
    if (request.status !== "PENDING" && request.status !== "CONFIRMED") {
      throw new BadRequestException("This deletion request can no longer be cancelled");
    }

    await this.prisma.deletionRequest.update({
      where: { id: request.id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });

    await this.audit.record({
      userId,
      action: "ACCOUNT_DELETION_CANCELLED",
      targetType: "DeletionRequest",
      targetId: request.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }
}
