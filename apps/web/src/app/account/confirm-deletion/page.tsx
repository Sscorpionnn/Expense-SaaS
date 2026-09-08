import { Suspense } from "react";
import { ConfirmDeletionForm } from "./confirm-deletion-form";

export default function ConfirmDeletionPage() {
  return (
    <Suspense>
      <ConfirmDeletionForm />
    </Suspense>
  );
}
