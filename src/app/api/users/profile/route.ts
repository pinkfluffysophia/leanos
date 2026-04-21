import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        nickname: true,
        profilePictureUrl: true,
        referralCode: true,
        referredBy: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Count how many users this person has referred
    const [{ count: referralCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.referredBy, session.user.id));

    return NextResponse.json({ ...user, referralCount });
  } catch (error) {
    console.error("Profile fetch error:", error);
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

    const body = await request.json();
    const { firstName, lastName, nickname } = body;

    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: "First name and last name are required" },
        { status: 400 }
      );
    }

    const lettersOnly = /^[a-zA-Z]+$/;
    if (!lettersOnly.test(firstName) || !lettersOnly.test(lastName)) {
      return NextResponse.json(
        { error: "First name and last name can only contain letters" },
        { status: 400 }
      );
    }

    if (nickname && !lettersOnly.test(nickname)) {
      return NextResponse.json(
        { error: "Nickname can only contain letters" },
        { status: 400 }
      );
    }

    await db
      .update(users)
      .set({
        firstName,
        lastName,
        nickname: nickname || null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.user.id));

    return NextResponse.json({ message: "Profile updated successfully" });
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json(
      { error: "An error occurred while updating profile" },
      { status: 500 }
    );
  }
}
