"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useCancelDeletion, useDeletionRequest, useRequestDeletion } from "@/lib/account-hooks";

export function DangerZoneCard() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const deletionQuery = useDeletionRequest();
  const requestDeletion = useRequestDeletion();
  const cancelDeletion = useCancelDeletion();

  const request = deletionQuery.data;

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="text-destructive">Danger zone</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {request ? (
          <div className="rounded-lg border border-destructive/30 px-3 py-2 text-sm">
            {request.status === "PENDING" ? (
              <p>
                Deletion requested. Check your email to confirm — nothing is deleted until
                you do.
              </p>
            ) : (
              <p>
                Account deletion confirmed. Your data will be permanently purged
                {request.scheduledPurgeAt
                  ? ` on ${new Date(request.scheduledPurgeAt).toLocaleDateString()}`
                  : ""}
                .
              </p>
            )}
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              disabled={cancelDeletion.isPending}
              onClick={() => cancelDeletion.mutate(request.id)}
            >
              Cancel deletion
            </Button>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Permanently delete your account and all its data — accounts, transactions,
              budgets, goals, and history. This cannot be undone after the grace period ends.
            </p>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger render={<Button variant="destructive" size="sm" className="self-start" />}>
                Delete my account
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete your account?</DialogTitle>
                  <DialogDescription>
                    We&apos;ll email you a confirmation link. Nothing is deleted until you
                    confirm, and you can cancel any time during the grace period afterward.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={requestDeletion.isPending}
                    onClick={() =>
                      requestDeletion.mutate(undefined, { onSuccess: () => setDialogOpen(false) })
                    }
                  >
                    Send confirmation email
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
      </CardContent>
    </Card>
  );
}
