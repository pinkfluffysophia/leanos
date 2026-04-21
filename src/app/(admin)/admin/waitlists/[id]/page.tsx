"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Users,
  CheckCircle,
  Calendar,
  Send,
  Eye,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

const EMAIL_VARIABLES = [
  { label: "First Name", variable: "firstName" },
  { label: "Last Name", variable: "lastName" },
  { label: "Email", variable: "email" },
  { label: "Full Name", variable: "fullName" },
  { label: "Verify URL", variable: "verifyUrl" },
  { label: "Login URL", variable: "loginUrl" },
  { label: "Reset URL", variable: "resetUrl" },
  { label: "Product Name", variable: "productName" },
  { label: "Amount", variable: "amount" },
  { label: "Currency", variable: "currency" },
  { label: "Date", variable: "date" },
];

interface WaitlistDetail {
  id: string;
  title: string;
  description: string | null;
  shortcode: string;
  status: string;
  createdAt: string;
}

interface Member {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isVerified: boolean;
  joinedAt: string;
}

interface Template {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText: string | null;
}

export default function WaitlistDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [waitlist, setWaitlist] = useState<WaitlistDetail | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [totalMembers, setTotalMembers] = useState(0);
  const [verifiedCount, setVerifiedCount] = useState(0);
  const [filteredTotal, setFilteredTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loaded, setLoaded] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [verifiedFilter, setVerifiedFilter] = useState("all");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Email modal
  const [modalOpen, setModalOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("none");
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [plainText, setPlainText] = useState("");
  const [contentType, setContentType] = useState<"html" | "plaintext">("html");
  const [delay, setDelay] = useState(500);
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState<{ sent: number; failed: number; total: number } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const htmlRef = useRef<HTMLTextAreaElement>(null);
  const plainTextRef = useRef<HTMLTextAreaElement>(null);
  const [varsOpen, setVarsOpen] = useState(false);
  const varsRef = useRef<HTMLDivElement>(null);

  const insertVariable = (variable: string) => {
    const isHtml = contentType === "html";
    const ref = isHtml ? htmlRef : plainTextRef;
    const el = ref.current;
    const current = isHtml ? html : plainText;
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? start;
    const text = `{{${variable}}}`;
    const newValue = current.slice(0, start) + text + current.slice(end);
    if (isHtml) {
      setHtml(newValue);
    } else {
      setPlainText(newValue);
    }
    requestAnimationFrame(() => {
      if (el) {
        el.focus();
        el.selectionStart = el.selectionEnd = start + text.length;
      }
    });
  };

  const fetchData = useCallback(async (currentPage: number, searchQuery: string, verified: string) => {
    try {
      const params = new URLSearchParams({ page: String(currentPage) });
      if (searchQuery) params.set("search", searchQuery);
      if (verified !== "all") params.set("verified", verified);

      const res = await fetch(`/api/admin/waitlists/${id}?${params}`);
      if (res.status === 401) {
        router.replace("/dashboard");
        return;
      }
      if (res.status === 404) {
        router.replace("/admin/waitlists");
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setWaitlist(data.waitlist);
        setMembers(data.members);
        setTotalMembers(data.totalMembers);
        setVerifiedCount(data.verifiedCount);
        setFilteredTotal(data.filteredTotal);
        setTotalPages(data.totalPages);
      }
    } catch {
      console.error("Failed to fetch waitlist");
    } finally {
      setLoaded(true);
    }
  }, [id, router]);

  useEffect(() => {
    fetchData(1, "", "all");
  }, [fetchData]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (varsRef.current && !varsRef.current.contains(e.target as Node)) {
        setVarsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      setSelectedIds(new Set());
      fetchData(1, search, verifiedFilter);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, verifiedFilter, fetchData]);

  const goToPage = (newPage: number) => {
    setPage(newPage);
    fetchData(newPage, search, verifiedFilter);
  };

  // Selection helpers
  const currentPageIds = members.map((m) => m.id);
  const allOnPageSelected = currentPageIds.length > 0 && currentPageIds.every((mid) => selectedIds.has(mid));
  const someOnPageSelected = currentPageIds.some((mid) => selectedIds.has(mid));

  const toggleMember = (memberId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  };

  const togglePage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        currentPageIds.forEach((mid) => next.delete(mid));
      } else {
        currentPageIds.forEach((mid) => next.add(mid));
      }
      return next;
    });
  };

  // Email modal
  const openModal = () => {
    setSelectedTemplate("none");
    setSubject("");
    setHtml("");
    setPlainText("");
    setContentType("html");
    setDelay(500);
    fetch("/api/admin/email-templates")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.templates) setTemplates(data.templates);
      })
      .catch(() => {});
    setModalOpen(true);
  };

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    if (templateId === "none") return;
    const tpl = templates.find((t) => t.id === templateId);
    if (tpl) {
      setSubject(tpl.subject);
      setHtml(tpl.bodyHtml || "");
      setPlainText(tpl.bodyText || "");
      if (!tpl.bodyHtml && tpl.bodyText) {
        setContentType("plaintext");
      } else {
        setContentType("html");
      }
    }
  };

  const handleSend = async () => {
    const activeBody = contentType === "html" ? html : plainText;
    if (!subject.trim() || !activeBody.trim()) {
      toast.error("Subject and body are required");
      return;
    }

    const memberIdList = Array.from(selectedIds);
    const total = memberIdList.length;
    const delayMs = delay >= 0 ? delay : 500;
    const tplId = selectedTemplate !== "none" ? selectedTemplate : undefined;
    const tplName = selectedTemplate !== "none"
      ? templates.find((t) => t.id === selectedTemplate)?.name
      : undefined;

    setSending(true);
    setSendProgress({ sent: 0, failed: 0, total });

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < memberIdList.length; i++) {
      try {
        const res = await fetch(`/api/admin/waitlists/${id}/send-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            memberIds: [memberIdList[i]],
            subject: subject.trim(),
            html: activeBody.trim(),
            isPlainText: contentType === "plaintext",
            templateId: tplId,
            templateName: tplName,
          }),
        });

        if (res.ok) {
          sent++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }

      setSendProgress({ sent, failed, total });

      if (delayMs > 0 && i < memberIdList.length - 1) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }

    if (failed > 0) {
      toast.warning(`Sent ${sent}/${total} emails (${failed} failed)`);
    } else {
      toast.success(`Successfully sent ${sent} emails`);
    }

    setSelectedIds(new Set());
    setModalOpen(false);
    setSending(false);
    setSendProgress(null);
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!waitlist) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Waitlist not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/admin/waitlists")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{waitlist.title}</h1>
              <Badge className={waitlist.status === "active" ? "bg-green-600 text-white" : "bg-red-600 text-white"}>
                {waitlist.status}
              </Badge>
            </div>
            {waitlist.description && (
              <p className="text-gray-500 dark:text-gray-400 mt-0.5">{waitlist.description}</p>
            )}
            <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1">
              <ExternalLink className="h-3.5 w-3.5" />
              /waitlist/{waitlist.shortcode}
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Users className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{totalMembers}</p>
              <p className="text-sm text-muted-foreground">Total Members</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{verifiedCount}</p>
              <p className="text-sm text-muted-foreground">Verified</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{new Date(waitlist.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
              <p className="text-sm text-muted-foreground">Created</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="w-full sm:w-64"
        />
        <Select value={verifiedFilter} onValueChange={(v) => setVerifiedFilter(v)}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Members</SelectItem>
            <SelectItem value="true">Verified</SelectItem>
            <SelectItem value="false">Unverified</SelectItem>
          </SelectContent>
        </Select>
        {selectedIds.size > 0 && (
          <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
            Clear selection ({selectedIds.size})
          </Button>
        )}
      </div>

      {/* Selection banner */}
      {allOnPageSelected && filteredTotal > members.length && (
        <div className="flex items-center justify-center gap-2 rounded-lg bg-blue-50 dark:bg-blue-950 p-3 text-sm text-blue-700 dark:text-blue-300">
          <span>All {members.length} members on this page are selected.</span>
        </div>
      )}

      {/* Members list */}
      <Card>
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={allOnPageSelected}
                ref={(el) => {
                  if (el) {
                    const input = el as unknown as HTMLButtonElement;
                    if (someOnPageSelected && !allOnPageSelected) {
                      input.dataset.state = "indeterminate";
                      input.setAttribute("aria-checked", "mixed");
                    }
                  }
                }}
                onCheckedChange={togglePage}
              />
              <CardTitle className="text-sm font-medium">
                {filteredTotal} member{filteredTotal !== 1 ? "s" : ""}
                {search || verifiedFilter !== "all" ? " (filtered)" : ""}
            </CardTitle>
            </div>
            <Button size="sm" onClick={openModal} disabled={selectedIds.size === 0}>
              <Send className="h-4 w-4 mr-2" />
              Send Email
              {selectedIds.size > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-white/20">
                  {selectedIds.size}
                </span>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {members.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              {search || verifiedFilter !== "all" ? "No members match your filters" : "No members yet"}
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <Checkbox
                    checked={selectedIds.has(member.id)}
                    onCheckedChange={() => toggleMember(member.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {member.firstName} {member.lastName}
                      </span>
                      <Badge variant={member.isVerified ? "default" : "outline"} className="text-[10px] px-1.5 py-0">
                        {member.isVerified ? "Verified" : "Unverified"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{member.email}</p>
                  </div>
                  <span className="text-xs text-muted-foreground hidden sm:inline">
                    Joined {new Date(member.joinedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-800">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => goToPage(page + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Send Email Dialog */}
      <Dialog open={modalOpen} onOpenChange={(open) => !sending && setModalOpen(open)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Send Email to {selectedIds.size} Member{selectedIds.size !== 1 ? "s" : ""}</DialogTitle>
            <DialogDescription>
              Compose an email to send to the selected waitlist members
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Template (optional)</Label>
              <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No template</SelectItem>
                  {templates.map((tpl) => (
                    <SelectItem key={tpl.id} value={tpl.id}>{tpl.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="emailSubject">Subject *</Label>
              <Input
                id="emailSubject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Label>{contentType === "html" ? "HTML Body" : "Plain Text Body"}</Label>
                  <div className="flex rounded-md border border-input overflow-hidden">
                    <button
                      type="button"
                      className={`px-3 py-1 text-xs font-medium transition-colors ${
                        contentType === "html"
                          ? "bg-primary text-primary-foreground"
                          : "bg-background hover:bg-muted"
                      }`}
                      onClick={() => setContentType("html")}
                    >
                      HTML
                    </button>
                    <button
                      type="button"
                      className={`px-3 py-1 text-xs font-medium transition-colors ${
                        contentType === "plaintext"
                          ? "bg-primary text-primary-foreground"
                          : "bg-background hover:bg-muted"
                      }`}
                      onClick={() => setContentType("plaintext")}
                    >
                      Plain Text
                    </button>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setPreviewOpen(true)}
                  disabled={!(contentType === "html" ? html : plainText).trim()}
                >
                  <Eye className="h-3.5 w-3.5 mr-1" />
                  Preview
                </Button>
              </div>
              <div className="relative" ref={varsRef}>
                <button
                  type="button"
                  onClick={() => setVarsOpen(!varsOpen)}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md border border-input bg-background hover:bg-muted transition-colors text-muted-foreground"
                  title="Insert variable"
                >
                  <span className="font-mono text-[11px]">{`{ }`}</span>
                </button>
                {varsOpen && (
                  <div className="absolute z-50 mt-1 w-44 rounded-md border bg-background shadow-md">
                    {EMAIL_VARIABLES.map((v) => (
                      <button
                        key={v.variable}
                        type="button"
                        onClick={() => {
                          insertVariable(v.variable);
                          setVarsOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent cursor-pointer"
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {contentType === "html" ? (
                <Textarea
                  ref={htmlRef}
                  value={html}
                  onChange={(e) => setHtml(e.target.value)}
                  placeholder="<h1>Hello!</h1><p>Your email content here...</p>"
                  rows={8}
                  className="font-mono text-sm"
                />
              ) : (
                <Textarea
                  ref={plainTextRef}
                  value={plainText}
                  onChange={(e) => setPlainText(e.target.value)}
                  placeholder="Hello! Your email content here..."
                  rows={8}
                  className="text-sm"
                />
              )}
            </div>
            <div className="flex flex-col sm:flex-row sm:items-end gap-4">
              <div className="space-y-2">
                <Label htmlFor="emailDelay">Delay between emails (ms)</Label>
                <Input
                  id="emailDelay"
                  type="number"
                  value={delay}
                  onChange={(e) => setDelay(parseInt(e.target.value) || 0)}
                  className="w-full sm:w-32"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={sending}>
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={sending || !subject.trim() || !(contentType === "html" ? html : plainText).trim()}>
              {sending
                ? sendProgress
                  ? `${sendProgress.sent + sendProgress.failed}/${sendProgress.total} sent`
                  : "Sending..."
                : `Send to ${selectedIds.size} members`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
            <DialogDescription>Subject: {subject || "(no subject)"}</DialogDescription>
          </DialogHeader>
          {contentType === "html" ? (
            <iframe
              sandbox=""
              srcDoc={html}
              className="border rounded-lg w-full min-h-[300px] bg-white"
              title="Email Preview"
            />
          ) : (
            <pre className="rounded-lg border p-4 bg-white dark:bg-gray-900 text-sm whitespace-pre-wrap font-sans min-h-[300px]">
              {plainText}
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
