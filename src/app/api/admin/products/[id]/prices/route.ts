import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, products, prices } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { getStripe } from "@/lib/stripe";
import type Stripe from "stripe";

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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await checkAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const product = await db.query.products.findFirst({
      where: eq(products.id, id),
      columns: { id: true },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const priceList = await db
      .select()
      .from(prices)
      .where(eq(prices.productId, id))
      .orderBy(desc(prices.createdAt));

    return NextResponse.json({ prices: priceList });
  } catch (error) {
    console.error("Prices GET error:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await checkAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { amount, currency, type, interval, intervalCount, isDefault } = body;

    if (!amount || amount < 1) {
      return NextResponse.json({ error: "Amount must be at least 1 cent" }, { status: 400 });
    }
    if (!["one_time", "subscription"].includes(type)) {
      return NextResponse.json({ error: "Type must be one_time or subscription" }, { status: 400 });
    }
    if (type === "subscription") {
      if (!["day", "week", "month", "year"].includes(interval)) {
        return NextResponse.json({ error: "Interval is required for subscriptions" }, { status: 400 });
      }
      if (!intervalCount || intervalCount < 1) {
        return NextResponse.json({ error: "Interval count must be at least 1" }, { status: 400 });
      }
    }

    const product = await db.query.products.findFirst({
      where: eq(products.id, id),
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const validCurrency = (currency || "USD").toUpperCase();

    // Create Stripe Price
    let stripePriceId: string | null = null;
    if (product.stripeProductId) {
      try {
        const stripe = await getStripe();
        const priceParams: Stripe.PriceCreateParams = {
          product: product.stripeProductId,
          unit_amount: amount,
          currency: validCurrency.toLowerCase(),
        };

        if (type === "subscription") {
          priceParams.recurring = {
            interval,
            interval_count: intervalCount,
          };
        }

        const stripePrice = await stripe.prices.create(priceParams);
        stripePriceId = stripePrice.id;
      } catch (stripeError: unknown) {
        const message = stripeError instanceof Error ? stripeError.message : "Failed to sync with Stripe";
        console.error("Stripe price create error:", stripeError);
        return NextResponse.json({ error: message }, { status: 502 });
      }
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      await db
        .update(prices)
        .set({ isDefault: false })
        .where(eq(prices.productId, id));
    }

    // Check if this is the first price — auto-set as default
    const existingPrices = await db
      .select({ id: prices.id })
      .from(prices)
      .where(eq(prices.productId, id))
      .limit(1);

    const shouldBeDefault = isDefault || existingPrices.length === 0;

    const [newPrice] = await db
      .insert(prices)
      .values({
        productId: id,
        amount,
        currency: validCurrency,
        type,
        interval: type === "subscription" ? interval : null,
        intervalCount: type === "subscription" ? intervalCount : null,
        stripePriceId,
        isActive: true,
        isDefault: shouldBeDefault,
      })
      .returning();

    return NextResponse.json({ price: newPrice });
  } catch (error) {
    console.error("Prices POST error:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
