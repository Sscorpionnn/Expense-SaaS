"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRevokeSession, useSessions } from "@/lib/auth-hooks";
import { ImportCard } from "./import-card";
import { ExportCard } from "./export-card";
import { PrivacyCard } from "./privacy-card";
import { DangerZoneCard } from "./danger-zone-card";

export default function SettingsPage() {
  const sessionsQuery = useSessions();
  const revokeSessionMutation = useRevokeSession();

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Active sessions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {sessionsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : null}
          {sessionsQuery.data?.sessions.map((session) => (
            <div
              key={session.id}
              className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2"
            >
              <div className="text-sm">
                <p className="font-medium">
                  {session.isCurrent ? "This device" : (session.userAgent ?? "Unknown device")}
                </p>
                <p className="text-muted-foreground">
                  Signed in {new Date(session.createdAt).toLocaleString()}
                </p>
              </div>
              {!session.isCurrent ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => revokeSessionMutation.mutate(session.id)}
                  disabled={revokeSessionMutation.isPending}
                >
                  Revoke
                </Button>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <ImportCard />
      <ExportCard />
      <PrivacyCard />
      <DangerZoneCard />
    </main>
  );
}
