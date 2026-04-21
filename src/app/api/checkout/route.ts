import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { products, prices } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getStripe } from "@/lib/stripe";

export async function POST(request: Request) {
  try {
    const session = await auth();

    const body = await request.json();
    const { productId, priceId } = body;

    if (!productId) {
      return NextResponse.json({ error: "Product ID is required" }, { status: 400 });
    }

    const product = await db.query.products.findFirst({
      where: eq(products.id, productId),
    });

    if (!product || product.status !== "active" || !product.isPublic) {
      return NextResponse.json({ error: "Product not found or unavailable" }, { status: 404 });
    }

    // Find the price to use
    let price;
    if (priceId) {
      price = await db.query.prices.findFirst({
        where: and(
          eq(prices.id, priceId),
          eq(prices.productId, productId),
          eq(prices.isActive, true)
        ),
      });
    } else {
      // Use default price
      price = await db.query.prices.findFirst({
        where: and(
          eq(prices.productId, productId),
          eq(prices.isDefault, true),
          eq(prices.isActive, true)
        ),
      });
      // Fallback to any active price
      if (!price) {
        price = await db.query.prices.findFirst({
          where: and(
            eq(prices.productId, productId),
            eq(prices.isActive, true)
          ),
        });
      }
    }

    if (!price || !price.stripePriceId) {
      return NextResponse.json({ error: "No active price available for this product" }, { status: 400 });
    }

    const stripe = await getStripe();
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

    const isAuthenticated = !!session?.user?.id;

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: price.type === "subscription" ? "subscription" : "payment",
      line_items: [
        {
          price: price.stripePriceId,
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/products/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/products`,
      billing_address_collection: "required",
      adaptive_pricing: { enabled: false },
      ...(isAuthenticated
        ? { customer_email: session.user.email || undefined }
        : {}),
      metadata: {
        ...(isAuthenticated ? { userId: session.user.id } : {}),
        productId: product.id,
        priceId: price.id,
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "An error occurred";
    console.error("Checkout error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
