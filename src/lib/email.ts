import nodemailer from "nodemailer";
import { db } from "./db";
import { emailConfig, emailLogs, emailTemplates } from "./db/schema";
import { decrypt } from "./encryption";
import { eq } from "drizzle-orm";

export async function getEmailTransporter() {
  const config = await db.query.emailConfig.findFirst();

  if (!config || !config.isActive) {
    throw new Error("Email sending is not configured or is disabled");
  }

  if (!config.smtpHost || !config.smtpUser || !config.smtpPassword) {
    throw new Error("SMTP settings are incomplete");
  }

  const host = decrypt(config.smtpHost);
  const user = decrypt(config.smtpUser);
  const pass = decrypt(config.smtpPassword);

  const transporter = nodemailer.createTransport({
    host,
    port: config.smtpPort || 587,
    secure: config.smtpPort === 465,
    auth: { user, pass },
    family: 4, // Force IPv4 — prevents EHOSTUNREACH on networks without IPv6
  } as nodemailer.TransportOptions);

  return { transporter, from: config.smtpFrom || user };
}

export async function getTemplateByType(type: string) {
  return db.query.emailTemplates.findFirst({
    where: eq(emailTemplates.type, type),
  });
}

export function applyTemplateVariables(html: string, variables: Record<string, string>) {
  let result = html;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  isPlainText,
  userId,
  templateId,
  templateName,
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  isPlainText?: boolean;
  userId?: string;
  templateId?: string;
  templateName?: string;
}) {
  try {
    const { transporter, from } = await getEmailTransporter();

    const mailOptions: Record<string, string> = { from, to, subject };
    if (isPlainText) {
      mailOptions.text = text || html;
    } else {
      mailOptions.html = html;
    }

    const result = await transporter.sendMail(mailOptions);

    // Log successful send — snapshot template name & body for permanence
    await db.insert(emailLogs).values({
      toEmail: to,
      subject,
      status: "sent",
      userId: userId || null,
      templateId: templateId || null,
      templateName: templateName || null,
      templateBodyHtml: isPlainText ? (text || html) : html,
    });

    return result;
  } catch (error) {
    // Log failed send
    await db.insert(emailLogs).values({
      toEmail: to,
      subject,
      status: "failed",
      userId: userId || null,
      templateId: templateId || null,
      templateName: templateName || null,
      templateBodyHtml: html,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    }).catch(() => {}); // Don't fail if logging fails

    throw error;
  }
}
