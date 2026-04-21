"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { FileText, Plus, Pencil, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText: string | null;
  type: string;
  createdAt: string;
  updatedAt: string;
}

const EMAIL_VARIABLES = [
  { label: "First Name", variable: "firstName" },
  { label: "Last Name", variable: "lastName" },
  { label: "Email", variable: "email" },
  { label: "Full Name", variable: "fullName" },
  { label: "Verify URL", variable: "verifyUrl" },
  { label: "Login URL", variable: "loginUrl" },
  { label: "Reset URL", variable: "resetUrl" },
  { label: "Password", variable: "password" },
  { label: "Product Name", variable: "productName" },
  { label: "Amount", variable: "amount" },
  { label: "Currency", variable: "currency" },
  { label: "Date", variable: "date" },
];

const TEMPLATE_TYPES = [
  { value: "verification", label: "Verification" },
  { value: "welcome", label: "Welcome" },
  { value: "purchase", label: "Purchase" },
  { value: "course_access", label: "Course Access" },
  { value: "password_reset", label: "Password Reset" },
  { value: "notification", label: "Notification" },
  { value: "account_created", label: "Account Created (Guest Checkout)" },
  { value: "custom", label: "Custom" },
];

export default function EmailTemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Create/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [form, setForm] = useState({
    name: "",
    subject: "",
    bodyHtml: "",
    bodyText: "",
    contentType: "html" as "html" | "plaintext",
    type: "custom",
  });
  const [saving, setSaving] = useState(false);
  const [showEditPreview, setShowEditPreview] = useState(false);
  const bodyHtmlRef = useRef<HTMLTextAreaElement>(null);
  const bodyTextRef = useRef<HTMLTextAreaElement>(null);
  const [varsOpen, setVarsOpen] = useState(false);
  const varsRef = useRef<HTMLDivElement>(null);

  // Preview dialog
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<EmailTemplate | null>(null);

  const fetchTemplates = async () => {
    try {
      const res = await fetch("/api/admin/email-templates");
      if (res.status === 401) {
        router.replace("/dashboard");
        return;
      }
      if (res.ok) {
        const data = await res.json();
        if (data?.templates) {
          setTemplates(data.templates);
        }
      }
    } catch (error) {
      console.error("Failed to fetch templates:", error);
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (varsRef.current && !varsRef.current.contains(e.target as Node)) {
        setVarsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", subject: "", bodyHtml: "", bodyText: "", contentType: "html", type: "custom" });
    setShowEditPreview(false);
    setDialogOpen(true);
  };

  const openEdit = (template: EmailTemplate) => {
    setEditing(template);
    setShowEditPreview(false);
    const hasBodyText = template.bodyText && template.bodyText.trim();
    const hasBodyHtml = template.bodyHtml && template.bodyHtml.trim();
    setForm({
      name: template.name,
      subject: template.subject,
      bodyHtml: template.bodyHtml || "",
      bodyText: template.bodyText || "",
      contentType: hasBodyText && !hasBodyHtml ? "plaintext" : "html",
      type: template.type,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const bodyContent = form.contentType === "html" ? form.bodyHtml : form.bodyText;
    if (!form.name || !form.subject || !bodyContent.trim() || !form.type) {
      toast.error("Name, subject, body, and type are required");
      return;
    }

    setSaving(true);
    try {
      const url = editing
        ? `/api/admin/email-templates/${editing.id}`
        : "/api/admin/email-templates";
      const method = editing ? "PATCH" : "POST";

      const payload = {
        name: form.name,
        subject: form.subject,
        bodyHtml: form.contentType === "html" ? form.bodyHtml : "",
        bodyText: form.contentType === "plaintext" ? form.bodyText : "",
        type: form.type,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(editing ? "Template updated" : "Template created");
        setDialogOpen(false);
        fetchTemplates();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to save template");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!templateToDelete) return;

    try {
      const res = await fetch(`/api/admin/email-templates/${templateToDelete.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Template deleted");
        setDeleteDialogOpen(false);
        setTemplateToDelete(null);
        fetchTemplates();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to delete template");
      }
    } catch {
      toast.error("An error occurred");
    }
  };

  const insertVariable = (variable: string) => {
    const isHtml = form.contentType === "html";
    const ref = isHtml ? bodyHtmlRef : bodyTextRef;
    const el = ref.current;
    const current = isHtml ? form.bodyHtml : form.bodyText;
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? start;
    const text = `{{${variable}}}`;
    const newValue = current.slice(0, start) + text + current.slice(end);
    if (isHtml) {
      setForm({ ...form, bodyHtml: newValue });
    } else {
      setForm({ ...form, bodyText: newValue });
    }
    requestAnimationFrame(() => {
      if (el) {
        el.focus();
        el.selectionStart = el.selectionEnd = start + text.length;
      }
    });
  };

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Email Templates</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Manage email templates for automated emails
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          New Template
        </Button>
      </div>

      {/* Templates List */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Templates</CardTitle>
              <CardDescription>{templates.length} template{templates.length !== 1 ? "s" : ""}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No templates yet. Create your first one.
            </p>
          ) : (
            <div className="space-y-3">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-800"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{template.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      Subject: {template.subject}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                        {template.type}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Updated {formatDate(template.updatedAt)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 ml-4">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setPreviewTemplate(template);
                        setPreviewOpen(true);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(template)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                      onClick={() => {
                        setTemplateToDelete(template);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) setEditing(null);
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Template" : "New Template"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update the email template" : "Create a new email template"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Welcome Email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(value) => setForm({ ...form, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Subject Line</Label>
              <Input
                id="subject"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="Welcome to LeanOS!"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{form.contentType === "html" ? "HTML Body" : "Plain Text Body"}</Label>
                <div className="flex rounded-md border border-input overflow-hidden">
                  <button
                    type="button"
                    className={`px-3 py-1 text-xs font-medium transition-colors ${
                      form.contentType === "html"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background hover:bg-muted"
                    }`}
                    onClick={() => setForm({ ...form, contentType: "html" })}
                  >
                    HTML
                  </button>
                  <button
                    type="button"
                    className={`px-3 py-1 text-xs font-medium transition-colors ${
                      form.contentType === "plaintext"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background hover:bg-muted"
                    }`}
                    onClick={() => setForm({ ...form, contentType: "plaintext" })}
                  >
                    Plain Text
                  </button>
                </div>
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
              {form.contentType === "html" ? (
                <textarea
                  ref={bodyHtmlRef}
                  value={form.bodyHtml}
                  onChange={(e) => setForm({ ...form, bodyHtml: e.target.value })}
                  placeholder="<h1>Welcome!</h1><p>Thanks for signing up.</p>"
                  className="flex min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 font-mono"
                />
              ) : (
                <textarea
                  ref={bodyTextRef}
                  value={form.bodyText}
                  onChange={(e) => setForm({ ...form, bodyText: e.target.value })}
                  placeholder="Welcome! Thanks for signing up."
                  className="flex min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              )}
            </div>

            {(form.contentType === "html" ? form.bodyHtml : form.bodyText) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowEditPreview(true)}
              >
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog (from list) */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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

      {/* Preview Dialog (from editor) */}
      <Dialog open={showEditPreview} onOpenChange={setShowEditPreview}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview{form.name ? `: ${form.name}` : ""}</DialogTitle>
            <DialogDescription>
              {form.subject ? `Subject: ${form.subject}` : "No subject set"}
            </DialogDescription>
          </DialogHeader>
          {form.contentType === "html" ? (
            <div
              className="rounded-lg border p-4 bg-white dark:bg-gray-900"
              dangerouslySetInnerHTML={{ __html: form.bodyHtml }}
            />
          ) : (
            <pre className="rounded-lg border p-4 bg-white dark:bg-gray-900 text-sm whitespace-pre-wrap font-sans">
              {form.bodyText}
            </pre>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditPreview(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => {
        setDeleteDialogOpen(open);
        if (!open) setTemplateToDelete(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{templateToDelete?.name}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setDeleteDialogOpen(false);
              setTemplateToDelete(null);
            }}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
