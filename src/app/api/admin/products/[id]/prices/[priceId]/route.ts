import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, products, prices } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; priceId: string }> }
) {
  try {
    if (!(await checkAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, priceId } = await params;
    const body = await request.json();
    const { amount, currency, type, interval, intervalCount, isDefault, isActive } = body;

    const existing = await db.query.prices.findFirst({
      where: and(eq(prices.id, priceId), eq(prices.productId, id)),
    });

    if (!existing) {
      return NextResponse.json({ error: "Price not found" }, { status: 404 });
    }

    const product = await db.query.products.findFirst({
      where: eq(products.id, id),
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    // Check if price-related fields changed (requires new Stripe Price)
    const finalAmount = amount ?? existing.amount;
    const finalCurrency = currency ? currency.toUpperCase() : existing.currency;
    const finalType = type ?? existing.type;
    const finalInterval = type === "one_time" ? null : (interval ?? existing.interval);
    const finalIntervalCount = type === "one_time" ? null : (intervalCount ?? existing.intervalCount);

    const priceFieldsChanged =
      finalAmount !== existing.amount ||
      finalCurrency !== existing.currency ||
      finalType !== existing.type ||
      finalInterval !== existing.interval ||
      finalIntervalCount !== existing.intervalCount;

    if (priceFieldsChanged) {
      // Validate
      if (finalAmount < 1) {
        return NextResponse.json({ error: "Amount must be at least 1 cent" }, { status: 400 });
      }
      if (!["one_time", "subscription"].includes(finalType)) {
        return NextResponse.json({ error: "Type must be one_time or subscription" }, { status: 400 });
      }
      if (finalType === "subscription") {
        if (!["day", "week", "month", "year"].includes(finalInterval || "")) {
          return NextResponse.json({ error: "Interval is required for subscriptions" }, { status: 400 });
        }
        if (!finalIntervalCount || finalIntervalCount < 1) {
          return NextResponse.json({ error: "Interval count must be at least 1" }, { status: 400 });
        }
      }

      // Create new Stripe Price, archive old
      if (product.stripeProductId) {
        try {
          const stripe = await getStripe();

          const priceParams: Stripe.PriceCreateParams = {
            product: product.stripeProductId,
            unit_amount: finalAmount,
            currency: finalCurrency.toLowerCase(),
          };

          if (finalType === "subscription" && finalInterval) {
            priceParams.recurring = {
              interval: finalInterval as Stripe.PriceCreateParams.Recurring.Interval,
              interval_count: finalIntervalCount ?? 1,
            };
          }

          const newStripePrice = await stripe.prices.create(priceParams);

          // Archive old Stripe price
          if (existing.stripePriceId) {
            await stripe.prices.update(existing.stripePriceId, { active: false });
          }

          updateData.stripePriceId = newStripePrice.id;
        } catch (stripeError: unknown) {
          const message = stripeError instanceof Error ? stripeError.message : "Failed to sync with Stripe";
          console.error("Stripe price update error:", stripeError);
          return NextResponse.json({ error: message }, { status: 502 });
        }
      }

      updateData.amount = finalAmount;
      updateData.currency = finalCurrency;
      updateData.type = finalType;
      updateData.interval = finalInterval;
      updateData.intervalCount = finalIntervalCount;
    }

    // Handle isActive toggle
    if (isActive !== undefined && isActive !== existing.isActive) {
      if (!isActive && existing.stripePriceId && product.stripeProductId) {
        // Deactivating — archive on Stripe
        try {
          const stripe = await getStripe();
          await stripe.prices.update(existing.stripePriceId, { active: false });
        } catch (stripeError) {
          console.error("Stripe deactivate error:", stripeError);
        }
      }
      updateData.isActive = isActive;
    }

    // Handle isDefault toggle
    if (isDefault !== undefined && isDefault !== existing.isDefault) {
      if (isDefault) {
        // Unset other defaults for this product
        await db
          .update(prices)
          .set({ isDefault: false })
          .where(eq(prices.productId, id));
      }
      updateData.isDefault = isDefault;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ message: "No changes" });
    }

    await db
      .update(prices)
      .set(updateData)
      .where(eq(prices.id, priceId));

    const updated = await db.query.prices.findFirst({
      where: eq(prices.id, priceId),
    });

    return NextResponse.json({ price: updated });
  } catch (error) {
    console.error("Prices PATCH error:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; priceId: string }> }
) {
  try {
    if (!(await checkAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, priceId } = await params;

    const existing = await db.query.prices.findFirst({
      where: and(eq(prices.id, priceId), eq(prices.productId, id)),
    });

    if (!existing) {
      return NextResponse.json({ error: "Price not found" }, { status: 404 });
    }

    // Archive on Stripe
    if (existing.stripePriceId) {
      try {
        const stripe = await getStripe();
        await stripe.prices.update(existing.stripePriceId, { active: false });
      } catch (stripeError) {
        console.error("Stripe archive error:", stripeError);
      }
    }

    // Delete locally
    await db.delete(prices).where(eq(prices.id, priceId));

    // If this was the default, promote the next active price
    if (existing.isDefault) {
      const nextPrice = await db
        .select({ id: prices.id })
        .from(prices)
        .where(and(eq(prices.productId, id), eq(prices.isActive, true)))
        .orderBy(desc(prices.createdAt))
        .limit(1);

      if (nextPrice.length > 0) {
        await db
          .update(prices)
          .set({ isDefault: true })
          .where(eq(prices.id, nextPrice[0].id));
      }
    }

    return NextResponse.json({ message: "Price deleted successfully" });
  } catch (error) {
    console.error("Prices DELETE error:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
