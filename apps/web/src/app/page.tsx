import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold">Expense SaaS</h1>
        <p className="max-w-md text-muted-foreground">
          A personal finance tracking application — manage accounts, transactions, budgets, and
          goals, privately.
        </p>
        <p className="max-w-md text-xs text-muted-foreground">
          This is a financial tracking application, not a bank, payment processor, or
          money-transmission service. It never connects to real bank accounts or moves real
          money.
        </p>
      </div>
      <div className="flex gap-3">
        <Button render={<Link href="/register" />}>Get started</Button>
        <Button variant="outline" render={<Link href="/login" />}>
          Log in
        </Button>
      </div>
    </main>
  );
}
