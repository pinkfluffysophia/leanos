import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, tags, userTags } from "@/lib/db/schema";
import { eq, desc, count } from "drizzle-orm";

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

    const tagList = await db
      .select()
      .from(tags)
      .orderBy(desc(tags.createdAt));

    return NextResponse.json({ tags: tagList });
  } catch (error) {
    console.error("Tags GET error:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
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
    const { name, color } = body;

    if (!name || !color) {
      return NextResponse.json(
        { error: "Name and color are required" },
        { status: 400 }
      );
    }

    if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
      return NextResponse.json(
        { error: "Color must be a valid hex color (e.g. #FF5733)" },
        { status: 400 }
      );
    }

    const existing = await db.query.tags.findFirst({
      where: eq(tags.name, name.trim()),
      columns: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: "A tag with this name already exists" },
        { status: 400 }
      );
    }

    const [tag] = await db
      .insert(tags)
      .values({ name: name.trim(), color })
      .returning();

    return NextResponse.json({ tag });
  } catch (error) {
    console.error("Tags POST error:", error);
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
    const { id, name, color } = body;

    if (!id) {
      return NextResponse.json({ error: "Tag ID is required" }, { status: 400 });
    }

    const existing = await db.query.tags.findFirst({
      where: eq(tags.id, id),
      columns: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    if (name !== undefined && name.trim()) {
      // Check duplicate name (excluding self)
      const duplicate = await db.query.tags.findFirst({
        where: eq(tags.name, name.trim()),
        columns: { id: true },
      });
      if (duplicate && duplicate.id !== id) {
        return NextResponse.json(
          { error: "A tag with this name already exists" },
          { status: 400 }
        );
      }
    }

    if (color !== undefined && !/^#[0-9a-fA-F]{6}$/.test(color)) {
      return NextResponse.json(
        { error: "Color must be a valid hex color (e.g. #FF5733)" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (color !== undefined) updateData.color = color;

    await db.update(tags).set(updateData).where(eq(tags.id, id));

    return NextResponse.json({ message: "Tag updated successfully" });
  } catch (error) {
    console.error("Tags PATCH error:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Tag ID is required" },
        { status: 400 }
      );
    }

    const existing = await db.query.tags.findFirst({
      where: eq(tags.id, id),
      columns: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    // Check if tag is assigned to any users
    const [usage] = await db
      .select({ count: count() })
      .from(userTags)
      .where(eq(userTags.tagId, id));

    if (usage.count > 0) {
      return NextResponse.json(
        { error: `Cannot delete tag — it is assigned to ${usage.count} user${usage.count !== 1 ? "s" : ""}` },
        { status: 409 }
      );
    }

    await db.delete(tags).where(eq(tags.id, id));

    return NextResponse.json({ message: "Tag deleted successfully" });
  } catch (error) {
    console.error("Tags DELETE error:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}
