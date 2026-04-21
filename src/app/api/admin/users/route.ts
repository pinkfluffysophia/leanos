import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, tags, userTags } from "@/lib/db/schema";
import { desc, eq, ilike, or, count, inArray, and, gt, isNotNull, type SQL } from "drizzle-orm";

export async function GET(request: Request) {
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
    const rawSearch = searchParams.get("search") || "";
    // Escape LIKE wildcards to prevent pattern injection
    const search = rawSearch.replace(/[%_\\]/g, "\\$&");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const tagsParam = searchParams.get("tags") || searchParams.get("tag") || "";
    const roleFilter = searchParams.get("role") || "";
    const statusFilter = searchParams.get("status") || "";
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("perPage") || "20") || 20));
    const offset = (page - 1) * limit;

    // If filtering by tags, get userIds that have ALL selected tags (AND logic)
    let tagFilterUserIds: string[] | null = null;
    const tagIds = tagsParam.split(",").filter(Boolean);
    if (tagIds.length > 0) {
      const taggedUsers = await db
        .select({ userId: userTags.userId })
        .from(userTags)
        .where(inArray(userTags.tagId, tagIds));

      // AND logic: count occurrences per user, keep only those with all tags
      const userTagCounts = new Map<string, number>();
      for (const row of taggedUsers) {
        userTagCounts.set(row.userId, (userTagCounts.get(row.userId) || 0) + 1);
      }
      tagFilterUserIds = [...userTagCounts.entries()]
        .filter(([, c]) => c === tagIds.length)
        .map(([id]) => id);

      // If no users have all selected tags, return empty
      if (tagFilterUserIds.length === 0) {
        return NextResponse.json({
          users: [],
          total: 0,
          page,
          totalPages: 0,
        });
      }
    }

    // Build where conditions
    const conditions: SQL[] = [];

    if (search) {
      const searchCondition = or(
        ilike(users.email, `%${search}%`),
        ilike(users.firstName, `%${search}%`),
        ilike(users.lastName, `%${search}%`)
      );
      if (searchCondition) conditions.push(searchCondition);
    }

    if (tagFilterUserIds) {
      conditions.push(inArray(users.id, tagFilterUserIds));
    }

    if (roleFilter && ["user", "admin"].includes(roleFilter)) {
      conditions.push(eq(users.role, roleFilter as "user" | "admin"));
    }

    if (statusFilter === "active") {
      conditions.push(eq(users.status, "active"));
    } else if (statusFilter === "inactive") {
      conditions.push(eq(users.status, "inactive"));
    } else if (statusFilter === "suspended") {
      conditions.push(isNotNull(users.suspendedUntil));
      conditions.push(gt(users.suspendedUntil, new Date()));
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

    // Return only IDs for bulk selection (messenger page)
    if (searchParams.get("idsOnly") === "true") {
      const allIds = await db
        .select({ id: users.id })
        .from(users)
        .where(whereCondition)
        .orderBy(desc(users.createdAt));
      return NextResponse.json({
        userIds: allIds.map((u) => u.id),
        total: allIds.length,
      });
    }

    const [totalResult] = await db
      .select({ count: count() })
      .from(users)
      .where(whereCondition);

    const userList = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        nickname: users.nickname,
        profilePictureUrl: users.profilePictureUrl,
        status: users.status,
        role: users.role,
        suspendedUntil: users.suspendedUntil,
        lastSeenAt: users.lastSeenAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(whereCondition)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    // Batch-fetch tags for all users on this page
    const userIds = userList.map((u) => u.id);
    let userTagMap: Record<string, { id: string; name: string; color: string }[]> = {};

    if (userIds.length > 0) {
      const userTagRows = await db
        .select({
          userId: userTags.userId,
          tagId: tags.id,
          tagName: tags.name,
          tagColor: tags.color,
        })
        .from(userTags)
        .innerJoin(tags, eq(userTags.tagId, tags.id))
        .where(inArray(userTags.userId, userIds));

      for (const row of userTagRows) {
        if (!userTagMap[row.userId]) {
          userTagMap[row.userId] = [];
        }
        userTagMap[row.userId].push({
          id: row.tagId,
          name: row.tagName,
          color: row.tagColor,
        });
      }
    }

    const usersWithTags = userList.map((u) => ({
      ...u,
      tags: userTagMap[u.id] || [],
    }));

    return NextResponse.json({
      users: usersWithTags,
      total: totalResult.count,
      page,
      totalPages: Math.ceil(totalResult.count / limit),
    });
  } catch (error) {
    console.error("Admin users list error:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}
