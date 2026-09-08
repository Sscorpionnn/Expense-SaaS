"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { AuthCard } from "@/components/auth-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useConfirmDeletion } from "@/lib/account-hooks";

export function ConfirmDeletionForm() {
  const token = useSearchParams().get("token");
  const confirmMutation = useConfirmDeletion();
  const attempted = useRef(false);

  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;
    confirmMutation.mutate({ token });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!token) {
    return (
      <AuthCard title="Invalid link">
        <Alert variant="destructive">
          <AlertDescription>This confirmation link is missing a token.</AlertDescription>
        </Alert>
      </AuthCard>
    );
  }

  if (confirmMutation.isSuccess) {
    const purgeDate = confirmMutation.data.scheduledPurgeAt
      ? new Date(confirmMutation.data.scheduledPurgeAt).toLocaleDateString()
      : null;
    return (
      <AuthCard title="Deletion confirmed">
        <Alert>
          <AlertDescription>
            Your account is scheduled for permanent deletion
            {purgeDate ? ` on ${purgeDate}` : ""}. You can still cancel this from your
            account&apos;s settings page before then.{" "}
            <Link href="/login" className="underline">
              Log in
            </Link>{" "}
            to manage it.
          </AlertDescription>
        </Alert>
      </AuthCard>
    );
  }

  if (confirmMutation.isError) {
    return (
      <AuthCard title="Confirmation failed">
        <Alert variant="destructive">
          <AlertDescription>
            This link is invalid or has expired. Log in and request account deletion again from
            Settings if this was a mistake.
          </AlertDescription>
        </Alert>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Confirming…">
      <p className="text-sm text-muted-foreground">Hold on while we confirm your request.</p>
    </AuthCard>
  );
}
