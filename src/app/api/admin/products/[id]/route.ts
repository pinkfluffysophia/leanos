import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, products, prices } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
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
      with: {
        prices: true,
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json({ product });
  } catch (error) {
    console.error("Product GET error:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await checkAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, shortDescription, fullDescription, status, isPublic } = body;

    const existing = await db.query.products.findFirst({
      where: eq(products.id, id),
    });

    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    const nameChanged = name !== undefined && name.trim() !== existing.name;
    const shortDescChanged = shortDescription !== undefined && (shortDescription?.trim() || null) !== existing.shortDescription;
    const statusChanged = status !== undefined && status !== existing.status;

    if (name !== undefined) updateData.name = name.trim();
    if (shortDescription !== undefined) updateData.shortDescription = shortDescription?.trim() || null;
    if (fullDescription !== undefined) updateData.fullDescription = fullDescription?.trim() || null;
    if (status !== undefined) updateData.status = status;
    if (isPublic !== undefined) updateData.isPublic = isPublic;

    // Stripe sync for product metadata
    if (existing.stripeProductId && (nameChanged || shortDescChanged || statusChanged)) {
      try {
        const stripe = await getStripe();
        const productUpdate: Stripe.ProductUpdateParams = {};
        if (nameChanged) productUpdate.name = name.trim();
        if (shortDescChanged) productUpdate.description = shortDescription?.trim() || "";
        if (statusChanged) productUpdate.active = status === "active";
        await stripe.products.update(existing.stripeProductId, productUpdate);
      } catch (stripeError: unknown) {
        const message = stripeError instanceof Error ? stripeError.message : "Failed to sync with Stripe";
        console.error("Stripe update error:", stripeError);
        return NextResponse.json({ error: message }, { status: 502 });
      }
    }

    await db.update(products).set(updateData).where(eq(products.id, id));

    return NextResponse.json({ message: "Product updated successfully" });
  } catch (error) {
    console.error("Products PATCH error:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await checkAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const existing = await db.query.products.findFirst({
      where: eq(products.id, id),
      with: { prices: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Archive all prices and product on Stripe
    if (existing.stripeProductId) {
      try {
        const stripe = await getStripe();
        // Archive all Stripe prices
        for (const price of existing.prices) {
          if (price.stripePriceId) {
            await stripe.prices.update(price.stripePriceId, { active: false });
          }
        }
        await stripe.products.update(existing.stripeProductId, { active: false });
      } catch (stripeError) {
        console.error("Stripe archive error:", stripeError);
      }
    }

    // Cascade delete handles prices
    await db.delete(products).where(eq(products.id, id));

    return NextResponse.json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("Products DELETE error:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
