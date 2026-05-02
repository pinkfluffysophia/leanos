import { NextResponse } from "next/server";
import { desc, eq, isNull, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { files, productFiles, users } from "@/lib/db/schema";

async function checkAdmin() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const currentUser = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1)
    .then((result) => result[0]);
  if (!currentUser || currentUser.role !== "admin") return null;
  return session.user.id;
}

export async function GET() {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select({
      id: files.id,
      name: files.name,
      fileName: files.fileName,
      blobUrl: files.blobUrl,
      fileSize: files.fileSize,
      mimeType: files.mimeType,
      createdAt: files.createdAt,
      productCount: sql<number>`count(${productFiles.id})::int`.as("product_count"),
    })
    .from(files)
    .leftJoin(productFiles, eq(productFiles.fileId, files.id))
    .where(isNull(files.deletedAt))
    .groupBy(files.id)
    .orderBy(desc(files.createdAt));

  return NextResponse.json({ files: rows });
}
