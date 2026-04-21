import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, waitlists, waitlistMembers } from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";

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

    const list = await db
      .select({
        id: waitlists.id,
        title: waitlists.title,
        description: waitlists.description,
        shortcode: waitlists.shortcode,
        status: waitlists.status,
        createdAt: waitlists.createdAt,
        updatedAt: waitlists.updatedAt,
        memberCount: sql<number>`count(${waitlistMembers.id})::int`,
      })
      .from(waitlists)
      .leftJoin(waitlistMembers, eq(waitlists.id, waitlistMembers.waitlistId))
      .groupBy(waitlists.id)
      .orderBy(desc(waitlists.createdAt));

    return NextResponse.json({ waitlists: list });
  } catch (error) {
    console.error("Waitlists GET error:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!(await checkAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { title, description, shortcode, status } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    // Generate shortcode from title if not provided
    const finalShortcode = shortcode?.trim()
      ? shortcode.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
      : title.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

    if (!finalShortcode) {
      return NextResponse.json({ error: "Invalid shortcode" }, { status: 400 });
    }

    // Check uniqueness
    const existing = await db.query.waitlists.findFirst({
      where: eq(waitlists.shortcode, finalShortcode),
      columns: { id: true },
    });
    if (existing) {
      return NextResponse.json({ error: "This shortcode is already in use" }, { status: 409 });
    }

    const validStatus = status === "inactive" ? "inactive" : "active";

    const [waitlist] = await db
      .insert(waitlists)
      .values({
        title: title.trim(),
        description: description?.trim() || null,
        shortcode: finalShortcode,
        status: validStatus,
      })
      .returning();

    return NextResponse.json({ waitlist });
  } catch (error) {
    console.error("Waitlists POST error:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
