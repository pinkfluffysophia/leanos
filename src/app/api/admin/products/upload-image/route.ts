import { NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, products } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const LOCAL_DIR = join(process.cwd(), "public", "uploads", "products");

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
    if (!(await checkAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const productId = formData.get("productId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!productId) {
      return NextResponse.json(
        { error: "Product ID is required" },
        { status: 400 }
      );
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          error:
            "Invalid file type. Only JPG, PNG, GIF, and WebP are allowed.",
        },
        { status: 400 }
      );
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 5MB." },
        { status: 400 }
      );
    }

    const product = await db.query.products.findFirst({
      where: eq(products.id, productId),
      columns: { id: true, imageUrl: true },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const extMap: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/gif": "gif",
      "image/webp": "webp",
    };
    const ext = extMap[file.type];
    const objectName = `${productId}-${Date.now()}.${ext}`;

    let imageUrl: string;

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(`products/${objectName}`, file, {
        access: "public",
        contentType: file.type,
      });
      imageUrl = blob.url;
    } else {
      // Local filesystem fallback for dev when no Blob store is configured.
      await mkdir(LOCAL_DIR, { recursive: true });
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(join(LOCAL_DIR, objectName), buffer);
      imageUrl = `/uploads/products/${objectName}`;
    }

    await db
      .update(products)
      .set({ imageUrl, updatedAt: new Date() })
      .where(eq(products.id, productId));

    // Cleanup the previous image so we don't leak storage.
    if (product.imageUrl) {
      if (product.imageUrl.includes("vercel-storage.com")) {
        await del(product.imageUrl).catch(() => {});
      } else if (product.imageUrl.startsWith("/uploads/products/")) {
        const oldPath = join(
          process.cwd(),
          "public",
          product.imageUrl.replace(/^\//, "")
        );
        await unlink(oldPath).catch(() => {});
      }
    }

    return NextResponse.json({ imageUrl });
  } catch (error) {
    console.error("Product image upload error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to upload image";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
