import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, emailVerificationTokens } from "@/lib/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { sendEmail, getTemplateByType, applyTemplateVariables } from "@/lib/email";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { error: "Verification token is required" },
        { status: 400 }
      );
    }

    // Find the token
    const verificationToken = await db.query.emailVerificationTokens.findFirst({
      where: and(
        eq(emailVerificationTokens.token, token),
        gt(emailVerificationTokens.expiresAt, new Date())
      ),
    });

    if (!verificationToken) {
      return NextResponse.json(
        { error: "Invalid or expired verification token" },
        { status: 400 }
      );
    }

    // Fetch user info before updating
    const user = await db.query.users.findFirst({
      where: eq(users.id, verificationToken.userId),
      columns: { id: true, email: true, firstName: true, lastName: true },
    });

    // Update user status to active
    await db
      .update(users)
      .set({
        status: "active",
        emailVerifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, verificationToken.userId));

    // Delete the used token
    await db
      .delete(emailVerificationTokens)
      .where(eq(emailVerificationTokens.id, verificationToken.id));

    // Send welcome email if template exists
    if (user) {
      try {
        const welcomeTemplate = await getTemplateByType("welcome");
        if (welcomeTemplate) {
          const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
          const variables = {
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            loginUrl: `${baseUrl}/login`,
          };
          await sendEmail({
            to: user.email,
            subject: applyTemplateVariables(welcomeTemplate.subject, variables),
            html: applyTemplateVariables(welcomeTemplate.bodyHtml, variables),
            userId: user.id,
            templateId: welcomeTemplate.id,
            templateName: welcomeTemplate.name,
          });
        }
      } catch (emailError) {
        console.error("Failed to send welcome email:", emailError);
      }
    }

    return NextResponse.json({
      message: "Email verified successfully",
    });
  } catch (error) {
    console.error("Verification error:", error);
    return NextResponse.json(
      { error: "An error occurred during verification" },
      { status: 500 }
    );
  }
}
