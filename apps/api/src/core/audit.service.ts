import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { AuditAction } from "@expense-saas/database";
import { PrismaService } from "./prisma.service";

interface RecordAuditEventInput {
  userId?: string | null;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  ip?: string;
  userAgent?: string;
  /** Must already be sanitized — never pass passwords, tokens, or full records. */
  metadata?: Record<string, string | number | boolean | null>;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordAuditEventInput): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        ipHash: input.ip ? hash(input.ip) : null,
        userAgentHash: input.userAgent ? hash(input.userAgent) : null,
        metadata: input.metadata ?? undefined,
      },
    });
  }
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
