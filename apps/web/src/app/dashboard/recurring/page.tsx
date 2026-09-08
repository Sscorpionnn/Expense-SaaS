"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAccounts } from "@/lib/financial-hooks";
import { useDeleteRecurring, useRecurringTransactions } from "@/lib/planning-hooks";
import { formatCurrency, formatDate } from "@/lib/format";
import { RecurringFormDialog } from "./recurring-form-dialog";

export default function RecurringPage() {
  const recurringQuery = useRecurringTransactions();
  const accountsQuery = useAccounts();
  const deleteRecurring = useDeleteRecurring();
  const accountsById = new Map(accountsQuery.data?.items.map((a) => [a.id, a]));

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Recurring transactions</h1>
        <RecurringFormDialog />
      </div>
      <p className="text-sm text-muted-foreground">
        These only send you reminders — no transaction is created automatically.
      </p>

      {recurringQuery.data?.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No recurring transactions yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Next reminder</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {recurringQuery.data?.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.description || item.merchant || item.type}</TableCell>
                  <TableCell>{accountsById.get(item.accountId)?.name ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {item.frequency}
                      {item.interval > 1 ? ` ×${item.interval}` : ""}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(item.nextOccurrenceAt)}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(item.amountMinor, item.currency)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteRecurring.mutate(item.id)}
                      disabled={deleteRecurring.isPending}
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
    </main>
  );
}
