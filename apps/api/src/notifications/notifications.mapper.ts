import type { Notification } from "@expense-saas/database";
import type { NotificationDto } from "@expense-saas/types";

export function toNotificationDto(notification: Notification): NotificationDto {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    isRead: notification.isRead,
    createdAt: notification.createdAt.toISOString(),
  };
}
