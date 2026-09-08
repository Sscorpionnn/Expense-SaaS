"use client";

import { useMemo, useState } from "react";
import { z } from "zod";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { parseToMinorUnits } from "@expense-saas/config";
import { cuidSchema, transactionTypeSchema } from "@expense-saas/validation";
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
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/field-error";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAccounts, useCategories, useCreateTransaction } from "@/lib/financial-hooks";
import { ApiError } from "@/lib/api-client";

const TYPE_LABELS: Record<string, string> = {
  INCOME: "Income",
  EXPENSE: "Expense",
  TRANSFER: "Transfer",
};

const formSchema = z
  .object({
    accountId: cuidSchema,
    categoryId: cuidSchema.optional(),
    transferAccountId: cuidSchema.optional(),
    type: transactionTypeSchema,
    amount: z.string().regex(/^\d+(\.\d+)?$/, "Enter a positive decimal amount"),
    description: z.string().max(255).optional(),
    merchant: z.string().max(255).optional(),
    notes: z.string().max(2000).optional(),
    occurredAt: z.string().min(1, "Date is required"),
  })
  .refine((data) => data.type !== "TRANSFER" || !!data.transferAccountId, {
    message: "Choose a destination account",
    path: ["transferAccountId"],
  })
  .refine((data) => data.type === "TRANSFER" || !!data.categoryId, {
    message: "Choose a category",
    path: ["categoryId"],
  });
type FormValues = z.infer<typeof formSchema>;

export function TransactionFormDialog() {
  const [open, setOpen] = useState(false);
  const accountsQuery = useAccounts();
  const categoriesQuery = useCategories();
  const createTransaction = useCreateTransaction();

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
      occurredAt: new Date().toISOString().slice(0, 10),
    },
  });

  const type = watch("type");
  const accountId = watch("accountId");
  const selectedAccount = activeAccounts.find((a) => a.id === accountId);
  const categoriesForType = (categoriesQuery.data?.items ?? []).filter((c) => c.type === type);

  const onSubmit = (values: FormValues) => {
    if (!selectedAccount) return;
    createTransaction.mutate(
      {
        accountId: values.accountId,
        categoryId: values.type === "TRANSFER" ? undefined : values.categoryId,
        transferAccountId: values.type === "TRANSFER" ? values.transferAccountId : undefined,
        type: values.type,
        amountMinor: parseToMinorUnits(values.amount, selectedAccount.currency),
        currency: selectedAccount.currency,
        description: values.description || undefined,
        merchant: values.merchant || undefined,
        notes: values.notes || undefined,
        occurredAt: new Date(values.occurredAt).toISOString(),
      },
      {
        onSuccess: () => {
          setOpen(false);
          reset();
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger render={<Button />}>New transaction</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New transaction</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          {createTransaction.isError ? (
            <Alert variant="destructive">
              <AlertDescription>
                {createTransaction.error instanceof ApiError
                  ? createTransaction.error.message
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
                    <SelectValue placeholder="Select a type" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABELS).map(([value, label]) => (
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
            <Label htmlFor="accountId">
              {type === "TRANSFER" ? "From account" : "Account"}
            </Label>
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
                        {account.name} ({account.currency})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError message={errors.accountId?.message} />
          </div>

          {type === "TRANSFER" ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="transferAccountId">To account</Label>
              <Controller
                control={control}
                name="transferAccountId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="transferAccountId" className="w-full">
                      <SelectValue placeholder="Select a destination" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeAccounts
                        .filter((a) => a.id !== accountId)
                        .map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name} ({account.currency})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError message={errors.transferAccountId?.message} />
            </div>
          ) : (
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
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="amount">Amount {selectedAccount ? `(${selectedAccount.currency})` : ""}</Label>
              <Input id="amount" inputMode="decimal" {...register("amount")} />
              <FieldError message={errors.amount?.message} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="occurredAt">Date</Label>
              <Input id="occurredAt" type="date" {...register("occurredAt")} />
              <FieldError message={errors.occurredAt?.message} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Description</Label>
            <Input id="description" {...register("description")} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="merchant">Merchant</Label>
            <Input id="merchant" {...register("merchant")} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={2} {...register("notes")} />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={createTransaction.isPending || !selectedAccount}>
              {createTransaction.isPending ? "Saving…" : "Save transaction"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
