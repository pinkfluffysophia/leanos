import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { code } = body;

    if (!code) {
      return NextResponse.json(
        { error: "Referral code is required" },
        { status: 400 }
      );
    }

    // Check if user already has a referrer
    const currentUser = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    });

    if (currentUser?.referredBy) {
      return NextResponse.json(
        { error: "You have already used a referral code" },
        { status: 400 }
      );
    }

    // Find user with this referral code
    const referrer = await db.query.users.findFirst({
      where: eq(users.referralCode, code.toUpperCase()),
    });

    if (!referrer) {
      return NextResponse.json(
        { error: "Invalid referral code" },
        { status: 400 }
      );
    }

    // Can't refer yourself
    if (referrer.id === session.user.id) {
      return NextResponse.json(
        { error: "You cannot use your own referral code" },
        { status: 400 }
      );
    }

    // Update user with referrer
    await db
      .update(users)
      .set({
        referredBy: referrer.id,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.user.id));

    return NextResponse.json({ message: "Referral code applied successfully" });
  } catch (error) {
    console.error("Referral error:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}
