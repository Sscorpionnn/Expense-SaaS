"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAccounts } from "@/lib/financial-hooks";
import { useImportStatus, useUploadCsvImport } from "@/lib/data-transfer-hooks";
import { ApiError } from "@/lib/api-client";

export function ImportCard() {
  const accountsQuery = useAccounts();
  const activeAccounts = useMemo(
    () => accountsQuery.data?.items.filter((a) => !a.isArchived) ?? [],
    [accountsQuery.data],
  );
  const [accountId, setAccountId] = useState<string>();
  const [file, setFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  const upload = useUploadCsvImport();
  const statusQuery = useImportStatus(jobId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import transactions from CSV</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Expects columns: date, type (INCOME/EXPENSE), amount, and optionally category,
          description, merchant. Every row posts against the account you pick below.
        </p>

        {upload.isError ? (
          <Alert variant="destructive">
            <AlertDescription>
              {upload.error instanceof ApiError ? upload.error.message : "Upload failed."}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Select value={accountId} onValueChange={(value) => setAccountId(value ?? undefined)}>
            <SelectTrigger className="w-48">
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

          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm"
          />

          <Button
            size="sm"
            disabled={!accountId || !file || upload.isPending}
            onClick={() => {
              if (!accountId || !file) return;
              upload.mutate(
                { accountId, file },
                { onSuccess: (job) => setJobId(job.id) },
              );
            }}
          >
            {upload.isPending ? "Uploading…" : "Upload"}
          </Button>
        </div>

        {statusQuery.data ? (
          <div className="rounded-lg border px-3 py-2 text-sm">
            <p>
              Status: <span className="font-medium">{statusQuery.data.status}</span>
            </p>
            {statusQuery.data.status === "COMPLETED" ? (
              <p className="text-muted-foreground">
                Imported {statusQuery.data.importedRows} of {statusQuery.data.totalRows} row(s)
                {statusQuery.data.skippedRows ? ` — ${statusQuery.data.skippedRows} skipped` : ""}.
              </p>
            ) : null}
            {statusQuery.data.errors && statusQuery.data.errors.length > 0 ? (
              <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                {statusQuery.data.errors.slice(0, 5).map((error, i) => (
                  <li key={i}>
                    Row {error.row}: {error.message}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
