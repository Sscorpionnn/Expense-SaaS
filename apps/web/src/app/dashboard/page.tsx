"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useMe } from "@/lib/auth-hooks";
import { useAccounts, useTransactions } from "@/lib/financial-hooks";
import { formatCurrency, formatDate } from "@/lib/format";

export default function DashboardPage() {
  const meQuery = useMe();
  const accountsQuery = useAccounts();
  const recentTransactionsQuery = useTransactions({ page: 1 });

  const totalBalance = accountsQuery.data?.items.reduce(
    (sum, account) => sum + BigInt(account.balanceMinor),
    0n,
  );
  const primaryCurrency = accountsQuery.data?.items[0]?.currency ?? "USD";

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">
          Welcome{meQuery.data ? `, ${meQuery.data.user.name}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">Here&apos;s where your money stands.</p>
      </div>

      {meQuery.data && !meQuery.data.user.emailVerified ? (
        <Alert>
          <AlertDescription>
            Your email address isn&apos;t verified yet. Check your inbox for a verification link.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Total balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">
              {totalBalance !== undefined
                ? formatCurrency(totalBalance.toString(), primaryCurrency)
                : "—"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Across {accountsQuery.data?.items.length ?? 0} account
              {accountsQuery.data?.items.length === 1 ? "" : "s"}
            </p>
            <Button variant="outline" size="sm" className="mt-3" render={<Link href="/dashboard/accounts" />}>
              Manage accounts
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {recentTransactionsQuery.data?.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No transactions yet.</p>
            ) : null}
            {recentTransactionsQuery.data?.items.slice(0, 4).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{tx.description || tx.merchant || tx.type}</p>
                  <p className="text-muted-foreground">{formatDate(tx.occurredAt)}</p>
                </div>
                <Badge variant={tx.type === "INCOME" ? "default" : "secondary"}>
                  {tx.type === "EXPENSE" ? "-" : ""}
                  {formatCurrency(tx.amountMinor, tx.currency)}
                </Badge>
              </div>
            ))}
            <Button variant="outline" size="sm" className="mt-2" render={<Link href="/dashboard/transactions" />}>
              View all transactions
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
