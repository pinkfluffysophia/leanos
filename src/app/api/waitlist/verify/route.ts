import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { waitlistMembers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const member = await db.query.waitlistMembers.findFirst({
      where: eq(waitlistMembers.verificationToken, token),
      columns: { id: true, isVerified: true },
    });

    if (!member) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 404 });
    }

    if (member.isVerified) {
      return NextResponse.json({ message: "Email already verified" });
    }

    await db
      .update(waitlistMembers)
      .set({ isVerified: true, verificationToken: null })
      .where(eq(waitlistMembers.id, member.id));

    return NextResponse.json({ message: "Email verified successfully" });
  } catch (error) {
    console.error("Waitlist verify error:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
