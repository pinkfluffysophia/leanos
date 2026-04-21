"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Mail, ChevronLeft, ChevronRight, Eye } from "lucide-react";

interface EmailLog {
  id: string;
  toEmail: string;
  subject: string;
  status: string;
  sentAt: string;
  errorMessage: string | null;
  templateName: string | null;
  templateBodyHtml: string | null;
  templateId: string | null;
}

export default function EmailLogsPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [previewLog, setPreviewLog] = useState<EmailLog | null>(null);

  useEffect(() => {
    fetch(`/api/admin/email-logs?page=${page}`)
      .then((res) => {
        if (res.status === 401) {
          router.replace("/dashboard");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) {
          setLogs(data.logs);
          setTotalPages(data.totalPages);
          setTotal(data.total);
          setLoaded(true);
        }
      })
      .catch(console.error);
  }, [page, router]);

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Email Logs</h1>
        <p className="text-gray-500 dark:text-gray-400">
          View all sent emails ({total} total)
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Send History</CardTitle>
              <CardDescription>Page {page} of {totalPages || 1}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No emails sent yet
            </p>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-800"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{log.subject}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      To: <span className="text-blue-600 dark:text-blue-400">{log.toEmail}</span>
                    </p>
                    {log.templateName && (
                      <p className="text-xs text-muted-foreground">
                        Template: {log.templateName}
                        {!log.templateId && (
                          <span className="text-red-400 ml-1">(Deleted)</span>
                        )}
                      </p>
                    )}
                    {log.errorMessage && (
                      <p className="text-xs text-red-500 mt-1 truncate">
                        {log.errorMessage}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        log.status === "sent"
                          ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                          : log.status === "failed"
                          ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                          : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                      }`}
                    >
                      {log.status}
                    </span>
                    <button
                      onClick={() => log.templateBodyHtml && setPreviewLog(log)}
                      disabled={!log.templateBodyHtml}
                      className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed"
                      title={log.templateBodyHtml ? "Preview email" : "No template preview available"}
                    >
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(log.sentAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!previewLog} onOpenChange={(open) => !open && setPreviewLog(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{previewLog?.subject}</DialogTitle>
            <DialogDescription>
              To: {previewLog?.toEmail}
              {previewLog?.templateName && ` — Template: ${previewLog.templateName}`}
            </DialogDescription>
          </DialogHeader>
          {previewLog?.templateBodyHtml && (
            /<[a-z][\s\S]*>/i.test(previewLog.templateBodyHtml) ? (
              <div
                className="border rounded-lg p-4 bg-white"
                dangerouslySetInnerHTML={{ __html: previewLog.templateBodyHtml }}
              />
            ) : (
              <pre className="border rounded-lg p-4 bg-white text-sm whitespace-pre-wrap font-sans">
                {previewLog.templateBodyHtml}
              </pre>
            )
          )}
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </div>
  );
}
