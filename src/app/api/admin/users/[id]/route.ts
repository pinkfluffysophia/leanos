import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, tags, userTags, adminNotes, purchases, products, prices, emailLogs } from "@/lib/db/schema";
import { eq, desc, sql, and, ne, count, sum } from "drizzle-orm";
import { unlink } from "fs/promises";
import path from "path";

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

    const { id } = await params;

    const user = await db.query.users.findFirst({
      where: eq(users.id, id),
      columns: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        nickname: true,
        profilePictureUrl: true,
        status: true,
        role: true,
        suspendedUntil: true,
        emailVerifiedAt: true,
        referralCode: true,
        referredBy: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Fetch tags
    const userTagList = await db
      .select({
        id: tags.id,
        name: tags.name,
        color: tags.color,
      })
      .from(userTags)
      .innerJoin(tags, eq(userTags.tagId, tags.id))
      .where(eq(userTags.userId, id));

    // Fetch admin notes with author info
    const noteList = await db
      .select({
        id: adminNotes.id,
        content: adminNotes.content,
        authorId: adminNotes.authorId,
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
        attachmentUrl: adminNotes.attachmentUrl,
        attachmentName: adminNotes.attachmentName,
        createdAt: adminNotes.createdAt,
      })
      .from(adminNotes)
      .leftJoin(users, eq(adminNotes.authorId, users.id))
      .where(eq(adminNotes.userId, id))
      .orderBy(desc(adminNotes.createdAt));

    const notes = noteList.map((n) => ({
      id: n.id,
      content: n.content,
      authorId: n.authorId,
      authorName: n.authorFirstName && n.authorLastName
        ? `${n.authorFirstName} ${n.authorLastName}`
        : "Unknown Admin",
      attachmentUrl: n.attachmentUrl,
      attachmentName: n.attachmentName,
      createdAt: n.createdAt,
    }));

    // Resolve referrer name if referredBy exists
    let referrer: { id: string; firstName: string; lastName: string; email: string } | null = null;
    if (user.referredBy) {
      const ref = await db.query.users.findFirst({
        where: eq(users.id, user.referredBy),
        columns: { id: true, firstName: true, lastName: true, email: true },
      });
      if (ref) referrer = ref;
    }

    // Count how many users this person has referred
    const [{ count: referralCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.referredBy, id));

    // Fetch purchase stats (convert to THB)
    const [purchaseCount] = await db
      .select({ count: count() })
      .from(purchases)
      .where(and(eq(purchases.userId, id), eq(purchases.status, "completed")));

    const spentByCurrency = await db
      .select({ currency: purchases.currency, total: sum(purchases.amount) })
      .from(purchases)
      .where(and(eq(purchases.userId, id), eq(purchases.status, "completed")))
      .groupBy(purchases.currency);

    const toTHB: Record<string, number> = {
      THB: 1, USD: 34, EUR: 37, GBP: 43, JPY: 0.23, SGD: 25, AUD: 22, CNY: 4.7,
    };
    let totalSpentTHB = 0;
    for (const r of spentByCurrency) {
      const amount = Number(r.total) || 0;
      const rate = toTHB[r.currency.toUpperCase()] || 34;
      totalSpentTHB += amount * rate;
    }

    // Fetch purchases with product info (paginated)
    const { searchParams } = new URL(_request.url);
    const purchasePage = Math.max(1, parseInt(searchParams.get("purchasePage") || "1") || 1);
    const purchaseLimit = 5;
    const purchaseOffset = (purchasePage - 1) * purchaseLimit;

    const [{ count: purchaseTotal }] = await db
      .select({ count: count() })
      .from(purchases)
      .where(eq(purchases.userId, id));

    const purchaseList = await db
      .select({
        id: purchases.id,
        amount: purchases.amount,
        currency: purchases.currency,
        status: purchases.status,
        stripePaymentId: purchases.stripePaymentId,
        createdAt: purchases.createdAt,
        productName: products.name,
        productImage: products.imageUrl,
        priceType: prices.type,
        priceInterval: prices.interval,
      })
      .from(purchases)
      .leftJoin(products, eq(purchases.productId, products.id))
      .leftJoin(prices, eq(purchases.priceId, prices.id))
      .where(eq(purchases.userId, id))
      .orderBy(desc(purchases.createdAt))
      .limit(purchaseLimit)
      .offset(purchaseOffset);

    // Fetch active products (distinct products from completed purchases)
    const activeProductRows = await db
      .select({
        productId: products.id,
        productName: products.name,
        productImage: products.imageUrl,
        shortDescription: products.shortDescription,
        priceType: prices.type,
        priceInterval: prices.interval,
      })
      .from(purchases)
      .innerJoin(products, eq(purchases.productId, products.id))
      .leftJoin(prices, eq(purchases.priceId, prices.id))
      .where(and(eq(purchases.userId, id), eq(purchases.status, "completed")))
      .orderBy(desc(purchases.createdAt));

    const seenProductIds = new Set<string>();
    const activeProducts = activeProductRows.filter((row) => {
      if (!row.productId || seenProductIds.has(row.productId)) return false;
      seenProductIds.add(row.productId);
      return true;
    });

    // Fetch recent email logs (latest 5)
    const [emailLogCountResult] = await db
      .select({ count: count() })
      .from(emailLogs)
      .where(eq(emailLogs.userId, id));

    const recentEmailLogs = await db
      .select({
        id: emailLogs.id,
        toEmail: emailLogs.toEmail,
        subject: emailLogs.subject,
        status: emailLogs.status,
        sentAt: emailLogs.sentAt,
        errorMessage: emailLogs.errorMessage,
        templateName: emailLogs.templateName,
        templateBodyHtml: emailLogs.templateBodyHtml,
      })
      .from(emailLogs)
      .where(eq(emailLogs.userId, id))
      .orderBy(desc(emailLogs.sentAt))
      .limit(5);

    return NextResponse.json({
      user,
      tags: userTagList,
      notes,
      referrer,
      referralCount,
      activeProducts,
      purchaseStats: {
        count: purchaseCount.count,
        total: Math.round(totalSpentTHB),
      },
      purchases: purchaseList,
      purchasePages: Math.ceil(purchaseTotal / purchaseLimit),
      purchasePage,
      emailLogs: recentEmailLogs,
      emailLogCount: emailLogCountResult.count,
    });
  } catch (error) {
    console.error("Admin user GET error:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminId = await checkAdmin();
    if (!adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { role, status, firstName, lastName, nickname, email, suspendedUntil } = body;

    // Check user exists
    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, id),
      columns: { id: true, role: true },
    });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Prevent admin from changing their own role or suspending themselves
    if (id === adminId) {
      if (role && role !== "admin") {
        return NextResponse.json(
          { error: "You cannot change your own role" },
          { status: 400 }
        );
      }
      if (suspendedUntil !== undefined && suspendedUntil !== null) {
        return NextResponse.json(
          { error: "You cannot suspend yourself" },
          { status: 400 }
        );
      }
    }

    // Prevent admins from modifying other admins' sensitive fields (but allow role demotion)
    if (id !== adminId && targetUser.role === "admin") {
      if (status !== undefined || suspendedUntil !== undefined || email !== undefined) {
        return NextResponse.json(
          { error: "You cannot modify another admin's status, email, or suspension" },
          { status: 403 }
        );
      }
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    let bumpSession = false;

    if (role !== undefined) {
      if (!["user", "admin"].includes(role)) {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      }
      updateData.role = role;
      bumpSession = true;
    }

    if (status !== undefined) {
      if (!["active", "inactive"].includes(status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      updateData.status = status;
      bumpSession = true;
    }

    if (firstName !== undefined) {
      if (!firstName.trim()) {
        return NextResponse.json({ error: "First name is required" }, { status: 400 });
      }
      updateData.firstName = firstName.trim();
      bumpSession = true;
    }

    if (lastName !== undefined) {
      if (!lastName.trim()) {
        return NextResponse.json({ error: "Last name is required" }, { status: 400 });
      }
      updateData.lastName = lastName.trim();
      bumpSession = true;
    }

    if (nickname !== undefined) {
      updateData.nickname = nickname ? nickname.trim() || null : null;
    }

    if (email !== undefined) {
      if (!email.trim()) {
        return NextResponse.json({ error: "Email is required" }, { status: 400 });
      }
      const normalizedEmail = email.trim().toLowerCase();
      // Check if email is already taken by another user
      const existing = await db.query.users.findFirst({
        where: and(eq(users.email, normalizedEmail), ne(users.id, id)),
        columns: { id: true },
      });
      if (existing) {
        return NextResponse.json({ error: "Email is already in use" }, { status: 409 });
      }
      updateData.email = normalizedEmail;
      bumpSession = true;
    }

    // Handle suspension - explicit null means unsuspend
    if (suspendedUntil !== undefined) {
      if (suspendedUntil === null) {
        updateData.suspendedUntil = null;
      } else {
        const date = new Date(suspendedUntil);
        if (isNaN(date.getTime())) {
          return NextResponse.json({ error: "Invalid suspension date" }, { status: 400 });
        }
        updateData.suspendedUntil = date;
      }
      bumpSession = true;
    }

    // Only bump session version for security-relevant changes
    if (bumpSession) {
      updateData.sessionVersion = sql`${users.sessionVersion} + 1`;
    }

    await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id));

    return NextResponse.json({ message: "User updated successfully" });
  } catch (error) {
    console.error("Admin user update error:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminId = await checkAdmin();
    if (!adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    if (id === adminId) {
      return NextResponse.json(
        { error: "You cannot delete your own account from here" },
        { status: 400 }
      );
    }

    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, id),
      columns: { id: true, role: true, profilePictureUrl: true },
    });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (targetUser.role === "admin") {
      return NextResponse.json(
        { error: "You cannot delete another admin" },
        { status: 403 }
      );
    }

    // Clean up avatar file from disk
    if (targetUser.profilePictureUrl?.startsWith("/uploads/")) {
      const filePath = path.join(process.cwd(), "public", targetUser.profilePictureUrl);
      await unlink(filePath).catch(() => {});
    }

    await db.delete(users).where(eq(users.id, id));

    return NextResponse.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Admin user delete error:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}
