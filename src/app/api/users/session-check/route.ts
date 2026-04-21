import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ status: "deleted" }, { status: 401 });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: {
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        nickname: true,
        profilePictureUrl: true,
        suspendedUntil: true,
        sessionVersion: true,
      },
    });

    if (!user) {
      return NextResponse.json({ status: "deleted" }, { status: 404 });
    }

    // Update last seen (fire-and-forget)
    db.update(users)
      .set({ lastSeenAt: new Date() })
      .where(eq(users.id, session.user.id))
      .then(() => {})
      .catch(() => {});

    // Check suspension
    if (user.suspendedUntil && new Date(user.suspendedUntil) > new Date()) {
      return NextResponse.json({ status: "suspended" });
    }

    // Version mismatch — return fresh data so client can update session
    if (
      session.user.sessionVersion !== undefined &&
      user.sessionVersion !== session.user.sessionVersion
    ) {
      return NextResponse.json({
        status: "outdated",
        user: {
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          nickname: user.nickname,
          profilePictureUrl: user.profilePictureUrl,
          sessionVersion: user.sessionVersion,
        },
      });
    }

    return NextResponse.json({ status: "valid", role: user.role, email: user.email, nickname: user.nickname });
  } catch (error) {
    console.error("Session check error:", error);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
