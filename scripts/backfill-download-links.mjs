import { config } from "dotenv";
import crypto from "node:crypto";
import postgres from "postgres";

config({ path: ".env.local" });

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

try {
  // For each (completed purchase, attached non-deleted file) pair where no
  // download_link exists, create one. Idempotent — safe to run repeatedly.
  const missing = await sql`
    select p.id as purchase_id, p.user_id, pf.file_id, f.name as file_name
    from purchases p
    inner join product_files pf on pf.product_id = p.product_id
    inner join files f on f.id = pf.file_id
    left join download_links dl
      on dl.purchase_id = p.id and dl.file_id = pf.file_id
    where p.status = 'completed'
      and f.deleted_at is null
      and dl.id is null
  `;

  if (missing.length === 0) {
    console.log("No missing download links. All caught up.");
  } else {
    console.log(`Creating ${missing.length} download link(s)...`);
    for (const row of missing) {
      const token = generateToken();
      await sql`
        insert into download_links (token, user_id, purchase_id, file_id)
        values (${token}, ${row.user_id}, ${row.purchase_id}, ${row.file_id})
      `;
      console.log(
        `  + ${row.file_name} for purchase ${row.purchase_id.slice(0, 8)}… (user ${row.user_id.slice(0, 8)}…)`
      );
    }
    console.log("Done.");
  }
} finally {
  await sql.end();
}
