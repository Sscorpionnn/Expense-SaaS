"use client";

import { useState } from "react";
import { z } from "zod";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { parseToMinorUnits } from "@expense-saas/config";
import { budgetPeriodTypeSchema, currencyCodeSchema } from "@expense-saas/validation";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useCategories } from "@/lib/financial-hooks";
import { useCreateBudget } from "@/lib/planning-hooks";
import { ApiError } from "@/lib/api-client";

const NONE = "none";

const formSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    categoryId: z.string().optional(),
    amount: z.string().regex(/^\d+(\.\d+)?$/, "Enter a positive decimal amount"),
    currency: currencyCodeSchema,
    periodType: budgetPeriodTypeSchema,
    startDate: z.string().min(1),
    endDate: z.string().optional(),
  })
  .refine((data) => data.periodType !== "CUSTOM" || !!data.endDate, {
    message: "End date is required for a custom period",
    path: ["endDate"],
  });
type FormValues = z.infer<typeof formSchema>;

export function BudgetFormDialog() {
  const [open, setOpen] = useState(false);
  const categoriesQuery = useCategories();
  const expenseCategories = (categoriesQuery.data?.items ?? []).filter(
    (c) => c.type === "EXPENSE",
  );
  const createBudget = useCreateBudget();

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      periodType: "MONTHLY",
      currency: "USD",
      startDate: new Date().toISOString().slice(0, 10),
    },
  });
  const periodType = watch("periodType");

  const onSubmit = (values: FormValues) => {
    createBudget.mutate(
      {
        name: values.name,
        categoryId: !values.categoryId || values.categoryId === NONE ? null : values.categoryId,
        amountMinor: parseToMinorUnits(values.amount, values.currency),
        currency: values.currency,
        periodType: values.periodType,
        startDate: new Date(values.startDate).toISOString(),
        endDate: values.endDate ? new Date(values.endDate).toISOString() : null,
      },
      { onSuccess: () => { setOpen(false); reset(); } },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) reset(); }}>
      <DialogTrigger render={<Button />}>New budget</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New budget</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          {createBudget.isError ? (
            <Alert variant="destructive">
              <AlertDescription>
                {createBudget.error instanceof ApiError
                  ? createBudget.error.message
                  : "Something went wrong."}
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...register("name")} />
            <FieldError message={errors.name?.message} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="categoryId">Category</Label>
            <Controller
              control={control}
              name="categoryId"
              render={({ field }) => (
                <Select value={field.value ?? NONE} onValueChange={field.onChange}>
                  <SelectTrigger id="categoryId" className="w-full">
                    <SelectValue placeholder="Overall (all expenses)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Overall (all expenses)</SelectItem>
                    {expenseCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" inputMode="decimal" {...register("amount")} />
              <FieldError message={errors.amount?.message} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" maxLength={3} {...register("currency")} />
              <FieldError message={errors.currency?.message} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="periodType">Period</Label>
            <Controller
              control={control}
              name="periodType"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="periodType" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MONTHLY">Monthly (rolls every month)</SelectItem>
                    <SelectItem value="CUSTOM">Custom date range</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="startDate">{periodType === "CUSTOM" ? "Start date" : "Anchor date"}</Label>
              <Input id="startDate" type="date" {...register("startDate")} />
            </div>
            {periodType === "CUSTOM" ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="endDate">End date</Label>
                <Input id="endDate" type="date" {...register("endDate")} />
                <FieldError message={errors.endDate?.message} />
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={createBudget.isPending}>
              {createBudget.isPending ? "Creating…" : "Create budget"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
