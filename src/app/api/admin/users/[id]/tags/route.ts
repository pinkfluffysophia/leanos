import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, tags, userTags } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

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
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminId = await checkAdmin();
    if (!adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: userId } = await params;

    // Verify user exists
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const assigned = await db
      .select({
        id: tags.id,
        name: tags.name,
        color: tags.color,
        assignedAt: userTags.assignedAt,
      })
      .from(userTags)
      .innerJoin(tags, eq(userTags.tagId, tags.id))
      .where(eq(userTags.userId, userId));

    return NextResponse.json({ tags: assigned });
  } catch (error) {
    console.error("User tags GET error:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminId = await checkAdmin();
    if (!adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: userId } = await params;

    // Verify user exists
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const { tagIds } = body;

    if (!Array.isArray(tagIds)) {
      return NextResponse.json(
        { error: "tagIds must be an array" },
        { status: 400 }
      );
    }

    // Filter out duplicates
    const uniqueTagIds = [...new Set(tagIds)] as string[];

    // Validate all tag IDs exist
    if (uniqueTagIds.length > 0) {
      const existingTags = await db
        .select({ id: tags.id })
        .from(tags)
        .where(inArray(tags.id, uniqueTagIds));

      if (existingTags.length !== uniqueTagIds.length) {
        return NextResponse.json(
          { error: "One or more tag IDs are invalid" },
          { status: 400 }
        );
      }
    }

    // Transaction: delete all existing, insert new
    await db.transaction(async (tx) => {
      await tx.delete(userTags).where(eq(userTags.userId, userId));

      if (uniqueTagIds.length > 0) {
        await tx.insert(userTags).values(
          uniqueTagIds.map((tagId) => ({
            userId,
            tagId,
          }))
        );
      }
    });

    // Return updated tags
    const updated = await db
      .select({
        id: tags.id,
        name: tags.name,
        color: tags.color,
        assignedAt: userTags.assignedAt,
      })
      .from(userTags)
      .innerJoin(tags, eq(userTags.tagId, tags.id))
      .where(eq(userTags.userId, userId));

    return NextResponse.json({ tags: updated });
  } catch (error) {
    console.error("User tags PUT error:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
