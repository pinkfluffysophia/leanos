import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, stripeConfig } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { encrypt, decrypt } from "@/lib/encryption";

export async function GET() {
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

    const config = await db.query.stripeConfig.findFirst();

    if (!config) {
      return NextResponse.json({
        secretKey: "",
        publishableKey: "",
        webhookSecret: "",
        isConnected: false,
      });
    }

    return NextResponse.json({
      secretKey: config.secretKey ? "••••••••" : "",
      publishableKey: config.publishableKey || "",
      webhookSecret: config.webhookSecret ? "••••••••" : "",
      isConnected: config.isConnected,
    });
  } catch (error) {
    console.error("Stripe config GET error:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
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

    const body = await request.json();
    const { secretKey, publishableKey, webhookSecret, isConnected } = body;

    const existing = await db.query.stripeConfig.findFirst();

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (secretKey !== undefined && secretKey !== "••••••••") {
      updateData.secretKey = secretKey ? encrypt(secretKey) : "";
    }
    if (publishableKey !== undefined) updateData.publishableKey = publishableKey;
    if (webhookSecret !== undefined && webhookSecret !== "••••••••") {
      updateData.webhookSecret = webhookSecret ? encrypt(webhookSecret) : "";
    }
    if (isConnected !== undefined) updateData.isConnected = isConnected;

    if (existing) {
      await db
        .update(stripeConfig)
        .set(updateData)
        .where(eq(stripeConfig.id, existing.id));
    } else {
      await db.insert(stripeConfig).values({
        secretKey: "",
        publishableKey: "",
        webhookSecret: "",
        isConnected: false,
        ...updateData,
      });
    }

    return NextResponse.json({ message: "Stripe config updated successfully" });
  } catch (error) {
    console.error("Stripe config PATCH error:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}
