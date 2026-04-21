import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, emailVerificationTokens, passwordResetTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { sendEmail, applyTemplateVariables } from "@/lib/email";

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
    const { userId, subject, html, templateId, templateName, isPlainText } = body;

    if (!userId) {
      return NextResponse.json({ error: "Recipient is required" }, { status: 400 });
    }
    if (!subject?.trim()) {
      return NextResponse.json({ error: "Subject is required" }, { status: 400 });
    }
    if (!html?.trim()) {
      return NextResponse.json({ error: "Email body is required" }, { status: 400 });
    }

    const recipient = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { id: true, email: true, firstName: true, lastName: true },
    });

    if (!recipient) {
      return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
    }

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

    const verifyToken = randomBytes(32).toString("hex");
    await db.insert(emailVerificationTokens).values({
      userId: recipient.id,
      token: verifyToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const resetToken = randomBytes(32).toString("hex");
    await db.insert(passwordResetTokens).values({
      userId: recipient.id,
      token: resetToken,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    const variables = {
      firstName: recipient.firstName,
      lastName: recipient.lastName,
      email: recipient.email,
      fullName: `${recipient.firstName} ${recipient.lastName}`,
      verifyUrl: `${baseUrl}/verify-email?token=${verifyToken}`,
      loginUrl: `${baseUrl}/login`,
      resetUrl: `${baseUrl}/reset-password?token=${resetToken}`,
      productName: "",
      amount: "",
      currency: "",
      date: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
    };
    const finalSubject = applyTemplateVariables(subject.trim(), variables);
    const finalHtml = applyTemplateVariables(html.trim(), variables);

    await sendEmail({
      to: recipient.email,
      subject: finalSubject,
      html: finalHtml,
      isPlainText: !!isPlainText,
      userId: recipient.id,
      templateId: templateId || undefined,
      templateName: templateName || undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Messenger send error:", error);
    const message = error instanceof Error ? error.message : "An error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
