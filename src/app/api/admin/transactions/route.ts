import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, transactions, purchases, products, prices } from "@/lib/db/schema";
import { eq, desc, count, ilike, or, and, sum, type SQL } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUser = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1)
      .then((result) => result[0]);

    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const rawSearch = searchParams.get("search") || "";
    const search = rawSearch.replace(/[%_\\]/g, "\\$&");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const typeFilter = searchParams.get("type") || "";
    const statusFilter = searchParams.get("status") || "";
    const limit = 20;
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions: SQL[] = [];

    if (search) {
      const searchCondition = or(
        ilike(users.email, `%${search}%`),
        ilike(users.firstName, `%${search}%`),
        ilike(users.lastName, `%${search}%`)
      );
      if (searchCondition) conditions.push(searchCondition);
    }

    if (typeFilter && (typeFilter === "purchase" || typeFilter === "refund")) {
      conditions.push(eq(transactions.type, typeFilter));
    }

    if (statusFilter) {
      conditions.push(eq(transactions.status, statusFilter));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalResult] = await db
      .select({ count: count() })
      .from(transactions)
      .leftJoin(users, eq(transactions.userId, users.id))
      .where(whereClause);

    const txList = await db
      .select({
        id: transactions.id,
        type: transactions.type,
        amount: transactions.amount,
        currency: transactions.currency,
        status: transactions.status,
        stripeTransactionId: transactions.stripeTransactionId,
        createdAt: transactions.createdAt,
        purchaseId: transactions.purchaseId,
        userId: transactions.userId,
        userName: users.firstName,
        userLastName: users.lastName,
        userEmail: users.email,
        productName: products.name,
        priceType: prices.type,
        priceInterval: prices.interval,
        priceIntervalCount: prices.intervalCount,
      })
      .from(transactions)
      .leftJoin(users, eq(transactions.userId, users.id))
      .leftJoin(purchases, eq(transactions.purchaseId, purchases.id))
      .leftJoin(products, eq(purchases.productId, products.id))
      .leftJoin(prices, eq(purchases.priceId, prices.id))
      .where(whereClause)
      .orderBy(desc(transactions.createdAt))
      .limit(limit)
      .offset(offset);

    const formatted = txList.map((tx) => ({
      ...tx,
      userName: tx.userName && tx.userLastName
        ? `${tx.userName} ${tx.userLastName}`
        : tx.userName || "Unknown User",
    }));

    // Stats (unfiltered) — group revenue by currency
    const revenueResults = await db
      .select({ currency: transactions.currency, total: sum(transactions.amount) })
      .from(transactions)
      .where(and(eq(transactions.type, "purchase"), eq(transactions.status, "completed")))
      .groupBy(transactions.currency);

    const [totalTxResult] = await db
      .select({ count: count() })
      .from(transactions);

    const [failedResult] = await db
      .select({ count: count() })
      .from(transactions)
      .where(eq(transactions.status, "failed"));

    // Approximate exchange rates to THB (update as needed)
    const toTHB: Record<string, number> = {
      THB: 1,
      USD: 34,
      EUR: 37,
      GBP: 43,
      JPY: 0.23,
      SGD: 25,
      AUD: 22,
      CNY: 4.7,
    };

    let totalRevenueTHB = 0;
    for (const r of revenueResults) {
      const amount = Number(r.total) || 0;
      const rate = toTHB[r.currency.toUpperCase()] || 34; // default to USD rate
      totalRevenueTHB += amount * rate;
    }

    return NextResponse.json({
      transactions: formatted,
      total: totalResult.count,
      page,
      totalPages: Math.ceil(totalResult.count / limit),
      stats: {
        totalRevenue: Math.round(totalRevenueTHB),
        totalTransactions: totalTxResult.count,
        failedTransactions: failedResult.count,
      },
    });
  } catch (error) {
    console.error("Transactions GET error:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}
