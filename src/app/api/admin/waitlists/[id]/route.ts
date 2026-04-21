import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, waitlists, waitlistMembers } from "@/lib/db/schema";
import { eq, and, ne, desc, sql, ilike, or } from "drizzle-orm";

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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await checkAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const verified = searchParams.get("verified"); // "true" | "false" | null
    const page = parseInt(searchParams.get("page") || "1");
    const limit = 20;
    const offset = (page - 1) * limit;

    const waitlist = await db.query.waitlists.findFirst({
      where: eq(waitlists.id, id),
    });

    if (!waitlist) {
      return NextResponse.json({ error: "Waitlist not found" }, { status: 404 });
    }

    // Build member filters
    const conditions = [eq(waitlistMembers.waitlistId, id)];

    if (search) {
      conditions.push(
        or(
          ilike(waitlistMembers.email, `%${search}%`),
          ilike(waitlistMembers.firstName, `%${search}%`),
          ilike(waitlistMembers.lastName, `%${search}%`)
        )!
      );
    }

    if (verified === "true") {
      conditions.push(eq(waitlistMembers.isVerified, true));
    } else if (verified === "false") {
      conditions.push(eq(waitlistMembers.isVerified, false));
    }

    const whereClause = and(...conditions);

    const members = await db
      .select()
      .from(waitlistMembers)
      .where(whereClause)
      .orderBy(desc(waitlistMembers.joinedAt))
      .limit(limit)
      .offset(offset);

    const [{ count: totalMembers }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(waitlistMembers)
      .where(eq(waitlistMembers.waitlistId, id));

    const [{ count: verifiedCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(waitlistMembers)
      .where(and(eq(waitlistMembers.waitlistId, id), eq(waitlistMembers.isVerified, true)));

    const [{ count: filteredTotal }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(waitlistMembers)
      .where(whereClause);

    return NextResponse.json({
      waitlist,
      members,
      totalMembers,
      verifiedCount,
      filteredTotal,
      page,
      totalPages: Math.ceil(filteredTotal / limit),
    });
  } catch (error) {
    console.error("Waitlist detail GET error:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await checkAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { title, description, shortcode, status } = body;

    const existing = await db.query.waitlists.findFirst({
      where: eq(waitlists.id, id),
      columns: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Waitlist not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (title !== undefined) {
      if (!title.trim()) {
        return NextResponse.json({ error: "Title is required" }, { status: 400 });
      }
      updateData.title = title.trim();
    }

    if (description !== undefined) {
      updateData.description = description?.trim() || null;
    }

    if (shortcode !== undefined) {
      const finalShortcode = shortcode.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
      if (!finalShortcode) {
        return NextResponse.json({ error: "Invalid shortcode" }, { status: 400 });
      }
      const duplicate = await db.query.waitlists.findFirst({
        where: and(eq(waitlists.shortcode, finalShortcode), ne(waitlists.id, id)),
        columns: { id: true },
      });
      if (duplicate) {
        return NextResponse.json({ error: "This shortcode is already in use" }, { status: 409 });
      }
      updateData.shortcode = finalShortcode;
    }

    if (status !== undefined) {
      if (!["active", "inactive"].includes(status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      updateData.status = status;
    }

    await db.update(waitlists).set(updateData).where(eq(waitlists.id, id));

    return NextResponse.json({ message: "Waitlist updated successfully" });
  } catch (error) {
    console.error("Waitlist PATCH error:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await checkAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const existing = await db.query.waitlists.findFirst({
      where: eq(waitlists.id, id),
      columns: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Waitlist not found" }, { status: 404 });
    }

    await db.delete(waitlists).where(eq(waitlists.id, id));

    return NextResponse.json({ message: "Waitlist deleted successfully" });
  } catch (error) {
    console.error("Waitlist DELETE error:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
