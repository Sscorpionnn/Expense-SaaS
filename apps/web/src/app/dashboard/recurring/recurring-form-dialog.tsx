"use client";

import { useMemo, useState } from "react";
import { z } from "zod";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { parseToMinorUnits } from "@expense-saas/config";
import { recurringFrequencySchema, recurringTransactionTypeSchema } from "@expense-saas/validation";
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
import { useAccounts, useCategories } from "@/lib/financial-hooks";
import { useCreateRecurring } from "@/lib/planning-hooks";
import { ApiError } from "@/lib/api-client";

const FREQUENCY_LABELS: Record<string, string> = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  YEARLY: "Yearly",
};

const formSchema = z.object({
  accountId: z.string().min(1, "Choose an account"),
  categoryId: z.string().min(1, "Choose a category"),
  type: recurringTransactionTypeSchema,
  amount: z.string().regex(/^\d+(\.\d+)?$/, "Enter a positive decimal amount"),
  description: z.string().max(255).optional(),
  frequency: recurringFrequencySchema,
  interval: z.coerce.number().int().min(1).max(365),
  startDate: z.string().min(1),
});
type FormValues = z.infer<typeof formSchema>;

export function RecurringFormDialog() {
  const [open, setOpen] = useState(false);
  const accountsQuery = useAccounts();
  const categoriesQuery = useCategories();
  const createRecurring = useCreateRecurring();

  const activeAccounts = useMemo(
    () => accountsQuery.data?.items.filter((a) => !a.isArchived) ?? [],
    [accountsQuery.data],
  );

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
      type: "EXPENSE",
      frequency: "MONTHLY",
      interval: 1,
      startDate: new Date().toISOString().slice(0, 10),
    },
  });
  const type = watch("type");
  const accountId = watch("accountId");
  const selectedAccount = activeAccounts.find((a) => a.id === accountId);
  const categoriesForType = (categoriesQuery.data?.items ?? []).filter((c) => c.type === type);

  const onSubmit = (values: FormValues) => {
    if (!selectedAccount) return;
    createRecurring.mutate(
      {
        accountId: values.accountId,
        categoryId: values.categoryId,
        type: values.type,
        amountMinor: parseToMinorUnits(values.amount, selectedAccount.currency),
        currency: selectedAccount.currency,
        description: values.description || undefined,
        frequency: values.frequency,
        interval: values.interval,
        startDate: new Date(values.startDate).toISOString(),
        isActive: true,
      },
      { onSuccess: () => { setOpen(false); reset(); } },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) reset(); }}>
      <DialogTrigger render={<Button />}>New recurring transaction</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New recurring transaction</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          {createRecurring.isError ? (
            <Alert variant="destructive">
              <AlertDescription>
                {createRecurring.error instanceof ApiError
                  ? createRecurring.error.message
                  : "Something went wrong."}
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="type">Type</Label>
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EXPENSE">Expense</SelectItem>
                    <SelectItem value="INCOME">Income</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="accountId">Account</Label>
            <Controller
              control={control}
              name="accountId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="accountId" className="w-full">
                    <SelectValue placeholder="Select an account" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError message={errors.accountId?.message} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="categoryId">Category</Label>
            <Controller
              control={control}
              name="categoryId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="categoryId" className="w-full">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoriesForType.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError message={errors.categoryId?.message} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="amount">Amount {selectedAccount ? `(${selectedAccount.currency})` : ""}</Label>
              <Input id="amount" inputMode="decimal" {...register("amount")} />
              <FieldError message={errors.amount?.message} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="startDate">Starts on</Label>
              <Input id="startDate" type="date" {...register("startDate")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="frequency">Frequency</Label>
              <Controller
                control={control}
                name="frequency"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="frequency" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="interval">Every N</Label>
              <Input id="interval" type="number" min={1} max={365} {...register("interval")} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Description</Label>
            <Input id="description" {...register("description")} />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={createRecurring.isPending || !selectedAccount}>
              {createRecurring.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
