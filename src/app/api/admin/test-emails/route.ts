import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, emailTemplates, emailVerificationTokens, passwordResetTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { sendEmail, applyTemplateVariables } from "@/lib/email";

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUser = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: { role: true, firstName: true, lastName: true, email: true },
    });

    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { to, templateId } = body;

    if (!to || !templateId) {
      return NextResponse.json(
        { error: "Recipient email and template are required" },
        { status: 400 }
      );
    }

    const template = await db.query.emailTemplates.findFirst({
      where: eq(emailTemplates.id, templateId),
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    const isPlainText = !template.bodyHtml && !!template.bodyText;

    // Look up recipient by email to use their real data
    const recipient = await db.query.users.findFirst({
      where: eq(users.email, to.toLowerCase()),
      columns: { id: true, firstName: true, lastName: true, email: true },
    });

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    let verifyUrl = `${baseUrl}/verify-email`;
    let resetUrl = `${baseUrl}/reset-password`;

    // Generate real tokens if recipient is a registered user
    if (recipient) {
      const verifyToken = randomBytes(32).toString("hex");
      await db.insert(emailVerificationTokens).values({
        userId: recipient.id,
        token: verifyToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      verifyUrl = `${baseUrl}/verify-email?token=${verifyToken}`;

      const resetToken = randomBytes(32).toString("hex");
      await db.insert(passwordResetTokens).values({
        userId: recipient.id,
        token: resetToken,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });
      resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;
    }

    const variables = {
      firstName: recipient?.firstName || "",
      lastName: recipient?.lastName || "",
      email: recipient?.email || to,
      fullName: recipient ? `${recipient.firstName} ${recipient.lastName}` : "",
      verifyUrl,
      loginUrl: `${baseUrl}/login`,
      resetUrl,
      productName: "",
      amount: "",
      currency: "",
      date: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
    };

    const rawContent = template.bodyHtml || template.bodyText || "";
    const finalSubject = applyTemplateVariables(template.subject, variables);
    const finalContent = applyTemplateVariables(rawContent, variables);

    await sendEmail({
      to,
      subject: finalSubject,
      html: finalContent,
      text: isPlainText ? finalContent : (template.bodyText ? applyTemplateVariables(template.bodyText, variables) : undefined),
      isPlainText,
      templateId: template.id,
      templateName: template.name,
    });

    return NextResponse.json({ message: "Test email sent successfully" });
  } catch (error) {
    console.error("Test email error:", error);
    const message = error instanceof Error ? error.message : "Failed to send email";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
