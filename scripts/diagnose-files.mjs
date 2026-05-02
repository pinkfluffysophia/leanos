import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

const fmt = (rows) => {
  if (rows.length === 0) return "  (none)";
  return rows
    .map((r) =>
      Object.entries(r)
        .map(([k, v]) => `${k}=${v ?? "null"}`)
        .join("  ")
    )
    .map((line) => "  " + line)
    .join("\n");
};

try {
  const files = await sql`
    select id, name, file_name, file_size, deleted_at, created_at
    from files
    order by created_at desc
    limit 10
  `;
  console.log(`\nfiles (${files.length}):\n${fmt(files)}`);

  const productFiles = await sql`
    select pf.id, pf.product_id, p.name as product_name, pf.file_id, f.name as file_name, pf.created_at
    from product_files pf
    left join products p on p.id = pf.product_id
    left join files f on f.id = pf.file_id
    order by pf.created_at desc
    limit 20
  `;
  console.log(`\nproduct_files (${productFiles.length}):\n${fmt(productFiles)}`);

  const purchases = await sql`
    select id, user_id, product_id, status, stripe_payment_id, created_at
    from purchases
    order by created_at desc
    limit 25
  `;
  console.log(`\npurchases (${purchases.length}):\n${fmt(purchases)}`);

  const downloadLinks = await sql`
    select id, user_id, purchase_id, file_id, download_count, max_downloads, created_at
    from download_links
    order by created_at desc
    limit 20
  `;
  console.log(
    `\ndownload_links (${downloadLinks.length}):\n${fmt(downloadLinks)}`
  );

  const users = await sql`
    select id, email, role, status from users order by created_at desc limit 10
  `;
  console.log(`\nusers (${users.length}):\n${fmt(users)}`);

  const recentEmails = await sql`
    select to_email, subject, status, error_message, sent_at, template_name
    from email_logs
    order by sent_at desc
    limit 8
  `;
  console.log(
    `\nemail_logs (last 8):\n${fmt(recentEmails)}`
  );
} finally {
  await sql.end();
}
