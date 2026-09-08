"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMe } from "@/lib/auth-hooks";
import { useUpdatePrivacySettings } from "@/lib/account-hooks";

export function PrivacyCard() {
  const meQuery = useMe();
  const updatePrivacy = useUpdatePrivacySettings();

  const shareUsageAnalytics = meQuery.data?.user.shareUsageAnalytics ?? false;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Privacy</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2">
          <div className="text-sm">
            <p className="font-medium">Share anonymized usage analytics</p>
            <p className="text-muted-foreground">
              Opt-in only. We never share your financial data — only anonymized
              product-usage signals to help us improve the app.
            </p>
          </div>
          <Button
            variant={shareUsageAnalytics ? "default" : "outline"}
            size="sm"
            disabled={meQuery.isLoading || updatePrivacy.isPending}
            onClick={() =>
              updatePrivacy.mutate({ shareUsageAnalytics: !shareUsageAnalytics })
            }
          >
            {shareUsageAnalytics ? "Enabled" : "Disabled"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
