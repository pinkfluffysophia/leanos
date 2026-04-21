import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, passwordResetTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { sendEmail, getTemplateByType, applyTemplateVariables } from "@/lib/email";

function generateResetToken(): string {
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

    // Always return success to prevent email enumeration
    const successResponse = NextResponse.json({
      message: "If an account exists with that email, a password reset link will be sent.",
    });

    const user = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
      columns: { id: true, email: true, firstName: true, lastName: true },
    });

    if (!user) {
      return successResponse;
    }

    // Delete existing reset tokens for this user
    await db
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, user.id));

    // Generate new token
    const resetToken = generateResetToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.insert(passwordResetTokens).values({
      userId: user.id,
      token: resetToken,
      expiresAt,
    });

    // Send reset email
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;
    const variables = {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      resetUrl,
    };

    try {
      const template = await getTemplateByType("password_reset");
      const emailSubject = template
        ? applyTemplateVariables(template.subject, variables)
        : "Reset your password";
      const emailHtml = template
        ? applyTemplateVariables(template.bodyHtml, variables)
        : `
          <h2>Password Reset</h2>
          <p>Hey ${user.firstName},</p>
          <p>Someone requested a password reset for your account. Click the link below to choose a new password:</p>
          <p><a href="${resetUrl}" style="display:inline-block;padding:10px 20px;background-color:#0f172a;color:#ffffff;text-decoration:none;border-radius:6px;">Reset Password</a></p>
          <p>Or copy and paste this URL into your browser:</p>
          <p>${resetUrl}</p>
          <p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
        `;

      await sendEmail({
        to: user.email,
        subject: emailSubject,
        html: emailHtml,
        userId: user.id,
        templateId: template?.id,
        templateName: template?.name || "password_reset",
      });
    } catch (emailError) {
      console.error("Failed to send password reset email:", emailError);
    }

    return successResponse;
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}
