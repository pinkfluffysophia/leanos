import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, emailVerificationTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { sendEmail, getTemplateByType, applyTemplateVariables } from "@/lib/email";

function generateVerificationToken(): string {
  return randomBytes(32).toString("hex");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Find the user
    const user = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    });

    if (!user) {
      // Return success even if user doesn't exist (security)
      return NextResponse.json({
        message: "If an account exists, a verification email will be sent",
      });
    }

    if (user.status === "active") {
      return NextResponse.json(
        { error: "Email is already verified" },
        { status: 400 }
      );
    }

    // Delete existing tokens for this user
    await db
      .delete(emailVerificationTokens)
      .where(eq(emailVerificationTokens.userId, user.id));

    // Generate new verification token
    const verificationToken = generateVerificationToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await db.insert(emailVerificationTokens).values({
      userId: user.id,
      token: verificationToken,
      expiresAt,
    });

    // Send verification email
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const verifyUrl = `${baseUrl}/verify-email?token=${verificationToken}`;
    const variables = { firstName: user.firstName, lastName: user.lastName, email: user.email, verifyUrl };

    try {
      const template = await getTemplateByType("verification");
      const emailSubject = template
        ? applyTemplateVariables(template.subject, variables)
        : "Verify your email address";
      const emailHtml = template
        ? applyTemplateVariables(template.bodyHtml, variables)
        : `
          <h2>Email Verification</h2>
          <p>Please verify your email address by clicking the link below:</p>
          <p><a href="${verifyUrl}" style="display:inline-block;padding:10px 20px;background-color:#0f172a;color:#ffffff;text-decoration:none;border-radius:6px;">Verify Email</a></p>
          <p>Or copy and paste this URL into your browser:</p>
          <p>${verifyUrl}</p>
          <p>This link expires in 24 hours.</p>
        `;

      await sendEmail({
        to: user.email,
        subject: emailSubject,
        html: emailHtml,
        userId: user.id,
        templateId: template?.id,
        templateName: template?.name || "verification",
      });
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
      return NextResponse.json(
        { error: "Failed to send verification email. Please try again later." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Verification email sent",
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}
