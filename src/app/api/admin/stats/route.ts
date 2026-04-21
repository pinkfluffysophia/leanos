import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, products, stripeConfig } from "@/lib/db/schema";
import { count, desc, eq } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check actual role from DB, not stale JWT
    const currentUser = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1)
      .then((result) => result[0]);

    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [userCount] = await db.select({ count: count() }).from(users);
    const [productCount] = await db.select({ count: count() }).from(products);

    const stripe = await db.query.stripeConfig.findFirst();
    const isPaymentConnected = stripe?.isConnected ?? false;

    const recentSignups = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        status: users.status,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(5);

    return NextResponse.json({
      totalUsers: userCount.count,
      totalProducts: productCount.count,
      isPaymentConnected,
      recentSignups,
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}
