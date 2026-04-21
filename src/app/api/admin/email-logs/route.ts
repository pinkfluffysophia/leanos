import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, emailLogs } from "@/lib/db/schema";
import { eq, desc, count } from "drizzle-orm";

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
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = 20;
    const offset = (page - 1) * limit;

    const userId = searchParams.get("userId");
    const whereClause = userId ? eq(emailLogs.userId, userId) : undefined;

    const [totalResult] = await db
      .select({ count: count() })
      .from(emailLogs)
      .where(whereClause);

    const logs = await db
      .select({
        id: emailLogs.id,
        toEmail: emailLogs.toEmail,
        subject: emailLogs.subject,
        status: emailLogs.status,
        sentAt: emailLogs.sentAt,
        errorMessage: emailLogs.errorMessage,
        templateName: emailLogs.templateName,
        templateBodyHtml: emailLogs.templateBodyHtml,
        templateId: emailLogs.templateId,
      })
      .from(emailLogs)
      .where(whereClause)
      .orderBy(desc(emailLogs.sentAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      logs,
      total: totalResult.count,
      page,
      totalPages: Math.ceil(totalResult.count / limit),
    });
  } catch (error) {
    console.error("Email logs error:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}
