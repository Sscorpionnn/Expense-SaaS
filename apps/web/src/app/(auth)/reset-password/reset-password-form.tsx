"use client";

import Link from "next/link";
import { z } from "zod";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { passwordSchema } from "@expense-saas/validation";
import { AuthCard } from "@/components/auth-card";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useResetPassword } from "@/lib/auth-hooks";
import { ApiError } from "@/lib/api-client";

const formSchema = z
  .object({
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof formSchema>;

export function ResetPasswordForm() {
  const token = useSearchParams().get("token");
  const resetMutation = useResetPassword();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) });

  if (!token) {
    return (
      <AuthCard title="Invalid link">
        <Alert variant="destructive">
          <AlertDescription>This reset link is missing a token.</AlertDescription>
        </Alert>
      </AuthCard>
    );
  }

  if (resetMutation.isSuccess) {
    return (
      <AuthCard title="Password updated">
        <Alert>
          <AlertDescription>
            Your password was changed and all previous sessions were signed out.{" "}
            <Link href="/login" className="underline">
              Log in
            </Link>{" "}
            with your new password.
          </AlertDescription>
        </Alert>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password">
      <form
        className="flex flex-col gap-4"
        onSubmit={handleSubmit((values) =>
          resetMutation.mutate({ token, newPassword: values.newPassword }),
        )}
      >
        {resetMutation.isError ? (
          <Alert variant="destructive">
            <AlertDescription>
              {resetMutation.error instanceof ApiError
                ? resetMutation.error.message
                : "This link is invalid or has expired."}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="newPassword">New password</Label>
          <Input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            {...register("newPassword")}
          />
          <FieldError message={errors.newPassword?.message} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            {...register("confirmPassword")}
          />
          <FieldError message={errors.confirmPassword?.message} />
        </div>

        <Button type="submit" disabled={resetMutation.isPending}>
          {resetMutation.isPending ? "Updating…" : "Update password"}
        </Button>
      </form>
    </AuthCard>
  );
}
