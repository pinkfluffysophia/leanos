import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, purchases } from "@/lib/db/schema";
import { eq, count, sum, and } from "drizzle-orm";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingBag, DollarSign, BookOpen, User, Settings, Shield } from "lucide-react";

export default async function DashboardPage() {
  const session = await auth();

  // Check actual role from DB, not stale JWT
  let isAdmin = false;
  if (session?.user?.id) {
    const user = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1)
      .then((result) => result[0]);
    isAdmin = user?.role === "admin";
  }

  // Fetch purchase stats
  let totalPurchases = 0;
  let totalSpentTHB = 0;
  if (session?.user?.id) {
    const [countResult] = await db
      .select({ count: count() })
      .from(purchases)
      .where(and(eq(purchases.userId, session.user.id), eq(purchases.status, "completed")));
    totalPurchases = countResult.count;

    const spentByCurrency = await db
      .select({ currency: purchases.currency, total: sum(purchases.amount) })
      .from(purchases)
      .where(and(eq(purchases.userId, session.user.id), eq(purchases.status, "completed")))
      .groupBy(purchases.currency);

    const toTHB: Record<string, number> = {
      THB: 1, USD: 34, EUR: 37, GBP: 43, JPY: 0.23, SGD: 25, AUD: 22, CNY: 4.7,
    };
    for (const r of spentByCurrency) {
      const amount = Number(r.total) || 0;
      const rate = toTHB[r.currency.toUpperCase()] || 34;
      totalSpentTHB += amount * rate;
    }
    totalSpentTHB = Math.round(totalSpentTHB);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Welcome back, {session?.user?.firstName}!
        </p>
      </div>

      {/* Admin Notice */}
      {isAdmin && (
        <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-blue-700 dark:text-blue-300">
              <Shield className="mr-2 h-5 w-5" />
              Administrator Access
            </CardTitle>
            <CardDescription className="text-blue-600 dark:text-blue-400">
              You have admin privileges. Access the admin panel to manage the platform.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/dashboard">
              <Button variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900">
                Go to Admin Panel
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Purchases</CardTitle>
            <ShoppingBag className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{totalPurchases}</div>
            <p className="text-xs text-muted-foreground">
              Lifetime purchases
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(totalSpentTHB / 100)}
            </div>
            <p className="text-xs text-muted-foreground">
              Lifetime spending
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Study Progress</CardTitle>
            <BookOpen className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">0%</div>
            <p className="text-xs text-muted-foreground">
              Overall completion
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Action Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Your latest actions and updates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground text-center py-8">
              No recent activity
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks and shortcuts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link href="/profile" className="block">
              <div className="flex items-center p-3 rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                <User className="h-5 w-5 text-blue-500 mr-3" />
                <div>
                  <p className="text-sm font-medium">Update Profile</p>
                  <p className="text-xs text-muted-foreground">
                    Edit your personal information and profile picture
                  </p>
                </div>
              </div>
            </Link>
            <Link href="/settings" className="block">
              <div className="flex items-center p-3 rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                <Settings className="h-5 w-5 text-amber-500 mr-3" />
                <div>
                  <p className="text-sm font-medium">Account Settings</p>
                  <p className="text-xs text-muted-foreground">
                    Manage security, notifications, and preferences
                  </p>
                </div>
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
