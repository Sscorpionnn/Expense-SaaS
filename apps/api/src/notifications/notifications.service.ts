import { Injectable, NotFoundException } from "@nestjs/common";
import type { NotificationDto, PaginatedResult } from "@expense-saas/types";
import type { NotificationQuery } from "@expense-saas/validation";
import { PrismaService } from "../core/prisma.service";
import { toPaginatedResult, toSkipTake } from "../core/pagination";
import { toNotificationDto } from "./notifications.mapper";

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(
    userId: string,
    query: NotificationQuery,
  ): Promise<PaginatedResult<NotificationDto>> {
    const where = { userId, isRead: query.unreadOnly ? false : undefined };
    const [items, totalItems] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        ...toSkipTake(query),
      }),
      this.prisma.notification.count({ where }),
    ]);
    return toPaginatedResult(items.map(toNotificationDto), totalItems, query);
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }

  async markRead(userId: string, id: string): Promise<NotificationDto> {
    const existing = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException("Notification not found");

    const notification = await this.prisma.notification.update({
      where: { id: existing.id },
      data: { isRead: true },
    });
    return toNotificationDto(notification);
  }
}
