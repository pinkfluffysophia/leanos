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

export async function GET() {
  try {
    if (!(await checkAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const productList = await db.query.products.findMany({
      orderBy: [desc(products.createdAt)],
      with: {
        prices: true,
      },
    });

    return NextResponse.json({ products: productList });
  } catch (error) {
    console.error("Products GET error:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!(await checkAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, shortDescription, fullDescription, status, isPublic } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Product name is required" }, { status: 400 });
    }

    const validStatus = status === "inactive" ? "inactive" : "active";

    // Create Stripe Product
    let stripeProductId: string | null = null;
    try {
      const stripe = await getStripe();
      const stripeProduct = await stripe.products.create({
        name: name.trim(),
        description: shortDescription?.trim() || undefined,
        active: validStatus === "active",
      });
      stripeProductId = stripeProduct.id;
    } catch (stripeError: unknown) {
      const message = stripeError instanceof Error ? stripeError.message : "Failed to sync with Stripe";
      console.error("Stripe sync error:", stripeError);
      return NextResponse.json({ error: message }, { status: 502 });
    }

    const [product] = await db
      .insert(products)
      .values({
        name: name.trim(),
        shortDescription: shortDescription?.trim() || null,
        fullDescription: fullDescription?.trim() || null,
        stripeProductId,
        isPublic: isPublic !== false,
        status: validStatus,
      })
      .returning();

    return NextResponse.json({ product });
  } catch (error) {
    console.error("Products POST error:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
