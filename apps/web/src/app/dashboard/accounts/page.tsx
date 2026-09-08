"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAccounts, useUpdateAccount } from "@/lib/financial-hooks";
import { formatCurrency } from "@/lib/format";
import { AccountFormDialog } from "./account-form-dialog";

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  CASH: "Cash",
  BANK: "Bank account",
  CREDIT_CARD: "Credit card",
  SAVINGS: "Savings",
  WALLET: "Wallet",
};

export default function AccountsPage() {
  const accountsQuery = useAccounts();
  const updateAccount = useUpdateAccount();

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Accounts</h1>
        <AccountFormDialog />
      </div>

      {accountsQuery.data?.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You don&apos;t have any accounts yet — create one to start tracking transactions.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {accountsQuery.data?.items.map((account) => (
          <Card key={account.id} className={account.isArchived ? "opacity-60" : undefined}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>{account.name}</CardTitle>
                {account.isArchived ? <Badge variant="secondary">Archived</Badge> : null}
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div>
                <p className="text-2xl font-semibold">
                  {formatCurrency(account.balanceMinor, account.currency)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {ACCOUNT_TYPE_LABELS[account.type]} · {account.currency}
                </p>
              </div>
              {!account.isArchived ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="self-start"
                  onClick={() =>
                    updateAccount.mutate({ id: account.id, input: { isArchived: true } })
                  }
                  disabled={updateAccount.isPending}
                >
                  Archive
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
