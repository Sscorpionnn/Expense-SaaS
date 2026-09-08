"use client";

import { useState } from "react";
import { parseToMinorUnits } from "@expense-saas/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useContributeGoal } from "@/lib/planning-hooks";

export function ContributeForm({ goalId, currency }: { goalId: string; currency: string }) {
  const [amount, setAmount] = useState("");
  const contribute = useContributeGoal();

  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!/^\d+(\.\d+)?$/.test(amount)) return;
        contribute.mutate(
          { id: goalId, input: { amountMinor: parseToMinorUnits(amount, currency) } },
          { onSuccess: () => setAmount("") },
        );
      }}
    >
      <Input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Amount"
        inputMode="decimal"
        className="w-28"
      />
      <Button type="submit" size="sm" variant="outline" disabled={contribute.isPending}>
        Contribute
      </Button>
    </form>
  );
}
