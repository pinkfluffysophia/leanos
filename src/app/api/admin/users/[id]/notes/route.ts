import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, adminNotes } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";

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

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminId = await checkAdmin();
    if (!adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: userId } = await params;

    const noteList = await db
      .select({
        id: adminNotes.id,
        content: adminNotes.content,
        authorId: adminNotes.authorId,
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
        attachmentUrl: adminNotes.attachmentUrl,
        attachmentName: adminNotes.attachmentName,
        createdAt: adminNotes.createdAt,
      })
      .from(adminNotes)
      .leftJoin(users, eq(adminNotes.authorId, users.id))
      .where(eq(adminNotes.userId, userId))
      .orderBy(desc(adminNotes.createdAt));

    const notes = noteList.map((n) => ({
      id: n.id,
      content: n.content,
      authorId: n.authorId,
      authorName: n.authorFirstName && n.authorLastName
        ? `${n.authorFirstName} ${n.authorLastName}`
        : "Unknown Admin",
      attachmentUrl: n.attachmentUrl,
      attachmentName: n.attachmentName,
      createdAt: n.createdAt,
    }));

    return NextResponse.json({ notes });
  } catch (error) {
    console.error("Admin notes GET error:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminId = await checkAdmin();
    if (!adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: userId } = await params;

    // Verify user exists
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const content = formData.get("content") as string;
    const file = formData.get("file") as File | null;

    if (!content || !content.trim()) {
      return NextResponse.json({ error: "Note content is required" }, { status: 400 });
    }

    let attachmentUrl: string | null = null;
    let attachmentName: string | null = null;

    if (file && file.size > 0) {
      // Validate file type
      const ext = ALLOWED_TYPES[file.type];
      if (!ext) {
        return NextResponse.json(
          { error: "File type not allowed. Supported: images, PDF, DOC, TXT" },
          { status: 400 }
        );
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: "File too large. Max 10MB" }, { status: 400 });
      }

      // Save file
      const uploadDir = path.join(process.cwd(), "public/uploads/notes");
      await mkdir(uploadDir, { recursive: true });

      const filename = `${userId}-${Date.now()}.${ext}`;
      const filePath = path.join(uploadDir, filename);
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(filePath, buffer);

      attachmentUrl = `/uploads/notes/${filename}`;
      attachmentName = file.name;
    }

    const [newNote] = await db
      .insert(adminNotes)
      .values({
        userId,
        authorId: adminId,
        content: content.trim(),
        attachmentUrl,
        attachmentName,
      })
      .returning();

    // Fetch author name for response
    const author = await db.query.users.findFirst({
      where: eq(users.id, adminId),
      columns: { firstName: true, lastName: true },
    });

    return NextResponse.json({
      note: {
        id: newNote.id,
        content: newNote.content,
        authorId: newNote.authorId,
        authorName: author ? `${author.firstName} ${author.lastName}` : "Unknown Admin",
        attachmentUrl: newNote.attachmentUrl,
        attachmentName: newNote.attachmentName,
        createdAt: newNote.createdAt,
      },
    });
  } catch (error) {
    console.error("Admin notes POST error:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminId = await checkAdmin();
    if (!adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: userId } = await params;
    const { searchParams } = new URL(request.url);
    const noteId = searchParams.get("id");

    if (!noteId) {
      return NextResponse.json({ error: "Note ID is required" }, { status: 400 });
    }

    // Verify note exists and belongs to this user
    const note = await db.query.adminNotes.findFirst({
      where: eq(adminNotes.id, noteId),
      columns: { id: true, userId: true, attachmentUrl: true },
    });
    if (!note || note.userId !== userId) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    // Clean up attachment file
    if (note.attachmentUrl?.startsWith("/uploads/")) {
      const filePath = path.join(process.cwd(), "public", note.attachmentUrl);
      await unlink(filePath).catch(() => {});
    }

    await db.delete(adminNotes).where(eq(adminNotes.id, noteId));

    return NextResponse.json({ message: "Note deleted" });
  } catch (error) {
    console.error("Admin notes DELETE error:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
