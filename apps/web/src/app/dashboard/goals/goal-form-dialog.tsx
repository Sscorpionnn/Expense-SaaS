"use client";

import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { parseToMinorUnits } from "@expense-saas/config";
import { currencyCodeSchema } from "@expense-saas/validation";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/field-error";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useCreateGoal } from "@/lib/planning-hooks";
import { ApiError } from "@/lib/api-client";

const formSchema = z.object({
  name: z.string().trim().min(1).max(100),
  targetAmount: z.string().regex(/^\d+(\.\d+)?$/, "Enter a positive decimal amount"),
  currency: currencyCodeSchema,
  deadline: z.string().optional(),
});
type FormValues = z.infer<typeof formSchema>;

export function GoalFormDialog() {
  const [open, setOpen] = useState(false);
  const createGoal = useCreateGoal();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: { currency: "USD" } });

  const onSubmit = (values: FormValues) => {
    createGoal.mutate(
      {
        name: values.name,
        targetAmountMinor: parseToMinorUnits(values.targetAmount, values.currency),
        currency: values.currency,
        deadline: values.deadline ? new Date(values.deadline).toISOString() : undefined,
      },
      { onSuccess: () => { setOpen(false); reset(); } },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) reset(); }}>
      <DialogTrigger render={<Button />}>New goal</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New goal</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          {createGoal.isError ? (
            <Alert variant="destructive">
              <AlertDescription>
                {createGoal.error instanceof ApiError
                  ? createGoal.error.message
                  : "Something went wrong."}
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...register("name")} />
            <FieldError message={errors.name?.message} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="targetAmount">Target amount</Label>
              <Input id="targetAmount" inputMode="decimal" {...register("targetAmount")} />
              <FieldError message={errors.targetAmount?.message} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" maxLength={3} {...register("currency")} />
              <FieldError message={errors.currency?.message} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="deadline">Deadline (optional)</Label>
            <Input id="deadline" type="date" {...register("deadline")} />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={createGoal.isPending}>
              {createGoal.isPending ? "Creating…" : "Create goal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
