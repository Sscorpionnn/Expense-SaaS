"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAccounts, useDeleteTransaction, useTransactions } from "@/lib/financial-hooks";
import { formatCurrency, formatDate } from "@/lib/format";
import { TransactionFormDialog } from "./transaction-form-dialog";

const ALL = "all";

export default function TransactionsPage() {
  const [accountFilter, setAccountFilter] = useState<string>(ALL);
  const [typeFilter, setTypeFilter] = useState<string>(ALL);
  const [page, setPage] = useState(1);

  const accountsQuery = useAccounts();
  const transactionsQuery = useTransactions({
    accountId: accountFilter === ALL ? undefined : accountFilter,
    type: typeFilter === ALL ? undefined : typeFilter,
    page,
  });
  const deleteTransaction = useDeleteTransaction();

  const accountsById = new Map(accountsQuery.data?.items.map((a) => [a.id, a]));

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Transactions</h1>
        <TransactionFormDialog />
      </div>

      <div className="flex gap-3">
        <Select
          value={accountFilter}
          onValueChange={(value) => {
            setAccountFilter(value ?? ALL);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All accounts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All accounts</SelectItem>
            {accountsQuery.data?.items.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={typeFilter}
          onValueChange={(value) => {
            setTypeFilter(value ?? ALL);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All types</SelectItem>
            <SelectItem value="INCOME">Income</SelectItem>
            <SelectItem value="EXPENSE">Expense</SelectItem>
            <SelectItem value="TRANSFER">Transfer</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {transactionsQuery.data?.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No transactions match these filters.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactionsQuery.data?.items.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell>{formatDate(tx.occurredAt)}</TableCell>
                  <TableCell>{tx.description || tx.merchant || "—"}</TableCell>
                  <TableCell>{accountsById.get(tx.accountId)?.name ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={tx.type === "INCOME" ? "default" : "secondary"}>
                      {tx.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {tx.type === "EXPENSE" ? "-" : ""}
                    {formatCurrency(tx.amountMinor, tx.currency)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteTransaction.mutate(tx.id)}
                      disabled={deleteTransaction.isPending}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {transactionsQuery.data && transactionsQuery.data.totalPages > 1 ? (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {transactionsQuery.data.page} of {transactionsQuery.data.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= transactionsQuery.data.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}
    </main>
  );
}
