import { NextResponse } from "next/server";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { downloadLinks, files } from "@/lib/db/schema";

function buildContentDisposition(filename: string) {
  // RFC 5987: include both an ASCII fallback and a UTF-8 encoded version so
  // browsers handle non-ASCII filenames correctly.
  const asciiFallback = filename
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/"/g, "");
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;

  if (!token || token.length < 32) {
    return new NextResponse("Not found", { status: 404 });
  }

  // Conditional update — guarantees only N successful downloads even with concurrency.
  const updated = await db
    .update(downloadLinks)
    .set({
      downloadCount: sql`${downloadLinks.downloadCount} + 1`,
      lastDownloadedAt: new Date(),
    })
    .where(
      and(
        eq(downloadLinks.token, token),
        sql`${downloadLinks.downloadCount} < ${downloadLinks.maxDownloads}`
      )
    )
    .returning({ fileId: downloadLinks.fileId });

  if (updated.length === 0) {
    const existing = await db.query.downloadLinks.findFirst({
      where: eq(downloadLinks.token, token),
      columns: { id: true },
    });
    if (existing) {
      return new NextResponse(
        "This download link has reached its maximum number of downloads.",
        { status: 410 }
      );
    }
    return new NextResponse("Not found", { status: 404 });
  }

  const file = await db.query.files.findFirst({
    where: eq(files.id, updated[0].fileId),
    columns: { blobUrl: true, fileName: true, mimeType: true, fileSize: true },
  });

  if (!file) {
    return new NextResponse("File not available", { status: 404 });
  }

  const downloadName = file.fileName || "download";
  const headers = new Headers({
    "Content-Type": file.mimeType || "application/octet-stream",
    "Content-Disposition": buildContentDisposition(downloadName),
    "Cache-Control": "private, no-store",
  });

  // Local filesystem path (dev fallback when no Blob token configured).
  if (file.blobUrl.startsWith("/")) {
    const absolute = join(process.cwd(), "public", file.blobUrl);
    try {
      const stats = await stat(absolute);
      headers.set("Content-Length", String(stats.size));
      // Convert Node Readable → Web ReadableStream for the Response body.
      const nodeStream = createReadStream(absolute);
      const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
      return new Response(webStream, { headers });
    } catch (err) {
      console.error("Local file read failed:", err);
      return new NextResponse("File not available", { status: 404 });
    }
  }

  // Vercel Blob (or any public URL): proxy the bytes through so we can
  // override Content-Disposition. The blob CDN is fast; bandwidth is
  // bounded by the 100MB upload cap.
  const upstream = await fetch(file.blobUrl);
  if (!upstream.ok || !upstream.body) {
    console.error("Upstream fetch failed:", upstream.status, file.blobUrl);
    return new NextResponse("File not available", { status: 502 });
  }
  const upstreamLength = upstream.headers.get("content-length");
  if (upstreamLength) headers.set("Content-Length", upstreamLength);

  return new Response(upstream.body, { headers });
}
