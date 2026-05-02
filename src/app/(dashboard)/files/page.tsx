import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { downloadLinks, files, products, purchases } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { ensureDownloadLinksForUser } from "@/lib/file-delivery";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FileDown, Lock } from "lucide-react";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export default async function UserFilesPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  // Self-heal: backfill any missing download_links for this user's purchases.
  // Tolerates webhook misses without losing entitlements.
  await ensureDownloadLinksForUser(session.user.id);

  const rows = await db
    .select({
      token: downloadLinks.token,
      downloadCount: downloadLinks.downloadCount,
      maxDownloads: downloadLinks.maxDownloads,
      lastDownloadedAt: downloadLinks.lastDownloadedAt,
      createdAt: downloadLinks.createdAt,
      fileName: files.name,
      originalFileName: files.fileName,
      fileSize: files.fileSize,
      productName: products.name,
    })
    .from(downloadLinks)
    .innerJoin(files, eq(files.id, downloadLinks.fileId))
    .leftJoin(purchases, eq(purchases.id, downloadLinks.purchaseId))
    .leftJoin(products, eq(products.id, purchases.productId))
    .where(eq(downloadLinks.userId, session.user.id))
    .orderBy(desc(downloadLinks.createdAt));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-light text-slate-800 dark:text-slate-100">
          Files
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Download links from your purchases. Each link expires after 3
          downloads.
        </p>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileDown
              className="h-10 w-10 text-pink-300 mb-3"
              strokeWidth={1.5}
            />
            <h3 className="text-base font-medium text-slate-800 dark:text-slate-100 mb-1">
              No files yet
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-sm">
              When you purchase a product that includes downloadable files,
              your links will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const remaining = row.maxDownloads - row.downloadCount;
            const exhausted = remaining <= 0;
            return (
              <Card
                key={row.token}
                className={exhausted ? "opacity-60" : undefined}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-pink-100 dark:bg-pink-300/10 flex items-center justify-center shrink-0">
                        {exhausted ? (
                          <Lock
                            className="w-5 h-5 text-slate-400"
                            strokeWidth={1.5}
                          />
                        ) : (
                          <FileDown
                            className="w-5 h-5 text-pink-500 dark:text-pink-200"
                            strokeWidth={1.5}
                          />
                        )}
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-base truncate">
                          {row.fileName}
                        </CardTitle>
                        <CardDescription className="truncate">
                          {row.productName || "Purchase"} ·{" "}
                          {formatBytes(row.fileSize)}
                        </CardDescription>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 px-2 py-1 text-xs font-medium rounded-full ${
                        exhausted
                          ? "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                          : remaining === 1
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                            : "bg-pink-100 text-pink-700 dark:bg-pink-300/10 dark:text-pink-200"
                      }`}
                    >
                      {exhausted
                        ? "Expired"
                        : `${remaining} download${remaining === 1 ? "" : "s"} left`}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Available since {formatDate(row.createdAt)}
                      {row.lastDownloadedAt &&
                        ` · last downloaded ${formatDate(row.lastDownloadedAt)}`}
                    </div>
                    {exhausted ? (
                      <span className="text-xs text-slate-400 italic">
                        Reached maximum downloads
                      </span>
                    ) : (
                      <a
                        href={`/api/download/${row.token}`}
                        className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-pink-400 to-rose-400 hover:from-pink-500 hover:to-rose-500 rounded-full transition-all shadow-sm"
                      >
                        <FileDown
                          className="w-4 h-4 mr-2"
                          strokeWidth={1.75}
                        />
                        Download
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
