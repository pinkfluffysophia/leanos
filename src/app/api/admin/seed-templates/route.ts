import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emailTemplates, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

const templates = [
  {
    name: "Welcome Email",
    type: "welcome",
    subject: "Welcome to Leaniverse, {{firstName}}! 🚀",
    bodyHtml: `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9fafb;color:#1f2937}.container{max-width:600px;margin:0 auto;background:white}.header{background:#0f172a;color:white;padding:48px 24px;text-align:center}.header h1{margin:0;font-size:32px;font-weight:700}.content{padding:48px 24px;line-height:1.6;color:#4b5563}.content h2{color:#0f172a;font-size:20px;margin:32px 0 16px}.btn{display:inline-block;background:#0f172a;color:white;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:600;margin:24px 0}.footer{background:#f3f4f6;padding:32px 24px;text-align:center;font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb}</style></head>
<body><div class="container"><div class="header"><h1>Welcome! 🚀</h1></div><div class="content"><h2>Hi {{firstName}},</h2><p>Your account is ready to go. We're excited to have you on board.</p><p><a href="{{dashboardUrl}}" class="btn">Go to Dashboard</a></p><p style="color:#6b7280;font-size:14px;">Questions? We're here to help.</p></div><div class="footer"><p>© {{year}} Leaniverse. All rights reserved.</p></div></div></body>
</html>`,
    bodyText: `Welcome to Leaniverse, {{firstName}}!\n\nYour account is ready to go.\n\nVisit your dashboard: {{dashboardUrl}}\n\n© {{year}} Leaniverse`,
  },
  {
    name: "Email Verification",
    type: "verification",
    subject: "Verify your email address",
    bodyHtml: `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9fafb;color:#1f2937}.container{max-width:600px;margin:0 auto;background:white}.header{background:#0f172a;color:white;padding:48px 24px;text-align:center}.header h1{margin:0;font-size:28px;font-weight:700}.content{padding:48px 24px;line-height:1.6;color:#4b5563}.code-box{background:#f3f4f6;border-left:4px solid #0f172a;padding:16px;margin:24px 0;font-family:monospace;font-size:14px;word-break:break-all}.btn{display:inline-block;background:#0f172a;color:white;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:600;margin:24px 0}.footer{background:#f3f4f6;padding:32px 24px;text-align:center;font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb}</style></head>
<body><div class="container"><div class="header"><h1>Verify Email</h1></div><div class="content"><p>Hi {{firstName}},</p><p>Click the button below to verify your email address.</p><p><a href="{{verifyUrl}}" class="btn">Verify Email</a></p><p style="color:#6b7280;font-size:13px;">This link expires in 24 hours.</p></div><div class="footer"><p>© {{year}} Leaniverse. All rights reserved.</p></div></div></body>
</html>`,
    bodyText: `Hi {{firstName}},\n\nClick here to verify your email: {{verifyUrl}}\n\nThis link expires in 24 hours.\n\n© {{year}} Leaniverse`,
  },
  {
    name: "Password Reset",
    type: "password_reset",
    subject: "Reset your password",
    bodyHtml: `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9fafb;color:#1f2937}.container{max-width:600px;margin:0 auto;background:white}.header{background:#0f172a;color:white;padding:48px 24px;text-align:center}.header h1{margin:0;font-size:28px;font-weight:700}.content{padding:48px 24px;line-height:1.6;color:#4b5563}.alert{background:#fef2f2;border-left:4px solid #dc2626;padding:16px;margin:24px 0;color:#991b1b;font-size:13px}.btn{display:inline-block;background:#0f172a;color:white;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:600;margin:24px 0}.footer{background:#f3f4f6;padding:32px 24px;text-align:center;font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb}</style></head>
<body><div class="container"><div class="header"><h1>Reset Password</h1></div><div class="content"><p>Hi {{firstName}},</p><p>We received a request to reset your password. Click below to create a new one.</p><p><a href="{{resetUrl}}" class="btn">Reset Password</a></p><div class="alert"><strong>Security tip:</strong> This link expires in 1 hour. If you didn't request this, ignore this email.</div></div><div class="footer"><p>© {{year}} Leaniverse. All rights reserved.</p></div></div></body>
</html>`,
    bodyText: `Hi {{firstName}},\n\nClick here to reset your password: {{resetUrl}}\n\nThis link expires in 1 hour.\n\nIf you didn't request this, ignore this email.\n\n© {{year}} Leaniverse`,
  },
  {
    name: "Purchase Confirmation",
    type: "purchase_confirmation",
    subject: "Order confirmed — Thank you!",
    bodyHtml: `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9fafb;color:#1f2937}.container{max-width:600px;margin:0 auto;background:white}.header{background:#0f172a;color:white;padding:48px 24px;text-align:center}.header h1{margin:0;font-size:28px;font-weight:700}.content{padding:48px 24px;line-height:1.6;color:#4b5563}.order-box{background:#f3f4f6;border:1px solid #e5e7eb;padding:20px;border-radius:6px;margin:24px 0}.order-item{display:flex;justify-content:space-between;margin:12px 0;font-size:14px}.order-total{border-top:1px solid #e5e7eb;padding-top:12px;margin-top:12px;font-weight:600;font-size:16px}.btn{display:inline-block;background:#0f172a;color:white;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:600;margin:24px 0}.footer{background:#f3f4f6;padding:32px 24px;text-align:center;font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb}</style></head>
<body><div class="container"><div class="header"><h1>✓ Order Confirmed</h1></div><div class="content"><p>Hi {{firstName}},</p><p>Thank you for your purchase! Your order has been confirmed.</p><div class="order-box"><div class="order-item"><span>Order ID:</span><strong>{{orderId}}</strong></div><div class="order-item"><span>Product:</span><strong>{{productName}}</strong></div><div class="order-item"><span>Amount:</span><strong>{{amount}}</strong></div><div class="order-total"><div class="order-item"><span>Total:</span><span>{{total}}</span></div></div></div><p><a href="{{purchasesUrl}}" class="btn">View Order</a></p></div><div class="footer"><p>© {{year}} Leaniverse. All rights reserved.</p></div></div></body>
</html>`,
    bodyText: `Hi {{firstName}},\n\nThank you for your purchase!\n\nOrder ID: {{orderId}}\nProduct: {{productName}}\nAmount: {{amount}}\nTotal: {{total}}\n\nView your order: {{purchasesUrl}}\n\n© {{year}} Leaniverse`,
  },
  {
    name: "Password Changed",
    type: "password_changed",
    subject: "Your password has been changed",
    bodyHtml: `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9fafb;color:#1f2937}.container{max-width:600px;margin:0 auto;background:white}.header{background:#0f172a;color:white;padding:48px 24px;text-align:center}.header h1{margin:0;font-size:28px;font-weight:700}.content{padding:48px 24px;line-height:1.6;color:#4b5563}.success{background:#f0fdf4;border-left:4px solid #16a34a;padding:16px;margin:24px 0;color:#15803d;font-size:13px}.btn{display:inline-block;background:#0f172a;color:white;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:600;margin:24px 0}.footer{background:#f3f4f6;padding:32px 24px;text-align:center;font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb}</style></head>
<body><div class="container"><div class="header"><h1>Password Updated</h1></div><div class="content"><p>Hi {{firstName}},</p><div class="success"><strong>✓ Your password has been successfully changed.</strong></div><p>If you didn't make this change, secure your account immediately.</p><p><a href="{{securityUrl}}" class="btn">Manage Security</a></p></div><div class="footer"><p>© {{year}} Leaniverse. All rights reserved.</p></div></div></body>
</html>`,
    bodyText: `Hi {{firstName}},\n\nYour password has been successfully changed.\n\nIf you didn't make this change, secure your account immediately.\n\nManage security: {{securityUrl}}\n\n© {{year}} Leaniverse`,
  },
  {
    name: "Account Suspended",
    type: "account_suspended",
    subject: "Your account has been suspended",
    bodyHtml: `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9fafb;color:#1f2937}.container{max-width:600px;margin:0 auto;background:white}.header{background:#0f172a;color:white;padding:48px 24px;text-align:center}.header h1{margin:0;font-size:28px;font-weight:700}.content{padding:48px 24px;line-height:1.6;color:#4b5563}.warning{background:#fef3c7;border-left:4px solid #d97706;padding:16px;margin:24px 0;color:#92400e;font-size:13px}.btn{display:inline-block;background:#0f172a;color:white;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:600;margin:24px 0}.footer{background:#f3f4f6;padding:32px 24px;text-align:center;font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb}</style></head>
<body><div class="container"><div class="header"><h1>Account Suspended</h1></div><div class="content"><p>Hi {{firstName}},</p><div class="warning"><strong>Your account has been suspended.</strong> This is typically due to violation of our terms of service.</div><p>If you believe this is a mistake, please contact our support team.</p><p><a href="{{supportUrl}}" class="btn">Contact Support</a></p></div><div class="footer"><p>© {{year}} Leaniverse. All rights reserved.</p></div></div></body>
</html>`,
    bodyText: `Hi {{firstName}},\n\nYour account has been suspended. This is typically due to violation of our terms of service.\n\nIf you believe this is a mistake, please contact our support team.\n\nContact support: {{supportUrl}}\n\n© {{year}} Leaniverse`,
  },
  {
    name: "Referral Reward",
    type: "referral_reward",
    subject: "Your referral was successful! 🎉",
    bodyHtml: `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9fafb;color:#1f2937}.container{max-width:600px;margin:0 auto;background:white}.header{background:#0f172a;color:white;padding:48px 24px;text-align:center}.header h1{margin:0;font-size:28px;font-weight:700}.content{padding:48px 24px;line-height:1.6;color:#4b5563}.reward-box{background:#f0f9ff;border-left:4px solid #0284c7;padding:20px;margin:24px 0;border-radius:6px;text-align:center}.reward-box strong{font-size:18px;color:#0f172a}.btn{display:inline-block;background:#0f172a;color:white;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:600;margin:24px 0}.footer{background:#f3f4f6;padding:32px 24px;text-align:center;font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb}</style></head>
<body><div class="container"><div class="header"><h1>Referral Successful! 🎉</h1></div><div class="content"><p>Hi {{firstName}},</p><p>Great news! {{referredName}} joined using your referral code.</p><div class="reward-box"><p>You earned: <strong>{{rewardAmount}}</strong></p></div><p><a href="{{referralUrl}}" class="btn">View Referrals</a></p></div><div class="footer"><p>© {{year}} Leaniverse. All rights reserved.</p></div></div></body>
</html>`,
    bodyText: `Hi {{firstName}},\n\nGreat news! {{referredName}} joined using your referral code.\n\nYou earned: {{rewardAmount}}\n\nView your referrals: {{referralUrl}}\n\n© {{year}} Leaniverse`,
  },
];

export async function POST() {
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
      .then((result: { role: "user" | "admin" }[]) => result[0]);

    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let created = 0;
    let updated = 0;

    for (const template of templates) {
      const existing = await db.query.emailTemplates.findFirst({
        where: eq(emailTemplates.type, template.type),
      });

      if (existing) {
        await db
          .update(emailTemplates)
          .set({
            name: template.name,
            subject: template.subject,
            bodyHtml: template.bodyHtml,
            bodyText: template.bodyText,
            updatedAt: new Date(),
          })
          .where(eq(emailTemplates.id, existing.id));
        updated++;
      } else {
        await db.insert(emailTemplates).values(template);
        created++;
      }
    }

    return NextResponse.json(
      {
        message: "Email templates seeded successfully",
        created,
        updated,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Seed templates error:", error);
    return NextResponse.json(
      { error: "Failed to seed templates" },
      { status: 500 }
    );
  }
}
