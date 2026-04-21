import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ reason: null });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
      columns: { status: true, passwordHash: true, suspendedUntil: true },
    });

    if (!user) {
      return NextResponse.json({ reason: null });
    }

    // Only reveal account status if the password is correct
    const isPasswordValid = await compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json({ reason: null });
    }

    if (user.status === "inactive") {
      return NextResponse.json({ reason: "unverified" });
    }

    if (user.suspendedUntil && new Date(user.suspendedUntil) > new Date()) {
      return NextResponse.json({ reason: "suspended" });
    }

    return NextResponse.json({ reason: null });
  } catch {
    return NextResponse.json({ reason: null });
  }
}
