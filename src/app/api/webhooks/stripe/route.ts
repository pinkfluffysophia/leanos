import { NextResponse } from "next/server";
import Stripe from "stripe";
import { hash } from "bcryptjs";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { purchases, transactions, stripeConfig, users, products } from "@/lib/db/schema";
import { decrypt } from "@/lib/encryption";
import { eq } from "drizzle-orm";
import { getTemplateByType, applyTemplateVariables, sendEmail } from "@/lib/email";

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    // Get Stripe config from DB
    const config = await db.query.stripeConfig.findFirst();
    if (!config?.secretKey) {
      console.error("Stripe not configured");
      return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
    }

    // Webhook secret: env var (Stripe CLI) takes priority, then DB
    const webhookSecret =
      process.env.STRIPE_WEBHOOK_SECRET ||
      (config.webhookSecret ? decrypt(config.webhookSecret) : null);

    if (!webhookSecret) {
      console.error("Webhook secret not configured");
      return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
    }

    const secretKey = decrypt(config.secretKey);
    const stripe = new Stripe(secretKey);

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid signature";
      console.error("Webhook signature verification failed:", message);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // Handle the event
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}

function generateReferralCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let password = "";
  const bytes = randomBytes(12);
  for (let i = 0; i < 12; i++) {
    password += chars[bytes[i] % chars.length];
  }
  return password;
}

async function resolveUserId(session: Stripe.Checkout.Session): Promise<{ userId: string; isNewAccount: boolean; plainPassword?: string }> {
  // If userId is in metadata, user was authenticated at checkout
  if (session.metadata?.userId) {
    return { userId: session.metadata.userId, isNewAccount: false };
  }

  // Guest checkout — resolve by email
  const email = (session.customer_details?.email || session.customer_email || "").toLowerCase();
  if (!email) {
    throw new Error("No email found in checkout session");
  }

  // Check if user already exists
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, email),
    columns: { id: true },
  });

  if (existingUser) {
    return { userId: existingUser.id, isNewAccount: false };
  }

  // Create new account
  const plainPassword = generatePassword();
  const passwordHash = await hash(plainPassword, 12);

  // Parse name from Stripe customer details
  const fullName = session.customer_details?.name || "";
  const nameParts = fullName.trim().split(/\s+/);
  const firstName = nameParts[0] || "Customer";
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

  // Generate unique referral code
  let referralCode = generateReferralCode();
  let existingCode = await db.query.users.findFirst({
    where: eq(users.referralCode, referralCode),
  });
  while (existingCode) {
    referralCode = generateReferralCode();
    existingCode = await db.query.users.findFirst({
      where: eq(users.referralCode, referralCode),
    });
  }

  const [newUser] = await db
    .insert(users)
    .values({
      email,
      passwordHash,
      firstName,
      lastName: lastName || firstName,
      referralCode,
      status: "active",
      emailVerifiedAt: new Date(),
    })
    .returning();

  console.log(`Auto-created account for ${email} (user: ${newUser.id})`);

  return { userId: newUser.id, isNewAccount: true, plainPassword };
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const productId = session.metadata?.productId;
  const priceId = session.metadata?.priceId;

  if (!productId) {
    console.error("Missing productId in checkout session:", session.id);
    return;
  }

  // Check if purchase already exists (idempotency)
  const existing = await db.query.purchases.findFirst({
    where: eq(purchases.stripePaymentId, session.id),
  });

  if (existing) {
    console.log("Purchase already recorded for session:", session.id);
    return;
  }

  // Resolve or create user
  const { userId, isNewAccount, plainPassword } = await resolveUserId(session);

  const amountTotal = session.amount_total || 0;
  const currency = (session.currency || "usd").toUpperCase();

  // Create purchase record
  const [purchase] = await db
    .insert(purchases)
    .values({
      userId,
      productId,
      priceId: priceId || null,
      amount: amountTotal,
      currency,
      stripePaymentId: session.id,
      status: "completed",
    })
    .returning();

  // Create transaction record
  await db.insert(transactions).values({
    userId,
    purchaseId: purchase.id,
    type: "purchase",
    amount: amountTotal,
    currency,
    stripeTransactionId: (session.payment_intent as string) || (session.subscription as string) || session.id,
    status: "completed",
  });

  console.log(`Purchase recorded: ${purchase.id} for user ${userId}`);

  // Fetch user and product details for emails
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { email: true, firstName: true, lastName: true },
  });

  const product = await db.query.products.findFirst({
    where: eq(products.id, productId),
    columns: { name: true },
  });

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  // Send account created email for new accounts
  if (isNewAccount && user?.email && plainPassword) {
    try {
      const template = await getTemplateByType("account_created");
      const variables = {
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email,
        password: plainPassword,
        loginUrl: `${baseUrl}/login`,
        productName: product?.name || "your product",
      };

      const emailSubject = template
        ? applyTemplateVariables(template.subject, variables)
        : "Your account has been created";
      const emailHtml = template
        ? applyTemplateVariables(template.bodyHtml, variables)
        : `
          <h2>Welcome!</h2>
          <p>Your account has been created after your purchase of <strong>${variables.productName}</strong>.</p>
          <p>Here are your login credentials:</p>
          <p><strong>Email:</strong> ${variables.email}<br/><strong>Password:</strong> ${variables.password}</p>
          <p><a href="${variables.loginUrl}" style="display:inline-block;padding:10px 20px;background-color:#0f172a;color:#ffffff;text-decoration:none;border-radius:6px;">Log In</a></p>
          <p>We recommend changing your password after logging in.</p>
        `;

      await sendEmail({
        to: user.email,
        subject: emailSubject,
        html: emailHtml,
        userId,
        templateId: template?.id,
        templateName: template?.name || "account_created",
      });

      console.log(`Account created email sent to ${user.email}`);
    } catch (emailError) {
      console.error("Failed to send account created email:", emailError);
    }
  }

  // Send purchase confirmation email
  try {
    const template = await getTemplateByType("purchase_confirmation");
    if (template && user?.email) {
      const formattedAmount = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency || "USD",
      }).format(amountTotal / 100);

      const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim();
      const html = applyTemplateVariables(template.bodyHtml, {
        name: fullName,
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        fullName,
        orderId: purchase.id,
        productName: product?.name || "Unknown product",
        amount: formattedAmount,
        total: formattedAmount,
        currency: currency,
        date: new Date().toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
        purchasesUrl: `${baseUrl}/purchases`,
        year: new Date().getFullYear().toString(),
      });

      const subject = applyTemplateVariables(template.subject, {
        name: fullName,
        firstName: user.firstName || "",
        productName: product?.name || "Unknown product",
        amount: formattedAmount,
      });

      await sendEmail({
        to: user.email,
        subject,
        html,
        userId,
        templateId: template.id,
        templateName: template.name,
      });

      console.log(`Purchase email sent to ${user.email}`);
    }
  } catch (emailError) {
    console.error("Failed to send purchase email:", emailError);
  }
}
