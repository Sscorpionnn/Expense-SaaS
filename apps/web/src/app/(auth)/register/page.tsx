"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterInput } from "@expense-saas/validation";
import { AuthCard } from "@/components/auth-card";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useRegister } from "@/lib/auth-hooks";
import { ApiError } from "@/lib/api-client";

export default function RegisterPage() {
  const [submitted, setSubmitted] = useState(false);
  const registerMutation = useRegister();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  if (submitted) {
    return (
      <AuthCard title="Check your email">
        <Alert>
          <AlertDescription>
            We sent a verification link to your email address. Click it to activate your
            account, then{" "}
            <Link href="/login" className="underline">
              log in
            </Link>
            .
          </AlertDescription>
        </Alert>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Create your account" description="Track your spending, privately.">
      <form
        className="flex flex-col gap-4"
        onSubmit={handleSubmit((values) =>
          registerMutation.mutate(values, { onSuccess: () => setSubmitted(true) }),
        )}
      >
        {registerMutation.isError ? (
          <Alert variant="destructive">
            <AlertDescription>
              {registerMutation.error instanceof ApiError
                ? registerMutation.error.message
                : "Something went wrong. Please try again."}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" autoComplete="name" {...register("name")} />
          <FieldError message={errors.name?.message} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...register("email")} />
          <FieldError message={errors.email?.message} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            {...register("password")}
          />
          <FieldError message={errors.password?.message} />
        </div>

        <Button type="submit" disabled={registerMutation.isPending} className="mt-2">
          {registerMutation.isPending ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="text-primary underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </AuthCard>
  );
}
