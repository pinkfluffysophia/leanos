import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SessionGuard } from "@/components/shared/session-guard";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-fuchsia-50 dark:from-pink-950/40 dark:via-rose-950/30 dark:to-fuchsia-950/40">
      <SessionGuard />
      <DashboardShell>
        {children}
      </DashboardShell>
    </div>
  );
}
