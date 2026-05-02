import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { files, users } from "@/lib/db/schema";

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB
const LOCAL_DIR = join(process.cwd(), "public", "uploads", "files");

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

export async function POST(request: Request) {
  try {
    const adminId = await checkAdmin();
    if (!adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const name = ((formData.get("name") as string | null) || "").trim();

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "File is empty" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 100MB." },
        { status: 400 }
      );
    }

    const safeOriginalName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const objectName = `${Date.now()}-${crypto.randomUUID()}-${safeOriginalName}`;
    const contentType = file.type || "application/octet-stream";

    let storedUrl: string;

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(`files/${objectName}`, file, {
        access: "public",
        contentType,
      });
      storedUrl = blob.url;
    } else {
      // Local filesystem fallback for dev when no Blob store is configured.
      // The download route resolves relative `/uploads/...` paths against the request origin.
      await mkdir(LOCAL_DIR, { recursive: true });
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(join(LOCAL_DIR, objectName), buffer);
      storedUrl = `/uploads/files/${objectName}`;
    }

    const [inserted] = await db
      .insert(files)
      .values({
        name: name || file.name,
        fileName: file.name,
        blobUrl: storedUrl,
        fileSize: file.size,
        mimeType: contentType,
        uploadedById: adminId,
      })
      .returning();

    return NextResponse.json({ file: inserted }, { status: 201 });
  } catch (error) {
    console.error("File upload error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to upload file";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
