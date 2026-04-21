"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  Users,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  CircleCheck,
  CircleX,
  Send,
  Eye,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

interface TagItem {
  id: string;
  name: string;
  color: string;
}

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  nickname: string | null;
  profilePictureUrl: string | null;
  status: string;
  role: string;
  suspendedUntil: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  tags: TagItem[];
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText: string | null;
}

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

function isLightColor(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 180;
}

export default function MessengerPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const tagDropdownRef = useRef<HTMLDivElement>(null);
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [perPage, setPerPage] = useState(20);
  const [allTags, setAllTags] = useState<TagItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("none");
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [plainText, setPlainText] = useState("");
  const [delay, setDelay] = useState(500);
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState<{ sent: number; failed: number; total: number } | null>(null);
  const [contentType, setContentType] = useState<"html" | "plaintext">("html");

  // Preview
  const [previewOpen, setPreviewOpen] = useState(false);
  const htmlRef = useRef<HTMLTextAreaElement>(null);
  const plainTextRef = useRef<HTMLTextAreaElement>(null);
  const [varsOpen, setVarsOpen] = useState(false);
  const varsRef = useRef<HTMLDivElement>(null);

  // Fetch tags
  useEffect(() => {
    fetch("/api/admin/tags")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.tags) setAllTags(data.tags);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target as Node)) {
        setTagDropdownOpen(false);
      }
      if (varsRef.current && !varsRef.current.contains(e.target as Node)) {
        setVarsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Clear selection when filters change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [debouncedSearch, tagFilter, roleFilter, statusFilter]);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: page.toString(), perPage: perPage.toString() });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (tagFilter.length > 0) params.set("tags", tagFilter.join(","));
      if (roleFilter !== "all") params.set("role", roleFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const response = await fetch(`/api/admin/users?${params}`);
      if (response.status === 401) {
        router.replace("/dashboard");
        return;
      }
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
        setTotalPages(data.totalPages);
        setTotal(data.total);
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
    } finally {
      setLoaded(true);
    }
  }, [page, perPage, debouncedSearch, tagFilter, roleFilter, statusFilter, router]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(date));
  };

  const isSuspended = (user: User) => {
    if (!user.suspendedUntil) return false;
    return new Date(user.suspendedUntil) > new Date();
  };

  // Selection helpers
  const currentPageIds = users.map((u) => u.id);
  const allOnPageSelected = currentPageIds.length > 0 && currentPageIds.every((id) => selectedIds.has(id));
  const someOnPageSelected = currentPageIds.some((id) => selectedIds.has(id));

  const toggleUser = (userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const togglePage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        currentPageIds.forEach((id) => next.delete(id));
      } else {
        currentPageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const selectAllMatching = async () => {
    try {
      const params = new URLSearchParams({ idsOnly: "true" });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (tagFilter.length > 0) params.set("tags", tagFilter.join(","));
      if (roleFilter !== "all") params.set("role", roleFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const response = await fetch(`/api/admin/users?${params}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedIds(new Set(data.userIds));
        toast.success(`Selected ${data.total} users`);
      }
    } catch {
      toast.error("Failed to select all users");
    }
  };

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

  // Modal handlers
  const openModal = () => {
    setSelectedTemplate("none");
    setSubject("");
    setHtml("");
    setPlainText("");
    setDelay(500);
    setContentType("html");
    // Fetch templates
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
      // Auto-set content type based on template
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

    const userIdList = Array.from(selectedIds);
    const total = userIdList.length;
    const delayMs = delay >= 0 ? delay : 500;
    const tplId = selectedTemplate !== "none" ? selectedTemplate : undefined;
    const tplName = selectedTemplate !== "none"
      ? templates.find((t) => t.id === selectedTemplate)?.name
      : undefined;

    setSending(true);
    setSendProgress({ sent: 0, failed: 0, total });

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < userIdList.length; i++) {
      try {
        const res = await fetch("/api/admin/messenger/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: userIdList[i],
            subject: subject.trim(),
            html: activeBody.trim(),
            templateId: tplId,
            templateName: tplName,
            isPlainText: contentType === "plaintext",
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

      // Delay between sends (skip after last one)
      if (delayMs > 0 && i < userIdList.length - 1) {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Messenger</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Send bulk emails to users ({total} total)
          </p>
        </div>
        <Button
          onClick={openModal}
          disabled={selectedIds.size === 0}
        >
          <Send className="h-4 w-4 mr-2" />
          Send Email
          {selectedIds.size > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-white/20">
              {selectedIds.size}
            </span>
          )}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="w-full sm:max-w-xs"
        />
        <Select
          value={roleFilter}
          onValueChange={(v) => {
            setRoleFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="user">User</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Verified</SelectItem>
            <SelectItem value="inactive">Unverified</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative" ref={tagDropdownRef}>
          <button
            type="button"
            onClick={() => setTagDropdownOpen(!tagDropdownOpen)}
            className="flex h-9 w-full sm:w-[160px] items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <span>
              {tagFilter.length === 0 ? "All Tags" : `${tagFilter.length} tag${tagFilter.length !== 1 ? "s" : ""}`}
            </span>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </button>
          {tagDropdownOpen && (
            <div className="absolute z-50 mt-1 w-full min-w-[180px] rounded-md border bg-background shadow-md">
              {tagFilter.length > 0 && (
                <button
                  type="button"
                  onClick={() => { setTagFilter([]); setPage(1); }}
                  className="w-full px-3 py-2 text-xs text-muted-foreground hover:bg-accent text-left border-b"
                >
                  Clear all
                </button>
              )}
              {allTags.map((tag) => {
                const isSelected = tagFilter.includes(tag.id);
                return (
                  <label
                    key={tag.id}
                    className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent cursor-pointer"
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => {
                        const next = isSelected
                          ? tagFilter.filter((id) => id !== tag.id)
                          : [...tagFilter, tag.id];
                        setTagFilter(next);
                        setPage(1);
                      }}
                    />
                    <span
                      className="inline-block w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                  </label>
                );
              })}
            </div>
          )}
        </div>
        <Select
          value={perPage.toString()}
          onValueChange={(v) => {
            setPerPage(parseInt(v));
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="20">20 / page</SelectItem>
            <SelectItem value="50">50 / page</SelectItem>
            <SelectItem value="100">100 / page</SelectItem>
            <SelectItem value="200">200 / page</SelectItem>
          </SelectContent>
        </Select>
        {selectedIds.size > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
            Clear selection ({selectedIds.size})
          </Button>
        )}
      </div>

      {/* Select all matching banner */}
      {someOnPageSelected && total > currentPageIds.length && selectedIds.size < total && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-sm">
          <span className="text-blue-700 dark:text-blue-300">
            {selectedIds.size} user{selectedIds.size !== 1 ? "s" : ""} selected.
          </span>
          <button
            onClick={selectAllMatching}
            className="text-blue-600 dark:text-blue-400 font-medium hover:underline"
          >
            Select all {total} matching users
          </button>
        </div>
      )}

      {/* Users List */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Checkbox
              checked={allOnPageSelected ? true : someOnPageSelected ? "indeterminate" : false}
              onCheckedChange={togglePage}
            />
            <Users className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Recipients</CardTitle>
              <CardDescription>
                Page {page} of {totalPages || 1}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No users found
            </p>
          ) : (
            <div className="space-y-2">
              {users.map((user) => {
                const suspended = isSuspended(user);
                const isSelected = selectedIds.has(user.id);
                return (
                  <div
                    key={user.id}
                    onClick={() => toggleUser(user.id)}
                    className={`flex items-center gap-4 p-4 rounded-lg border transition-colors cursor-pointer ${
                      isSelected
                        ? "border-blue-400 bg-blue-50 dark:bg-blue-950/50 dark:border-blue-700"
                        : "border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    }`}
                  >
                    {/* Checkbox */}
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleUser(user.id)}
                      onClick={(e) => e.stopPropagation()}
                    />

                    {/* Avatar */}
                    {user.profilePictureUrl ? (
                      <img
                        src={user.profilePictureUrl}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-500 flex items-center justify-center shrink-0">
                        <span className="text-sm font-medium text-white">
                          {user.firstName[0]}{user.lastName[0]}
                        </span>
                      </div>
                    )}

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">
                          {user.firstName} {user.lastName}{user.nickname ? ` (${user.nickname})` : ""}
                        </p>
                        {user.role === "admin" && (
                          <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                            ADMIN
                          </span>
                        )}
                        {suspended && (
                          <span title="Suspended">
                            <ShieldAlert className="h-3.5 w-3.5 text-red-500 shrink-0" />
                          </span>
                        )}
                        {user.status === "active" ? (
                          <span title="Verified">
                            <CircleCheck className="h-3.5 w-3.5 text-green-500 shrink-0" />
                          </span>
                        ) : (
                          <span title="Unverified">
                            <CircleX className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>

                    {/* Tags */}
                    {user.tags.length > 0 && (
                      <div className="hidden sm:flex flex-wrap gap-1.5">
                        {user.tags.map((tag) => {
                          const isLight = isLightColor(tag.color);
                          return (
                            <span
                              key={tag.id}
                              className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${
                                isLight
                                  ? "text-gray-900 border border-gray-300"
                                  : "text-white"
                              }`}
                              style={{ backgroundColor: tag.color }}
                            >
                              {tag.name}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Last seen */}
                    <span className="hidden md:block text-xs text-muted-foreground whitespace-nowrap">
                      {user.lastSeenAt ? `Last seen: ${formatDate(user.lastSeenAt)}` : "Never seen"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
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

      {/* Send Email Modal */}
      <Dialog open={modalOpen} onOpenChange={(open) => !sending && setModalOpen(open)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Send Email</DialogTitle>
            <DialogDescription>
              Sending to {selectedIds.size} recipient{selectedIds.size !== 1 ? "s" : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {selectedIds.size >= 100 && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 text-sm text-yellow-700 dark:text-yellow-300">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Large batch ({selectedIds.size} recipients). This may take a while.
              </div>
            )}

            {/* Template */}
            <div className="space-y-2">
              <Label>Template (optional)</Label>
              <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No template</SelectItem>
                  {templates.map((tpl) => (
                    <SelectItem key={tpl.id} value={tpl.id}>
                      {tpl.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject..."
              />
            </div>

            {/* Body */}
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
                  className="font-mono text-sm min-h-[200px]"
                />
              ) : (
                <Textarea
                  ref={plainTextRef}
                  value={plainText}
                  onChange={(e) => setPlainText(e.target.value)}
                  placeholder="Hello! Your email content here..."
                  className="text-sm min-h-[200px]"
                />
              )}
            </div>

            {/* Delay */}
            <div className="space-y-2">
              <Label>Delay between emails (ms)</Label>
              <Input
                type="number"
                value={delay}
                onChange={(e) => setDelay(parseInt(e.target.value) || 0)}
                min={0}
                placeholder="500"
              />
              <p className="text-xs text-muted-foreground">
                Delay between each email send to avoid SMTP rate limits. Default: 500ms
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setModalOpen(false)}
              disabled={sending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={sending || !subject.trim() || !(contentType === "html" ? html : plainText).trim()}
            >
              {sending
                ? sendProgress
                  ? `${sendProgress.sent + sendProgress.failed}/${sendProgress.total} sent`
                  : "Sending..."
                : `Send to ${selectedIds.size} users`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-2xl">
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
