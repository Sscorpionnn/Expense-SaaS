import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/server-api";
import { DashboardNav } from "./dashboard-nav";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const user = await getServerSession();
  if (!user) redirect("/login");

  return (
    <div className="min-h-svh">
      <DashboardNav />
      {children}
    </div>
  );
}
