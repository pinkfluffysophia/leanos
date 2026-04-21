import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { products, prices } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const product = await db.query.products.findFirst({
      where: and(
        eq(products.id, id),
        eq(products.status, "active"),
        eq(products.isPublic, true)
      ),
      columns: {
        id: true,
        name: true,
        shortDescription: true,
        fullDescription: true,
        imageUrl: true,
        status: true,
      },
      with: {
        prices: {
          where: eq(prices.isActive, true),
          columns: {
            id: true,
            amount: true,
            currency: true,
            type: true,
            interval: true,
            intervalCount: true,
            isDefault: true,
          },
        },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json({ product });
  } catch (error) {
    console.error("Public product GET error:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
