import crypto from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "./db";
import {
  downloadLinks,
  emailTemplates,
  files,
  productFiles,
  purchases,
} from "./db/schema";
import {
  applyTemplateVariables,
  sendEmail,
} from "./email";

export function generateDownloadToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export type DownloadLinkInfo = {
  fileName: string;
  url: string;
};

function buildDownloadUrl(baseUrl: string, token: string) {
  return `${baseUrl.replace(/\/+$/, "")}/api/download/${token}`;
}

/**
 * Generate fresh download_links rows for every (non-deleted) file mapped to the product.
 * Returns the public URLs to embed in the delivery email.
 */
export async function createDownloadLinksForPurchase({
  userId,
  purchaseId,
  productId,
  baseUrl,
}: {
  userId: string;
  purchaseId: string;
  productId: string;
  baseUrl: string;
}): Promise<DownloadLinkInfo[]> {
  const mapped = await db
    .select({
      fileId: files.id,
      fileName: files.fileName,
      displayName: files.name,
    })
    .from(productFiles)
    .innerJoin(files, eq(files.id, productFiles.fileId))
    .where(and(eq(productFiles.productId, productId), isNull(files.deletedAt)));

  if (mapped.length === 0) return [];

  const rows = mapped.map((f) => ({
    token: generateDownloadToken(),
    userId,
    purchaseId,
    fileId: f.fileId,
  }));

  const inserted = await db.insert(downloadLinks).values(rows).returning({
    token: downloadLinks.token,
    fileId: downloadLinks.fileId,
  });

  return inserted.map((row) => {
    const meta = mapped.find((m) => m.fileId === row.fileId)!;
    return {
      fileName: meta.displayName || meta.fileName,
      url: buildDownloadUrl(baseUrl, row.token),
    };
  });
}

/**
 * Self-healing sync: for every completed purchase the user has, makes sure each
 * (non-deleted) file attached to that product has a download_links row. Used
 * by the /files dashboard so users see their entitlements even when the
 * Stripe webhook didn't run the file-delivery hook (e.g. during deploys).
 *
 * Idempotent. Skips pairs that already have a row.
 */
export async function ensureDownloadLinksForUser(userId: string): Promise<void> {
  const missing = await db
    .select({
      purchaseId: purchases.id,
      fileId: files.id,
    })
    .from(purchases)
    .innerJoin(productFiles, eq(productFiles.productId, purchases.productId))
    .innerJoin(files, eq(files.id, productFiles.fileId))
    .leftJoin(
      downloadLinks,
      and(
        eq(downloadLinks.purchaseId, purchases.id),
        eq(downloadLinks.fileId, productFiles.fileId)
      )
    )
    .where(
      and(
        eq(purchases.userId, userId),
        eq(purchases.status, "completed"),
        isNull(files.deletedAt),
        isNull(downloadLinks.id)
      )
    );

  if (missing.length === 0) return;

  await db.insert(downloadLinks).values(
    missing.map((m) => ({
      token: generateDownloadToken(),
      userId,
      purchaseId: m.purchaseId,
      fileId: m.fileId,
    }))
  );
}

/**
 * Idempotent: returns the existing token for a (purchase, file) pair if present,
 * otherwise creates a new download_links row and returns its token.
 */
export async function ensureDownloadLink({
  userId,
  purchaseId,
  fileId,
}: {
  userId: string;
  purchaseId: string;
  fileId: string;
}): Promise<{ token: string; isNew: boolean }> {
  const existing = await db.query.downloadLinks.findFirst({
    where: and(
      eq(downloadLinks.purchaseId, purchaseId),
      eq(downloadLinks.fileId, fileId)
    ),
    columns: { token: true },
  });
  if (existing) return { token: existing.token, isNew: false };

  const token = generateDownloadToken();
  await db.insert(downloadLinks).values({ token, userId, purchaseId, fileId });
  return { token, isNew: true };
}

/**
 * Canonical "File Delivery" template definition. Source of truth — used both
 * by the seed-templates endpoint (manual bulk reseed) and the lazy auto-seed
 * below (so a fresh DB Just Works on the first file delivery).
 *
 * Variables: firstName, lastName, productName, downloadLinks (HTML <ul>),
 * downloadLinksText (plain text), filesUrl, year.
 */
