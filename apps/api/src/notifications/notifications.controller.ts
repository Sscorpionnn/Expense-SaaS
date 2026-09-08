import { Controller, Get, Param, Patch, Query } from "@nestjs/common";
import { notificationQuerySchema, type NotificationQuery } from "@expense-saas/validation";
import type { NotificationDto, PaginatedResult } from "@expense-saas/types";
import { CurrentUser, type AuthenticatedRequestUser } from "../auth/current-user.decorator";
import { ZodValidationPipe } from "../core/zod-validation.pipe";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findMany(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Query(new ZodValidationPipe(notificationQuerySchema)) query: NotificationQuery,
  ): Promise<PaginatedResult<NotificationDto>> {
    return this.notificationsService.findMany(user.id, query);
  }

  @Get("unread-count")
  async unreadCount(
    @CurrentUser() user: AuthenticatedRequestUser,
  ): Promise<{ count: number }> {
    return { count: await this.notificationsService.unreadCount(user.id) };
  }

  @Patch(":id/read")
  markRead(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param("id") id: string,
  ): Promise<NotificationDto> {
    return this.notificationsService.markRead(user.id, id);
  }
}
