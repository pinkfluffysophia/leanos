import { NextResponse } from "next/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  files,
  productFiles,
  products,
  purchases,
  users,
} from "@/lib/db/schema";
import {
  ensureDownloadLink,
  sendFileDeliveryEmail,
} from "@/lib/file-delivery";

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

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: productId } = await context.params;

  const rows = await db
    .select({
      id: productFiles.id,
      fileId: files.id,
      name: files.name,
      fileName: files.fileName,
      fileSize: files.fileSize,
      mimeType: files.mimeType,
      attachedAt: productFiles.createdAt,
      deletedAt: files.deletedAt,
    })
    .from(productFiles)
    .innerJoin(files, eq(files.id, productFiles.fileId))
    .where(eq(productFiles.productId, productId))
    .orderBy(desc(productFiles.createdAt));

  return NextResponse.json({ files: rows });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: productId } = await context.params;
  const body = await request.json().catch(() => null);
  const fileId = body?.fileId as string | undefined;

  if (!fileId) {
    return NextResponse.json({ error: "fileId is required" }, { status: 400 });
  }

  const file = await db.query.files.findFirst({
    where: and(eq(files.id, fileId), isNull(files.deletedAt)),
    columns: { id: true, name: true, fileName: true },
  });
  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  let attachedRowId: string;
  try {
    const [inserted] = await db
      .insert(productFiles)
      .values({ productId, fileId })
      .returning();
    attachedRowId = inserted.id;
  } catch (error: unknown) {
    const code =
      error && typeof error === "object" && "code" in error
        ? (error as { code?: string }).code
        : undefined;
    if (code === "23505") {
      return NextResponse.json(
        { error: "File already attached to this product" },
        { status: 409 }
      );
    }
    console.error("Attach product file error:", error);
    return NextResponse.json(
      { error: "Failed to attach file" },
      { status: 500 }
    );
  }

  // Backfill: every past completed purchase of this product gets a download
  // link for the newly-attached file (idempotent — skips purchases that
  // already have one, e.g. if admin detached then re-attached).
  let backfilled = 0;
  try {
    const productRow = await db.query.products.findFirst({
      where: eq(products.id, productId),
      columns: { name: true },
    });
    const productName = productRow?.name || "your product";

    const baseUrl = process.env.NEXTAUTH_URL || new URL(request.url).origin;

    const pastBuyers = await db
      .select({
        purchaseId: purchases.id,
        userId: purchases.userId,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(purchases)
      .innerJoin(users, eq(users.id, purchases.userId))
      .where(
        and(
          eq(purchases.productId, productId),
          eq(purchases.status, "completed")
        )
      );

    for (const buyer of pastBuyers) {
      const result = await ensureDownloadLink({
        userId: buyer.userId,
        purchaseId: buyer.purchaseId,
        fileId,
      });
      if (!result.isNew) continue;

      backfilled++;

      const url = `${baseUrl.replace(/\/+$/, "")}/api/download/${result.token}`;
      try {
        await sendFileDeliveryEmail({
          toEmail: buyer.email,
          userId: buyer.userId,
          firstName: buyer.firstName,
          lastName: buyer.lastName,
          productName,
          links: [{ fileName: file.name || file.fileName, url }],
          baseUrl,
        });
      } catch (emailError) {
        console.error(
          `File delivery email failed for ${buyer.email}:`,
          emailError
        );
        // Link is still in the DB — buyer can find it on /files.
      }
    }
  } catch (backfillError) {
    console.error("Backfill failed (mapping still saved):", backfillError);
  }

  return NextResponse.json(
    {
      productFile: { id: attachedRowId, productId, fileId },
      backfilled,
    },
    { status: 201 }
  );
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: productId } = await context.params;
  const url = new URL(request.url);
  const fileId = url.searchParams.get("fileId");

  if (!fileId) {
    return NextResponse.json({ error: "fileId is required" }, { status: 400 });
  }

  const [removed] = await db
    .delete(productFiles)
    .where(
      and(
        eq(productFiles.productId, productId),
        eq(productFiles.fileId, fileId)
      )
    )
    .returning({ id: productFiles.id });

  if (!removed) {
    return NextResponse.json({ error: "Mapping not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
