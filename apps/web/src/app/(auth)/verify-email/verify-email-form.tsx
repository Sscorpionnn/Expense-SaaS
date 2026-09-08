"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { AuthCard } from "@/components/auth-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useVerifyEmail } from "@/lib/auth-hooks";

export function VerifyEmailForm() {
  const token = useSearchParams().get("token");
  const verifyMutation = useVerifyEmail();
  const attempted = useRef(false);

  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;
    verifyMutation.mutate({ token });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!token) {
    return (
      <AuthCard title="Invalid link">
        <Alert variant="destructive">
          <AlertDescription>This verification link is missing a token.</AlertDescription>
        </Alert>
      </AuthCard>
    );
  }

  if (verifyMutation.isSuccess) {
    return (
      <AuthCard title="Email verified">
        <Alert>
          <AlertDescription>
            Your email is verified.{" "}
            <Link href="/login" className="underline">
              Log in
            </Link>{" "}
            to continue.
          </AlertDescription>
        </Alert>
      </AuthCard>
    );
  }

  if (verifyMutation.isError) {
    return (
      <AuthCard title="Verification failed">
        <Alert variant="destructive">
          <AlertDescription>
            This link is invalid or has expired. You can request a new one from the login page.
          </AlertDescription>
        </Alert>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Verifying…">
      <p className="text-sm text-muted-foreground">Hold on while we verify your email.</p>
    </AuthCard>
  );
}
