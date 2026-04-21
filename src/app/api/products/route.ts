import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { products, prices } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function GET() {
  try {
    const productList = await db.query.products.findMany({
      where: and(eq(products.status, "active"), eq(products.isPublic, true)),
      orderBy: [desc(products.createdAt)],
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

    return NextResponse.json({ products: productList });
  } catch (error) {
    console.error("Public products GET error:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
