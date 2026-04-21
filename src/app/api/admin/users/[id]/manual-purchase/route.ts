import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, purchases, transactions, products, prices } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

async function checkAdmin() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const currentUser = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1)
    .then((result) => result[0]);
  if (!currentUser || currentUser.role !== "admin") return null;
  return session.user.id;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await checkAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: userId } = await params;
    const body = await request.json();
    const { productId, priceId } = body;

    if (!productId || !priceId) {
      return NextResponse.json({ error: "Product and price are required" }, { status: 400 });
    }

    // Verify user exists
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify product exists
    const product = await db.query.products.findFirst({
      where: eq(products.id, productId),
      columns: { id: true },
    });
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Verify price exists, belongs to product, and is one-time
    const price = await db.query.prices.findFirst({
      where: and(
        eq(prices.id, priceId),
        eq(prices.productId, productId),
        eq(prices.isActive, true)
      ),
    });
    if (!price) {
      return NextResponse.json({ error: "Price not found" }, { status: 404 });
    }
    if (price.type !== "one_time") {
      return NextResponse.json({ error: "Only one-time prices are allowed for manual transactions" }, { status: 400 });
    }

    // Create purchase record
    const [purchase] = await db
      .insert(purchases)
      .values({
        userId,
        productId,
        priceId,
        amount: price.amount,
        currency: price.currency,
        stripePaymentId: null,
        status: "completed",
      })
      .returning();

    // Create transaction record
    await db.insert(transactions).values({
      userId,
      purchaseId: purchase.id,
      type: "purchase",
      amount: price.amount,
      currency: price.currency,
      stripeTransactionId: null,
      status: "completed",
    });

    return NextResponse.json({ success: true, purchaseId: purchase.id });
  } catch (error) {
    console.error("Manual purchase error:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
