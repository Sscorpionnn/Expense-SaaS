"use client";

import { useState } from "react";
import { z } from "zod";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { parseToMinorUnits } from "@expense-saas/config";
import { accountTypeSchema, currencyCodeSchema } from "@expense-saas/validation";
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
import { useCreateAccount } from "@/lib/financial-hooks";
import { ApiError } from "@/lib/api-client";

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  CASH: "Cash",
  BANK: "Bank account",
  CREDIT_CARD: "Credit card",
  SAVINGS: "Savings",
  WALLET: "Wallet",
};

const formSchema = z.object({
  name: z.string().trim().min(1).max(100),
  type: accountTypeSchema,
  currency: currencyCodeSchema,
  initialBalance: z.string().regex(/^-?\d+(\.\d+)?$/, "Enter a plain decimal amount"),
});
type FormValues = z.infer<typeof formSchema>;

export function AccountFormDialog() {
  const [open, setOpen] = useState(false);
  const createAccount = useCreateAccount();
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { type: "BANK", currency: "USD", initialBalance: "0" },
  });

  const onSubmit = (values: FormValues) => {
    createAccount.mutate(
      {
        name: values.name,
        type: values.type,
        currency: values.currency,
        initialBalanceMinor: parseToMinorUnits(values.initialBalance, values.currency),
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
      <DialogTrigger render={<Button />}>New account</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New account</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          {createAccount.isError ? (
            <Alert variant="destructive">
              <AlertDescription>
                {createAccount.error instanceof ApiError
                  ? createAccount.error.message
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
                    {Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" maxLength={3} {...register("currency")} />
              <FieldError message={errors.currency?.message} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="initialBalance">Starting balance</Label>
              <Input id="initialBalance" inputMode="decimal" {...register("initialBalance")} />
              <FieldError message={errors.initialBalance?.message} />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={createAccount.isPending}>
              {createAccount.isPending ? "Creating…" : "Create account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
