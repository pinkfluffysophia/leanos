import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, emailTemplates } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

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

    const templates = await db
      .select()
      .from(emailTemplates)
      .orderBy(desc(emailTemplates.updatedAt));

    return NextResponse.json({ templates });
  } catch (error) {
    console.error("Email templates GET error:", error);
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
    const { name, subject, bodyHtml, bodyText, type } = body;

    if (!name || !subject || (!bodyHtml && !bodyText) || !type) {
      return NextResponse.json(
        { error: "Name, subject, body, and type are required" },
        { status: 400 }
      );
    }

    // Enforce unique types (except custom)
    if (type !== "custom") {
      const existing = await db.query.emailTemplates.findFirst({
        where: eq(emailTemplates.type, type),
      });
      if (existing) {
        return NextResponse.json(
          { error: `A template with type "${type}" already exists` },
          { status: 400 }
        );
      }
    }

    const [template] = await db
      .insert(emailTemplates)
      .values({
        name,
        subject,
        bodyHtml,
        bodyText: bodyText || null,
        type,
      })
      .returning();

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error("Email templates POST error:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}
