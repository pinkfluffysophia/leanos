import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

// Mirror of FILE_DELIVERY_TEMPLATE in src/lib/file-delivery.ts.
// Kept inlined here so this seed script is self-contained.
const TEMPLATE = {
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
};

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

try {
  const existing = await sql`
    select id, name, type from email_templates where type = ${TEMPLATE.type} limit 1
  `;

  if (existing.length > 0) {
    await sql`
      update email_templates
      set name = ${TEMPLATE.name},
          subject = ${TEMPLATE.subject},
          body_html = ${TEMPLATE.bodyHtml},
          body_text = ${TEMPLATE.bodyText},
          updated_at = now()
      where id = ${existing[0].id}
    `;
    console.log(
      `Updated existing template: ${existing[0].name} (id=${existing[0].id})`
    );
  } else {
    const [created] = await sql`
      insert into email_templates (name, type, subject, body_html, body_text)
      values (${TEMPLATE.name}, ${TEMPLATE.type}, ${TEMPLATE.subject}, ${TEMPLATE.bodyHtml}, ${TEMPLATE.bodyText})
      returning id, name, type
    `;
    console.log(`Created template: ${created.name} (id=${created.id})`);
  }

  // Verify by listing all templates
  const all = await sql`
    select name, type from email_templates order by name
  `;
  console.log(`\nAll templates in DB (${all.length}):`);
  for (const t of all) console.log(`  - ${t.name} [${t.type}]`);
} finally {
  await sql.end();
}
