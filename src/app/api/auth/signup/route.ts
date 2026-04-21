import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import { users, emailVerificationTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { sendEmail, getTemplateByType, applyTemplateVariables } from "@/lib/email";
import { getSetting } from "@/lib/settings";

function generateReferralCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

function generateVerificationToken(): string {
  return randomBytes(32).toString("hex");
}

export async function POST(request: Request) {
  try {
    // Check if registration is open
    const registrationOpen = await getSetting("registrationOpen");
    if (registrationOpen === "false") {
      return NextResponse.json(
        { error: "Registration is currently closed" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email, password, firstName, lastName, referralCode: inputReferralCode } = body;

    // Validate input
    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    const lettersOnly = /^[a-zA-Z]+$/;
    if (!lettersOnly.test(firstName) || !lettersOnly.test(lastName)) {
      return NextResponse.json(
        { error: "First name and last name can only contain letters" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = await hash(password, 12);

    // Generate referral code
    let referralCode = generateReferralCode();

    // Ensure referral code is unique
    let existingCode = await db.query.users.findFirst({
      where: eq(users.referralCode, referralCode),
    });
    while (existingCode) {
      referralCode = generateReferralCode();
      existingCode = await db.query.users.findFirst({
        where: eq(users.referralCode, referralCode),
      });
    }

    // Look up referrer if referral code provided
    let referrerId: string | null = null;
    if (inputReferralCode) {
      const referrer = await db.query.users.findFirst({
        where: eq(users.referralCode, inputReferralCode.toUpperCase()),
        columns: { id: true },
      });
      if (referrer) {
        referrerId = referrer.id;
      }
    }

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        email: email.toLowerCase(),
        passwordHash,
        firstName,
        lastName,
        referralCode,
        referredBy: referrerId,
        status: "inactive",
      })
      .returning();

    // Generate verification token
    const verificationToken = generateVerificationToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await db.insert(emailVerificationTokens).values({
      userId: newUser.id,
      token: verificationToken,
      expiresAt,
    });

    // Send verification email
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const verifyUrl = `${baseUrl}/verify-email?token=${verificationToken}`;
    const variables = { firstName, lastName, email: email.toLowerCase(), verifyUrl };

    try {
      const template = await getTemplateByType("verification");
      const emailSubject = template
        ? applyTemplateVariables(template.subject, variables)
        : "Verify your email address";
      const emailHtml = template
        ? applyTemplateVariables(template.bodyHtml, variables)
        : `
          <h2>Welcome, ${firstName}!</h2>
          <p>Thanks for signing up. Please verify your email address by clicking the link below:</p>
          <p><a href="${verifyUrl}" style="display:inline-block;padding:10px 20px;background-color:#0f172a;color:#ffffff;text-decoration:none;border-radius:6px;">Verify Email</a></p>
          <p>Or copy and paste this URL into your browser:</p>
          <p>${verifyUrl}</p>
          <p>This link expires in 24 hours.</p>
        `;

      await sendEmail({
        to: email.toLowerCase(),
        subject: emailSubject,
        html: emailHtml,
        userId: newUser.id,
        templateId: template?.id,
        templateName: template?.name || "verification",
      });
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
      // Account is created, just couldn't send email — user can resend later
    }

    return NextResponse.json({
      message: "Account created successfully. Please check your email to verify your account.",
      userId: newUser.id,
    });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "An error occurred during signup" },
      { status: 500 }
    );
  }
}
