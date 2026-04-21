"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Send, Eye, ChevronDown } from "lucide-react";
import { toast } from "sonner";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText: string | null;
  type: string;
}

export default function TestEmailsPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [to, setTo] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/admin/email-templates")
      .then((res) => {
        if (res.status === 401) {
          router.replace("/dashboard");
          return null;
        }
        if (!res.ok) throw new Error("Failed to load templates");
        return res.json();
      })
      .then((data) => {
        if (data?.templates) {
          setTemplates(data.templates);
        }
      })
      .catch(console.error)
      .finally(() => setLoaded(true));
  }, [router]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSend = async () => {
    if (!to || !templateId) {
      toast.error("Please enter an email and select a template");
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/admin/test-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, templateId }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Test email sent!");
      } else {
        toast.error(data.error || "Failed to send email");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setSending(false);
    }
  };

  const selectedTemplate = templates.find((t) => t.id === templateId);

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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Test Emails</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Send test emails to verify your SMTP configuration and templates
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-3 max-w-md">
          <div className="space-y-1">
            <Label htmlFor="to">Recipient Email</Label>
            <Input
              id="to"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="test@example.com"
            />
          </div>

          <div className="space-y-1">
            <Label>Email Template</Label>
            {templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No templates available. Create one in Email Templates first.
              </p>
            ) : (
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <span className={selectedTemplate ? "" : "text-muted-foreground"}>
                    {selectedTemplate ? `${selectedTemplate.name} (${selectedTemplate.type})` : "Select a template"}
                  </span>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </button>
                {dropdownOpen && (
                  <div className="absolute z-50 mt-1 w-full rounded-md border bg-background shadow-md">
                    {templates.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between px-3 py-2 text-sm hover:bg-accent cursor-pointer"
                      >
                        <span
                          className="flex-1"
                          onClick={() => {
                            setTemplateId(t.id);
                            setDropdownOpen(false);
                          }}
                        >
                          {t.name} ({t.type})
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewTemplate(t);
                            setPreviewOpen(true);
                            setDropdownOpen(false);
                          }}
                          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                        >
                          <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <Button
            onClick={handleSend}
            disabled={sending || !to || !templateId}
          >
            <Send className="h-4 w-4 mr-2" />
            {sending ? "Sending..." : "Send Test Email"}
          </Button>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Preview: {previewTemplate?.name}</DialogTitle>
            <DialogDescription>
              Subject: {previewTemplate?.subject}
            </DialogDescription>
          </DialogHeader>
          {previewTemplate?.bodyHtml ? (
            <div
              className="rounded-lg border p-4 bg-white dark:bg-gray-900"
              dangerouslySetInnerHTML={{ __html: previewTemplate.bodyHtml }}
            />
          ) : (
            <pre className="rounded-lg border p-4 bg-white dark:bg-gray-900 text-sm whitespace-pre-wrap font-sans">
              {previewTemplate?.bodyText || "No content"}
            </pre>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
