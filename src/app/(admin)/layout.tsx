import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { AdminShell } from "@/components/admin/admin-shell";
import { SessionGuard } from "@/components/shared/session-guard";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  // Check actual role from DB, not stale JWT
  const user = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1)
    .then((result) => result[0]);

  if (!user || user.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-fuchsia-50 dark:from-pink-950/40 dark:via-rose-950/30 dark:to-fuchsia-950/40">
      <SessionGuard requireAdmin />
      <AdminShell>
        {children}
      </AdminShell>
    </div>
  );
}
