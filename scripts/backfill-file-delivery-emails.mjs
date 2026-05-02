// Sends a file_delivery email for every download_links row whose purchase
// doesn't already have a Sent file_delivery email logged. Idempotent.
//
// Usage: node scripts/backfill-file-delivery-emails.mjs
//
// Requires: DATABASE_URL + a configured email_config row (or it fails fast).

import { config } from "dotenv";
import nodemailer from "nodemailer";
import { createDecipheriv } from "node:crypto";
import postgres from "postgres";

config({ path: ".env.local" });

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

// Mirror of src/lib/encryption.ts — format is iv:encrypted:authTag
function decrypt(payload) {
  const [ivHex, encrypted, authTagHex] = payload.split(":");
  const key = Buffer.from(process.env.ENCRYPTION_KEY, "hex");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return (
    decipher.update(encrypted, "hex", "utf8") + decipher.final("utf8")
  );
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function applyVars(html, variables) {
  let result = html;
  for (const [k, v] of Object.entries(variables)) {
    result = result.replaceAll(`{{${k}}}`, v);
  }
  return result;
}

const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

try {
  const cfg = await sql`select * from email_config limit 1`;
  if (cfg.length === 0 || !cfg[0].is_active) {
    console.error(
      "email_config is missing or inactive — configure SMTP at /admin/email-config first."
    );
    process.exit(1);
  }
  const transporter = nodemailer.createTransport({
    host: decrypt(cfg[0].smtp_host),
    port: cfg[0].smtp_port || 587,
    secure: cfg[0].smtp_port === 465,
    auth: {
      user: decrypt(cfg[0].smtp_user),
      pass: decrypt(cfg[0].smtp_password),
    },
    family: 4,
  });
  const fromAddr =
    cfg[0].smtp_from || decrypt(cfg[0].smtp_user);

  const tpl = await sql`
    select id, name, subject, body_html
    from email_templates
    where type = 'file_delivery'
    limit 1
  `;
  if (tpl.length === 0) {
    console.error("file_delivery template missing. Run scripts/seed-file-delivery-template.mjs first.");
    process.exit(1);
  }
  const template = tpl[0];

  // Find purchase × file pairs that have a download_link but no file_delivery email log
  const candidates = await sql`
    select
      dl.token, dl.purchase_id, dl.user_id, dl.file_id,
      u.email, u.first_name, u.last_name,
      p.name as product_name,
      f.name as file_name, f.file_name as original_file_name
    from download_links dl
    inner join users u on u.id = dl.user_id
    inner join purchases pur on pur.id = dl.purchase_id
    inner join products p on p.id = pur.product_id
    inner join files f on f.id = dl.file_id
    where not exists (
      select 1 from email_logs el
      where el.user_id = dl.user_id
        and el.template_name = ${template.name}
        and el.template_body_html like '%' || dl.token || '%'
    )
    order by dl.created_at asc
  `;

  if (candidates.length === 0) {
    console.log("No backfill needed — every download link already has a delivery email logged.");
    process.exit(0);
  }

  // Group by (user, purchase) so each buyer gets one email per purchase listing all their files
  const grouped = new Map();
  for (const c of candidates) {
    const key = `${c.user_id}|${c.purchase_id}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        userId: c.user_id,
        purchaseId: c.purchase_id,
        email: c.email,
        firstName: c.first_name,
        productName: c.product_name,
        files: [],
      });
    }
    grouped.get(key).files.push({
      token: c.token,
      displayName: c.file_name || c.original_file_name,
    });
  }

  console.log(`Sending ${grouped.size} file delivery email(s)...`);

  for (const grp of grouped.values()) {
    const links = grp.files.map((f) => ({
      fileName: f.displayName,
      url: `${baseUrl.replace(/\/+$/, "")}/api/download/${f.token}`,
    }));
    const linksHtml = `<ul>${links
      .map((l) => `<li><a href="${l.url}">${escapeHtml(l.fileName)}</a></li>`)
      .join("")}</ul>`;

    const variables = {
      firstName: grp.firstName || "",
      productName: grp.productName,
      downloadLinks: linksHtml,
      filesUrl: `${baseUrl.replace(/\/+$/, "")}/files`,
      year: new Date().getFullYear().toString(),
    };

    const subject = applyVars(template.subject, variables);
    const html = applyVars(template.body_html, variables);

    try {
      await transporter.sendMail({ from: fromAddr, to: grp.email, subject, html });
      await sql`
        insert into email_logs (user_id, to_email, template_id, template_name, template_body_html, subject, status)
        values (${grp.userId}, ${grp.email}, ${template.id}, ${template.name}, ${html}, ${subject}, 'sent')
      `;
      console.log(`  ✓ ${grp.email} (${grp.productName}, ${links.length} link${links.length === 1 ? "" : "s"})`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await sql`
        insert into email_logs (user_id, to_email, template_id, template_name, template_body_html, subject, status, error_message)
        values (${grp.userId}, ${grp.email}, ${template.id}, ${template.name}, ${html}, ${subject}, 'failed', ${msg})
      `;
      console.log(`  ✗ ${grp.email}: ${msg}`);
    }
  }

  console.log("Done.");
} finally {
  await sql.end();
}
