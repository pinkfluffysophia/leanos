import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { waitlists, waitlistMembers } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { sendEmail } from "@/lib/email";

// Simple in-memory rate limiter: max 5 joins per IP per 15 minutes
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 5;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ shortcode: string }> }
) {
  try {
    const { shortcode } = await params;

    const waitlist = await db.query.waitlists.findFirst({
      where: and(eq(waitlists.shortcode, shortcode), eq(waitlists.status, "active")),
      columns: {
        id: true,
        title: true,
        description: true,
        shortcode: true,
      },
    });

    if (!waitlist) {
      return NextResponse.json({ error: "Waitlist not found" }, { status: 404 });
    }

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(waitlistMembers)
      .where(eq(waitlistMembers.waitlistId, waitlist.id));

    return NextResponse.json({
      title: waitlist.title,
      description: waitlist.description,
      shortcode: waitlist.shortcode,
      memberCount: count,
    });
  } catch (error) {
    console.error("Waitlist public GET error:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ shortcode: string }> }
) {
  try {
    // Rate limit by IP
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRateLimited(ip)) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const { shortcode } = await params;

    const waitlist = await db.query.waitlists.findFirst({
      where: and(eq(waitlists.shortcode, shortcode), eq(waitlists.status, "active")),
      columns: { id: true, title: true },
    });

    if (!waitlist) {
      return NextResponse.json({ error: "Waitlist not found" }, { status: 404 });
    }

    const body = await request.json();
    const { email, firstName, lastName } = body;

    if (!email?.trim() || !firstName?.trim() || !lastName?.trim()) {
      return NextResponse.json({ error: "Email, first name, and last name are required" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
    }

    // Check duplicate
    const existing = await db.query.waitlistMembers.findFirst({
      where: and(
        eq(waitlistMembers.waitlistId, waitlist.id),
        eq(waitlistMembers.email, normalizedEmail)
      ),
      columns: { id: true },
    });

    if (existing) {
      return NextResponse.json({ error: "This email is already on the waitlist" }, { status: 409 });
    }

    const verificationToken = randomBytes(32).toString("hex");

    await db.insert(waitlistMembers).values({
      waitlistId: waitlist.id,
      email: normalizedEmail,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      verificationToken,
    });

    // Send verification email (best-effort, don't fail the join if email fails)
    try {
      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
      const verifyUrl = `${baseUrl}/waitlist/verify?token=${verificationToken}`;

      await sendEmail({
        to: normalizedEmail,
        subject: `Verify your email — ${waitlist.title}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome to ${waitlist.title}!</h2>
            <p>Hi ${firstName.trim()},</p>
            <p>Thanks for joining the waitlist. Please verify your email address by clicking the button below:</p>
            <div style="margin: 24px 0;">
              <a href="${verifyUrl}" style="background-color: #000; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
                Verify Email
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">Or copy this link: ${verifyUrl}</p>
          </div>
        `,
      });
    } catch (emailError) {
      console.error("Failed to send waitlist verification email:", emailError);
    }

    return NextResponse.json({ message: "Successfully joined the waitlist" });
  } catch (error) {
    console.error("Waitlist public POST error:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
