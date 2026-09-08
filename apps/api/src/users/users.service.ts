import { Inject, Injectable } from "@nestjs/common";
import type { UpdatePrivacySettingsInput } from "@expense-saas/validation";
import { PrismaService } from "../core/prisma.service";
import { AuditService } from "../core/audit.service";

@Injectable()
export class UsersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async updatePrivacySettings(
    userId: string,
    dto: UpdatePrivacySettingsInput,
  ): Promise<{ shareUsageAnalytics: boolean }> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { shareUsageAnalytics: dto.shareUsageAnalytics },
    });

    await this.audit.record({
      userId,
      action: "PRIVACY_SETTINGS_UPDATED",
      metadata: { shareUsageAnalytics: user.shareUsageAnalytics },
    });

    return { shareUsageAnalytics: user.shareUsageAnalytics };
  }
}
