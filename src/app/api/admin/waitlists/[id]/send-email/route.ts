import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, waitlistMembers } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { sendEmail, applyTemplateVariables } from "@/lib/email";

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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await checkAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { memberIds, subject, html, delay, templateId, templateName, isPlainText } = body;

    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return NextResponse.json({ error: "No members selected" }, { status: 400 });
    }

    if (!subject?.trim() || !html?.trim()) {
      return NextResponse.json({ error: "Subject and body are required" }, { status: 400 });
    }

    const recipients = await db
      .select({ id: waitlistMembers.id, email: waitlistMembers.email, firstName: waitlistMembers.firstName, lastName: waitlistMembers.lastName })
      .from(waitlistMembers)
      .where(and(eq(waitlistMembers.waitlistId, id), inArray(waitlistMembers.id, memberIds)));

    let sent = 0;
    let failed = 0;
    const errors: { email: string; error: string }[] = [];
    const delayMs = typeof delay === "number" && delay >= 0 ? delay : 500;

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      try {
        const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
        const variables = {
          firstName: recipient.firstName,
          lastName: recipient.lastName,
          email: recipient.email,
          fullName: `${recipient.firstName} ${recipient.lastName}`,
          verifyUrl: `${baseUrl}/verify-email`,
          loginUrl: `${baseUrl}/login`,
          resetUrl: `${baseUrl}/reset-password`,
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
          text: isPlainText ? finalHtml : undefined,
          isPlainText: !!isPlainText,
          templateId: templateId || undefined,
          templateName: templateName || undefined,
        });
        sent++;
      } catch (error) {
        failed++;
        errors.push({
          email: recipient.email,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }

      if (delayMs > 0 && i < recipients.length - 1) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }

    return NextResponse.json({ sent, failed, total: recipients.length, errors });
  } catch (error) {
    console.error("Waitlist send email error:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
