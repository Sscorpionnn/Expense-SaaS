"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCreateExport, useExportStatus, exportDownloadUrl } from "@/lib/data-transfer-hooks";

export function ExportCard() {
  const [requestId, setRequestId] = useState<string | null>(null);
  const createExport = useCreateExport();
  const statusQuery = useExportStatus(requestId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Export your data</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Generates a CSV of all your transactions. The download link expires a day after
          it&apos;s ready.
        </p>
        <Button
          size="sm"
          className="self-start"
          disabled={createExport.isPending}
          onClick={() => createExport.mutate(undefined, { onSuccess: (req) => setRequestId(req.id) })}
        >
          {createExport.isPending ? "Requesting…" : "Request export"}
        </Button>

        {statusQuery.data ? (
          <div className="rounded-lg border px-3 py-2 text-sm">
            <p>
              Status: <span className="font-medium">{statusQuery.data.status}</span>
            </p>
            {statusQuery.data.status === "READY" ? (
              <a
                href={exportDownloadUrl(statusQuery.data.id)}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline-offset-4 hover:underline"
              >
                Download CSV
              </a>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
