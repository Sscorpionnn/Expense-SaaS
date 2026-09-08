"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLogout } from "@/lib/auth-hooks";
import { useUnreadNotificationCount } from "@/lib/planning-hooks";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/accounts", label: "Accounts" },
  { href: "/dashboard/transactions", label: "Transactions" },
  { href: "/dashboard/budgets", label: "Budgets" },
  { href: "/dashboard/goals", label: "Goals" },
  { href: "/dashboard/recurring", label: "Recurring" },
  { href: "/dashboard/analytics", label: "Analytics" },
];

export function DashboardNav() {
  const pathname = usePathname();
  const router = useRouter();
  const logoutMutation = useLogout();
  const unreadQuery = useUnreadNotificationCount();

  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 px-4 py-3">
        <nav className="flex flex-wrap items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted",
                pathname === item.href ? "bg-muted text-foreground" : "text-muted-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/notifications"
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted",
              pathname === "/dashboard/notifications"
                ? "bg-muted text-foreground"
                : "text-muted-foreground",
            )}
          >
            Notifications
            {unreadQuery.data && unreadQuery.data.count > 0 ? (
              <Badge>{unreadQuery.data.count}</Badge>
            ) : null}
          </Link>
          <Link
            href="/dashboard/settings"
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted",
              pathname === "/dashboard/settings" ? "bg-muted text-foreground" : "text-muted-foreground",
            )}
          >
            Settings
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              logoutMutation.mutate(undefined, { onSuccess: () => router.push("/login") })
            }
            disabled={logoutMutation.isPending}
          >
            {logoutMutation.isPending ? "Logging out…" : "Log out"}
          </Button>
        </div>
      </div>
    </header>
  );
}