export const FILE_DELIVERY_TEMPLATE = {
  name: "File Delivery",
  type: "file_delivery",
  subject: "Your downloads for {{productName}} 💖",
  bodyHtml: `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>
body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#fdf2f8;color:#1f2937}
.container{max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 8px 24px rgba(244,114,182,0.08)}
.header{background:linear-gradient(135deg,#fbcfe8 0%,#f9a8d4 50%,#f472b6 100%);color:#ffffff;padding:48px 24px;text-align:center}
.header h1{margin:0;font-size:28px;font-weight:600;letter-spacing:-0.01em}
.header p{margin:8px 0 0;font-size:14px;opacity:0.92}
.content{padding:40px 32px;line-height:1.65;color:#475569;font-size:15px}
.content h2{color:#1e293b;font-size:18px;font-weight:600;margin:0 0 12px}
.product-pill{display:inline-block;background:#fdf2f8;color:#be185d;padding:4px 12px;border-radius:9999px;font-weight:600;font-size:14px;margin:0 2px}
.file-box{background:#fdf2f8;border:1px solid #fbcfe8;padding:8px 20px;margin:24px 0;border-radius:10px}
.file-box ul{list-style:none;padding:0;margin:0}
.file-box li{padding:14px 0;border-bottom:1px solid #fbcfe8}
.file-box li:last-child{border-bottom:none}
.file-box a{color:#db2777;font-weight:600;text-decoration:none;font-size:15px}
.file-box a:hover{text-decoration:underline}
.notice{background:#fff7ed;border-left:3px solid #fb923c;padding:14px 16px;margin:28px 0;color:#9a3412;font-size:13px;border-radius:6px}
.btn-wrap{text-align:center;margin:32px 0 8px}
.btn{display:inline-block;background:linear-gradient(135deg,#f472b6 0%,#ec4899 100%);color:#ffffff;padding:13px 32px;text-decoration:none;border-radius:9999px;font-weight:600;font-size:14px;box-shadow:0 4px 12px rgba(236,72,153,0.25)}
.footer{background:#fdf2f8;padding:28px 24px;text-align:center;font-size:12px;color:#9d174d;border-top:1px solid #fbcfe8}
</style></head>
<body><div class="container">
  <div class="header">
    <h1>Your downloads are ready ✨</h1>
    <p>Thank you for your purchase</p>
  </div>
  <div class="content">
    <h2>Hi {{firstName}},</h2>
    <p>Thanks so much for purchasing <span class="product-pill">{{productName}}</span> — your files are below. Click any link to download.</p>
    <div class="file-box">{{downloadLinks}}</div>
    <div class="notice"><strong>Heads up:</strong> Each link works for 3 downloads. If you ever lose this email, all your files are also available from your dashboard at any time.</div>
    <div class="btn-wrap"><a href="{{filesUrl}}" class="btn">Open My Files →</a></div>
  </div>
  <div class="footer"><p>© {{year}} Leaniverse. All rights reserved.</p></div>
</div></body>
</html>`,
  bodyText: `Hi {{firstName}},

Thanks for purchasing {{productName}}! Your download links:

{{downloadLinksText}}

Each link works for 3 downloads. You can also access your files anytime at {{filesUrl}}.

© {{year}} Leaniverse`,
} as const;

/**
 * Returns the existing file_delivery template, creating it from the canonical
 * definition if missing. Idempotent. Lets a fresh DB deliver files without
 * requiring an admin to manually seed templates first.
 */
export async function ensureFileDeliveryTemplate() {
  const existing = await db.query.emailTemplates.findFirst({
    where: eq(emailTemplates.type, FILE_DELIVERY_TEMPLATE.type),
  });
  if (existing) return existing;

  const [created] = await db
    .insert(emailTemplates)
    .values({
      name: FILE_DELIVERY_TEMPLATE.name,
      type: FILE_DELIVERY_TEMPLATE.type,
      subject: FILE_DELIVERY_TEMPLATE.subject,
      bodyHtml: FILE_DELIVERY_TEMPLATE.bodyHtml,
      bodyText: FILE_DELIVERY_TEMPLATE.bodyText,
    })
    .returning();
  return created;
}

/**
 * Compose and send the file_delivery email. Auto-seeds the template on first
 * use so the user never sees a fallback body. Throws on send failure
 * (sendEmail also logs to email_logs).
 */
export async function sendFileDeliveryEmail({
  toEmail,
  userId,
  firstName,
  lastName,
  productName,
  links,
  baseUrl,
}: {
  toEmail: string;
  userId?: string;
  firstName?: string | null;
  lastName?: string | null;
  productName: string;
  links: DownloadLinkInfo[];
  baseUrl: string;
}) {
  if (links.length === 0) return;

  const trimmedBase = baseUrl.replace(/\/+$/, "");
  const linksHtml = `<ul>${links
    .map((l) => `<li><a href="${l.url}">${escapeHtml(l.fileName)}</a></li>`)
    .join("")}</ul>`;
  const linksText = links.map((l) => `- ${l.fileName}: ${l.url}`).join("\n");

  const variables = {
    firstName: firstName || "",
    lastName: lastName || "",
    productName,
    downloadLinks: linksHtml,
    downloadLinksText: linksText,
    filesUrl: `${trimmedBase}/files`,
    year: new Date().getFullYear().toString(),
  };

  const template = await ensureFileDeliveryTemplate();

  const subject = applyTemplateVariables(template.subject, variables);
  const html = applyTemplateVariables(template.bodyHtml, variables);

  await sendEmail({
    to: toEmail,
    subject,
    html,
    userId,
    templateId: template.id,
    templateName: template.name,
  });
}
