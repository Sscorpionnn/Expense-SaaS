"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useMarkNotificationRead, useNotifications } from "@/lib/planning-hooks";
import { formatDate } from "@/lib/format";

export default function NotificationsPage() {
  const notificationsQuery = useNotifications();
  const markRead = useMarkNotificationRead();

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">Notifications</h1>

      {notificationsQuery.data?.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">You&apos;re all caught up.</p>
      ) : null}

      <div className="flex flex-col gap-3">
        {notificationsQuery.data?.items.map((notification) => (
          <Card key={notification.id} className={notification.isRead ? "opacity-60" : undefined}>
            <CardContent className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{notification.title}</p>
                  {!notification.isRead ? <Badge>New</Badge> : null}
                </div>
                <p className="text-sm text-muted-foreground">{notification.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDate(notification.createdAt)}
                </p>
              </div>
              {!notification.isRead ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => markRead.mutate(notification.id)}
                  disabled={markRead.isPending}
                >
                  Mark read
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
