"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Check,
  Plus,
  ShieldAlert,
  Trash2,
  X,
  StickyNote,
  Tag,
  Settings,
  UserPen,
  Share2,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Mail,
  Eye,
  Paperclip,
  Send,
  Package,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

interface PurchaseItem {
  id: string;
  amount: number;
  currency: string;
  status: string;
  stripePaymentId: string | null;
  createdAt: string;
  productName: string | null;
  productImage: string | null;
  priceType: string | null;
  priceInterval: string | null;
}

interface ActiveProductItem {
  productId: string;
  productName: string;
  productImage: string | null;
  shortDescription: string | null;
  priceType: string | null;
  priceInterval: string | null;
}

interface TagItem {
  id: string;
  name: string;
  color: string;
}

interface NoteItem {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  attachmentUrl: string | null;
  attachmentName: string | null;
  createdAt: string;
}

interface EmailLogItem {
  id: string;
  toEmail: string;
  subject: string;
  status: string;
  sentAt: string;
  errorMessage: string | null;
  templateName: string | null;
  templateBodyHtml: string | null;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText: string | null;
}

interface AdminPrice {
  id: string;
  amount: number;
  currency: string;
  type: string;
  interval: string | null;
  intervalCount: number | null;
  isActive: boolean;
  isDefault: boolean;
}

interface AdminProduct {
  id: string;
  name: string;
  prices: AdminPrice[];
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

interface UserDetail {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  nickname: string | null;
  profilePictureUrl: string | null;
  status: string;
  role: string;
  suspendedUntil: string | null;
  emailVerifiedAt: string | null;
  referralCode: string;
  referredBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Referrer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

const PRESET_COLORS = [
  "#EF4444", "#F97316", "#F59E0B", "#EAB308",
  "#22C55E", "#10B981", "#14B8A6", "#06B6D4",
  "#3B82F6", "#6366F1", "#8B5CF6", "#A855F7",
  "#EC4899", "#F43F5E", "#6B7280", "#1F2937",
];

function isLightColor(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 180;
}

export default function UserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { data: session } = useSession();
  const userId = params.id as string;

  const [user, setUser] = useState<UserDetail | null>(null);
  const [userTags, setUserTags] = useState<TagItem[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [allTags, setAllTags] = useState<TagItem[]>([]);
  const [referrer, setReferrer] = useState<Referrer | null>(null);
  const [referralCount, setReferralCount] = useState(0);
  const [activeProducts, setActiveProducts] = useState<ActiveProductItem[]>([]);
  const [purchaseStats, setPurchaseStats] = useState({ count: 0, total: 0 });
  const [userPurchases, setUserPurchases] = useState<PurchaseItem[]>([]);
  const [purchasePage, setPurchasePage] = useState(1);
  const [purchasePages, setPurchasePages] = useState(1);
  const [loaded, setLoaded] = useState(false);

  // Edit profile state
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editNickname, setEditNickname] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Tag selection state
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  // Management state
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [pendingRole, setPendingRole] = useState("");
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [customSuspendDate, setCustomSuspendDate] = useState("");

  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Create tag state
  const [createTagOpen, setCreateTagOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(PRESET_COLORS[0]);
  const [creatingTag, setCreatingTag] = useState(false);

  // Email log state
  const [recentEmailLogs, setRecentEmailLogs] = useState<EmailLogItem[]>([]);
  const [emailLogCount, setEmailLogCount] = useState(0);
  const [emailLogsModalOpen, setEmailLogsModalOpen] = useState(false);
  const [allEmailLogs, setAllEmailLogs] = useState<EmailLogItem[]>([]);
  const [emailLogPage, setEmailLogPage] = useState(1);
  const [emailLogPages, setEmailLogPages] = useState(1);
  const [loadingAllLogs, setLoadingAllLogs] = useState(false);
  const [previewLog, setPreviewLog] = useState<EmailLogItem | null>(null);

  // Notes state
  const [newNote, setNewNote] = useState("");
  const [noteFile, setNoteFile] = useState<File | null>(null);
  const noteFileRef = useRef<HTMLInputElement>(null);
  const [addingNote, setAddingNote] = useState(false);

  // Send email state
  const [sendEmailOpen, setSendEmailOpen] = useState(false);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [selectedEmailTemplate, setSelectedEmailTemplate] = useState("none");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailHtml, setEmailHtml] = useState("");
  const [emailPlainText, setEmailPlainText] = useState("");
  const [emailContentType, setEmailContentType] = useState<"html" | "plaintext">("html");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailPreviewOpen, setEmailPreviewOpen] = useState(false);
  const [emailVarsOpen, setEmailVarsOpen] = useState(false);
  const emailHtmlRef = useRef<HTMLTextAreaElement>(null);
  const emailPlainTextRef = useRef<HTMLTextAreaElement>(null);
  const emailVarsRef = useRef<HTMLDivElement>(null);

  // Manual transaction state
  const [addTransactionOpen, setAddTransactionOpen] = useState(false);
  const [transactionProducts, setTransactionProducts] = useState<AdminProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedPriceId, setSelectedPriceId] = useState("");
  const [submittingTransaction, setSubmittingTransaction] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (emailVarsRef.current && !emailVarsRef.current.contains(e.target as Node)) {
        setEmailVarsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchUser = useCallback(async (pPage?: number) => {
    try {
      const p = pPage ?? purchasePage;
      const res = await fetch(`/api/admin/users/${userId}?purchasePage=${p}`);
      if (res.status === 401) {
        router.replace("/dashboard");
        return;
      }
      if (res.status === 404) {
        router.replace("/admin/users");
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setUserTags(data.tags);
        setNotes(data.notes);
        setReferrer(data.referrer || null);
        setReferralCount(data.referralCount || 0);
        setActiveProducts(data.activeProducts || []);
        setPurchaseStats(data.purchaseStats || { count: 0, total: 0 });
        setUserPurchases(data.purchases || []);
        setPurchasePages(data.purchasePages || 1);
        // Populate edit fields
        setEditFirstName(data.user.firstName);
        setEditLastName(data.user.lastName);
        setEditNickname(data.user.nickname || "");
        setEditEmail(data.user.email);
        setSelectedTagIds(data.tags.map((t: TagItem) => t.id));
        setRecentEmailLogs(data.emailLogs || []);
        setEmailLogCount(data.emailLogCount || 0);
      }
    } catch (error) {
      console.error("Failed to fetch user:", error);
    } finally {
      setLoaded(true);
    }
  }, [userId, purchasePage, router]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    fetch("/api/admin/tags")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.tags) setAllTags(data.tags);
      })
      .catch(() => {});
  }, []);

  const isSuspended = user?.suspendedUntil && new Date(user.suspendedUntil) > new Date();

  // === Profile ===
  const handleSaveProfile = async () => {
    if (!editFirstName.trim() || !editLastName.trim() || !editEmail.trim()) {
      toast.error("First name, last name, and email are required");
      return;
    }
    setSavingProfile(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: editFirstName.trim(),
          lastName: editLastName.trim(),
          nickname: editNickname.trim() || null,
          email: editEmail.trim(),
        }),
      });
      if (res.ok) {
        toast.success("Profile updated");
        fetchUser();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to update profile");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setSavingProfile(false);
    }
  };

  // === Tags ===
  const toggleTagId = async (tagId: string) => {
    const newTagIds = selectedTagIds.includes(tagId)
      ? selectedTagIds.filter((id) => id !== tagId)
      : [...selectedTagIds, tagId];
    setSelectedTagIds(newTagIds);
    try {
      const res = await fetch(`/api/admin/users/${userId}/tags`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagIds: newTagIds }),
      });
      if (res.ok) {
        const data = await res.json();
        setUserTags(data.tags);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to save tags");
        setSelectedTagIds(selectedTagIds); // revert
      }
    } catch {
      toast.error("An error occurred");
      setSelectedTagIds(selectedTagIds); // revert
    }
  };

  // === Create Tag ===
  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      toast.error("Tag name is required");
      return;
    }
    setCreatingTag(true);
    try {
      const res = await fetch("/api/admin/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTagName.trim(), color: newTagColor }),
      });
      if (res.ok) {
        const data = await res.json();
        setAllTags((prev) => [...prev, data.tag]);
        setCreateTagOpen(false);
        setNewTagName("");
        setNewTagColor(PRESET_COLORS[0]);
        toast.success("Tag created");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to create tag");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setCreatingTag(false);
    }
  };

  // === Role ===
  const handleRoleChange = async () => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: pendingRole }),
      });
      if (res.ok) {
        toast.success(`Role changed to ${pendingRole}`);
        fetchUser();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to change role");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setRoleDialogOpen(false);
      setPendingRole("");
    }
  };

  // === Suspension ===
  const handleSuspend = async (until: Date | null) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suspendedUntil: until ? until.toISOString() : null,
        }),
      });
      if (res.ok) {
        toast.success(until ? "User suspended" : "User unsuspended");
        fetchUser();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to update suspension");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setSuspendDialogOpen(false);
      setCustomSuspendDate("");
    }
  };

  const suspendFor = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    handleSuspend(date);
  };

  const suspendPermanently = () => {
    // Set to 100 years from now
    const date = new Date();
    date.setFullYear(date.getFullYear() + 100);
    handleSuspend(date);
  };

  // === Delete ===
  const handleDeleteUser = async () => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("User deleted");
        router.replace("/admin/users");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to delete user");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setDeleteDialogOpen(false);
    }
  };

  // === Notes ===
  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setAddingNote(true);
    try {
      const formData = new FormData();
      formData.append("content", newNote.trim());
      if (noteFile) {
        formData.append("file", noteFile);
      }
      const res = await fetch(`/api/admin/users/${userId}/notes`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setNotes((prev) => [data.note, ...prev]);
        setNewNote("");
        setNoteFile(null);
        if (noteFileRef.current) noteFileRef.current.value = "";
        toast.success("Note added");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to add note");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setAddingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/notes?id=${noteId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setNotes((prev) => prev.filter((n) => n.id !== noteId));
        toast.success("Note deleted");
      } else {
        toast.error("Failed to delete note");
      }
    } catch {
      toast.error("An error occurred");
    }
  };

  // === Email Logs Modal ===
  const fetchAllEmailLogs = async (page = 1) => {
    setLoadingAllLogs(true);
    try {
      const res = await fetch(`/api/admin/email-logs?userId=${userId}&page=${page}`);
      if (res.ok) {
        const data = await res.json();
        setAllEmailLogs(data.logs);
        setEmailLogPage(data.page);
        setEmailLogPages(data.totalPages);
      }
    } catch {
      toast.error("Failed to load email logs");
    } finally {
      setLoadingAllLogs(false);
    }
  };

  const openEmailLogsModal = () => {
    setEmailLogsModalOpen(true);
    fetchAllEmailLogs(1);
  };

  // === Send Email ===
  const openSendEmail = () => {
    setSelectedEmailTemplate("none");
    setEmailSubject("");
    setEmailHtml("");
    setEmailPlainText("");
    setEmailContentType("html");
    fetch("/api/admin/email-templates")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.templates) setEmailTemplates(data.templates);
      })
      .catch(() => {});
    setSendEmailOpen(true);
  };

  const handleEmailTemplateChange = (templateId: string) => {
    setSelectedEmailTemplate(templateId);
    if (templateId === "none") return;
    const tpl = emailTemplates.find((t) => t.id === templateId);
    if (tpl) {
      setEmailSubject(tpl.subject);
      setEmailHtml(tpl.bodyHtml || "");
      setEmailPlainText(tpl.bodyText || "");
      if (!tpl.bodyHtml && tpl.bodyText) {
        setEmailContentType("plaintext");
      } else {
        setEmailContentType("html");
      }
    }
  };

  const insertEmailVariable = (variable: string) => {
    const isHtml = emailContentType === "html";
    const ref = isHtml ? emailHtmlRef : emailPlainTextRef;
    const el = ref.current;
    const current = isHtml ? emailHtml : emailPlainText;
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? start;
    const text = `{{${variable}}}`;
    const newValue = current.slice(0, start) + text + current.slice(end);
    if (isHtml) {
      setEmailHtml(newValue);
    } else {
      setEmailPlainText(newValue);
    }
    requestAnimationFrame(() => {
      if (el) {
        el.focus();
        el.selectionStart = el.selectionEnd = start + text.length;
      }
    });
  };

  const handleSendEmail = async () => {
    const activeBody = emailContentType === "html" ? emailHtml : emailPlainText;
    if (!emailSubject.trim() || !activeBody.trim()) {
      toast.error("Subject and body are required");
      return;
    }

    setSendingEmail(true);
    try {
      const tplId = selectedEmailTemplate !== "none" ? selectedEmailTemplate : undefined;
      const tplName = selectedEmailTemplate !== "none"
        ? emailTemplates.find((t) => t.id === selectedEmailTemplate)?.name
        : undefined;

      const res = await fetch("/api/admin/messenger/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user!.id,
          subject: emailSubject.trim(),
          html: activeBody.trim(),
          templateId: tplId,
          templateName: tplName,
          isPlainText: emailContentType === "plaintext",
        }),
      });

      if (res.ok) {
        toast.success("Email sent successfully");
        setSendEmailOpen(false);
        fetchUser();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to send email");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setSendingEmail(false);
    }
  };

  // === Manual Transaction ===
  const openAddTransaction = async () => {
    setSelectedProductId("");
    setSelectedPriceId("");
    setLoadingProducts(true);
    setAddTransactionOpen(true);
    try {
      const res = await fetch("/api/admin/products");
      if (res.ok) {
        const data = await res.json();
        setTransactionProducts(data.products || []);
      }
    } catch {
      toast.error("Failed to load products");
    } finally {
      setLoadingProducts(false);
    }
  };

  const getOneTimePrices = (productId: string): AdminPrice[] => {
    const product = transactionProducts.find((p) => p.id === productId);
    if (!product) return [];
    return product.prices.filter((p) => p.type === "one_time" && p.isActive);
  };

  const getSelectedPrice = (): AdminPrice | null => {
    if (!selectedProductId || !selectedPriceId) return null;
    const prices = getOneTimePrices(selectedProductId);
    return prices.find((p) => p.id === selectedPriceId) || null;
  };

  const handleAddTransaction = async () => {
    if (!selectedProductId || !selectedPriceId) {
      toast.error("Please select a product and price");
      return;
    }
    setSubmittingTransaction(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/manual-purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: selectedProductId, priceId: selectedPriceId }),
      });
      if (res.ok) {
        toast.success("Transaction added successfully");
        setAddTransactionOpen(false);
        fetchUser();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to add transaction");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setSubmittingTransaction(false);
    }
  };

  const formatDate = (date: string) =>
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(date));

  const formatDateTime = (date: string) =>
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">User not found</p>
      </div>
    );
  }

  const isCurrentUser = user.id === session?.user?.id;

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-4 -ml-2"
          onClick={() => router.push("/admin/users")}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Users
        </Button>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
          {user.profilePictureUrl ? (
            <img
              src={user.profilePictureUrl}
              alt=""
              className="w-16 h-16 rounded-full object-cover"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gray-500 flex items-center justify-center">
              <span className="text-lg font-medium text-white">
                {user.firstName[0]}{user.lastName[0]}
              </span>
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {user.firstName} {user.lastName}
              </h1>
              <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                user.role === "admin"
                  ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                  : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
              }`}>
                {user.role}
              </span>
              <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                user.status === "active"
                  ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                  : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
              }`}>
                {user.status}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <p className="text-xs text-muted-foreground mt-0.5 font-mono select-all">{user.id}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Joined {formatDate(user.createdAt)}
            </p>
            {isSuspended && (
              <p className="text-xs text-red-500 font-medium mt-1 flex items-center gap-1">
                <ShieldAlert className="h-3.5 w-3.5" />
                Suspended until {formatDate(user.suspendedUntil!)}
              </p>
            )}
          </div>
          </div>
          <Button onClick={openSendEmail}>
            <Send className="h-4 w-4 mr-2" />
            Send Email
          </Button>
        </div>
      </div>

      {/* Referral Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Referral</CardTitle>
              <CardDescription>Referral code and referrer information</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Referral Code</p>
              <p className="font-mono font-medium select-all">{user.referralCode}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Referred By</p>
              {referrer ? (
                <button
                  onClick={() => router.push(`/admin/users/${referrer.id}`)}
                  className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {referrer.firstName} {referrer.lastName}
                </button>
              ) : (
                <p className="text-muted-foreground">None</p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">People Referred</p>
              <p className="font-medium">{referralCount}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Products */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Active Products</CardTitle>
              <CardDescription>
                {activeProducts.length} active product{activeProducts.length !== 1 ? "s" : ""}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {activeProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No active products</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeProducts.map((product) => (
                <div
                  key={product.productId}
                  className="flex gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-800"
                >
                  {product.productImage ? (
                    <img
                      src={product.productImage}
                      alt=""
                      className="w-14 h-14 rounded-lg object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                      <Package className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{product.productName}</p>
                    {product.shortDescription && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {product.shortDescription}
                      </p>
                    )}
                    <span className="inline-block mt-1.5 px-2 py-0.5 text-[10px] font-medium rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                      {product.priceType === "subscription"
                        ? product.priceInterval === "year" ? "Yearly" : "Monthly"
                        : "One-time"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transactions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle>Transactions</CardTitle>
                <CardDescription>
                  {purchaseStats.count} transaction{purchaseStats.count !== 1 ? "s" : ""} &middot;{" "}
                  {new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(purchaseStats.total / 100)} total
                </CardDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={openAddTransaction}>
              <Plus className="h-4 w-4 mr-1" />
              Add Transaction
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {userPurchases.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No purchases yet</p>
          ) : (
            <div className="space-y-3">
              {userPurchases.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-800"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {p.productImage ? (
                      <img src={p.productImage} alt="" className="h-9 w-9 rounded object-cover flex-shrink-0" />
                    ) : (
                      <div className="h-9 w-9 rounded bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{p.productName || "Unknown product"}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-mono text-muted-foreground">
                          {p.stripePaymentId
                            ? p.stripePaymentId.replace("cs_test_", "").replace("cs_live_", "").slice(0, 10) + "..."
                            : p.id.slice(0, 8) + "..."}
                        </p>
                        <span className="text-xs text-muted-foreground">&middot;</span>
                        <span className="text-xs text-muted-foreground">
                          {p.priceType === "subscription"
                            ? p.priceInterval === "year" ? "Yearly" : "Monthly"
                            : "One-time"}
                        </span>
                        <span className="text-xs text-muted-foreground">&middot;</span>
                        <span className={`text-xs font-medium ${p.stripePaymentId ? "text-blue-600 dark:text-blue-400" : "text-orange-600 dark:text-orange-400"}`}>
                          {p.stripePaymentId ? "stripe" : "manual"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 ml-4">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                      {new Intl.NumberFormat("en-US", { style: "currency", currency: p.currency }).format(p.amount / 100)}
                    </span>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                      p.status === "completed"
                        ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                        : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                    }`}>
                      {p.status}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(p.createdAt)}
                    </span>
                    {p.stripePaymentId && (
                      <button
                        onClick={() => window.open(`https://dashboard.stripe.com/test/payments/${p.stripePaymentId}`, "_blank")}
                        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                        title="View in Stripe"
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {purchasePages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={purchasePage <= 1}
                    onClick={() => setPurchasePage(purchasePage - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {purchasePage} / {purchasePages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={purchasePage >= purchasePages}
                    onClick={() => setPurchasePage(purchasePage + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2x2 Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

      {/* Edit Profile */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <UserPen className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Edit Profile</CardTitle>
              <CardDescription>Update this user&apos;s information</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={editFirstName}
                onChange={(e) => setEditFirstName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={editLastName}
                onChange={(e) => setEditLastName(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="nickname">Nickname</Label>
            <Input
              id="nickname"
              value={editNickname}
              onChange={(e) => setEditNickname(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
            />
          </div>
          <Button onClick={handleSaveProfile} disabled={savingProfile}>
            {savingProfile ? "Saving..." : "Save Profile"}
          </Button>
        </CardContent>
      </Card>

      {/* Tags */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle>Tags</CardTitle>
                <CardDescription>Assign tags to this user</CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreateTagOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              New Tag
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {allTags.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No tags created yet. Create tags in the Tags page first.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3">
                {allTags.map((tag) => {
                  const selected = selectedTagIds.includes(tag.id);
                  const isLight = isLightColor(tag.color);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTagId(tag.id)}
                      className="flex flex-col items-center gap-1 transition-all"
                    >
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-opacity ${
                          selected
                            ? isLight
                              ? "text-gray-900"
                              : "text-white"
                            : isLight
                              ? "text-gray-900 opacity-40 hover:opacity-60"
                              : "text-white opacity-40 hover:opacity-60"
                        }`}
                        style={{ backgroundColor: tag.color }}
                      >
                        {selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                        {tag.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Management</CardTitle>
              <CardDescription>Role and suspension controls</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Role */}
          <div>
            <p className="text-sm font-medium mb-2">Role</p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Currently: <span className="font-medium text-foreground">{user.role}</span>
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={isCurrentUser}
                onClick={() => {
                  setPendingRole(user.role === "admin" ? "user" : "admin");
                  setRoleDialogOpen(true);
                }}
              >
                {user.role === "admin" ? "Demote to User" : "Promote to Admin"}
              </Button>
              {isCurrentUser && (
                <span className="text-xs text-muted-foreground">(Cannot change own role)</span>
              )}
            </div>
          </div>

          {/* Suspension */}
          <div>
            <p className="text-sm font-medium mb-2">Suspension</p>
            {isSuspended ? (
              <div className="space-y-2">
                <p className="text-sm text-red-500 flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4" />
                  Suspended until {formatDateTime(user.suspendedUntil!)}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSuspend(null)}
                  >
                    Unsuspend
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSuspendDialogOpen(true)}
                  >
                    Change Duration
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">User is not suspended</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSuspendDialogOpen(true)}
                >
                  Suspend User
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200 dark:border-red-900">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-500" />
            <div>
              <CardTitle className="text-red-600 dark:text-red-400">Danger Zone</CardTitle>
              <CardDescription>Irreversible actions</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Permanently delete this user and all their data. This action cannot be undone.
          </p>
          <Button
            variant="destructive"
            disabled={isCurrentUser}
            onClick={() => setDeleteDialogOpen(true)}
          >
            Delete User
          </Button>
          {isCurrentUser && (
            <p className="text-xs text-muted-foreground mt-2">(Cannot delete your own account)</p>
          )}
        </CardContent>
      </Card>

      </div>{/* end 2x2 grid */}

      {/* Email Log */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Email Log</CardTitle>
              <CardDescription>
                {emailLogCount} email{emailLogCount !== 1 ? "s" : ""} sent
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {recentEmailLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No emails sent</p>
          ) : (
            <div className="space-y-3">
              {recentEmailLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-800"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{log.subject}</p>
                    {log.templateName && (
                      <p className="text-xs text-muted-foreground">{log.templateName}</p>
                    )}
                    {log.status === "failed" && log.errorMessage && (
                      <p className="text-xs text-red-500 truncate">{log.errorMessage}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                      log.status === "sent"
                        ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                        : log.status === "failed"
                          ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                          : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                    }`}>
                      {log.status}
                    </span>
                    <button
                      onClick={() => log.templateBodyHtml && setPreviewLog(log)}
                      disabled={!log.templateBodyHtml}
                      className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed"
                      title={log.templateBodyHtml ? "Preview email" : "No preview available"}
                    >
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(log.sentAt)}
                    </span>
                  </div>
                </div>
              ))}
              {emailLogCount > 5 && (
                <div className="text-center pt-1">
                  <Button variant="outline" size="sm" onClick={openEmailLogsModal}>
                    View All ({emailLogCount})
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Admin Notes */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <StickyNote className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Admin Notes</CardTitle>
              <CardDescription>{notes.length} note{notes.length !== 1 ? "s" : ""}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add note */}
          <div className="flex gap-2">
            <Textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add a note about this user..."
              className="min-h-[80px]"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  handleAddNote();
                }
              }}
            />
          </div>
          {noteFile && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Paperclip className="h-3.5 w-3.5" />
              <span className="truncate">{noteFile.name}</span>
              <button
                onClick={() => {
                  setNoteFile(null);
                  if (noteFileRef.current) noteFileRef.current.value = "";
                }}
                className="p-0.5 rounded hover:text-red-500"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleAddNote}
              disabled={addingNote || !newNote.trim()}
            >
              {addingNote ? "Adding..." : "Add Note"}
            </Button>
            <input
              ref={noteFileRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,application/pdf,.doc,.docx,.txt"
              className="hidden"
              onChange={(e) => setNoteFile(e.target.files?.[0] || null)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => noteFileRef.current?.click()}
            >
              <Paperclip className="h-4 w-4 mr-1" />
              Attach
            </Button>
          </div>

          {/* Notes list */}
          {notes.length > 0 && (
            <div className="space-y-3 pt-2 border-t">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="flex justify-between items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                    {note.attachmentUrl && (
                      <div className="mt-2">
                        {note.attachmentUrl.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                          <a href={note.attachmentUrl} target="_blank" rel="noopener noreferrer">
                            <img
                              src={note.attachmentUrl}
                              alt={note.attachmentName || "Attachment"}
                              className="max-w-xs max-h-48 rounded border object-cover"
                            />
                          </a>
                        ) : (
                          <a
                            href={note.attachmentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            <Paperclip className="h-3.5 w-3.5" />
                            {note.attachmentName || "Attachment"}
                          </a>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {note.authorName} &middot; {formatDateTime(note.createdAt)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteNote(note.id)}
                    className="p-1 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 shrink-0"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Role Change Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Role</DialogTitle>
            <DialogDescription>
              Change <span className="font-medium">{user.firstName} {user.lastName}</span> from{" "}
              <span className="font-medium">{user.role}</span> to{" "}
              <span className="font-medium">{pendingRole}</span>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRoleChange}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend Dialog */}
      <Dialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend User</DialogTitle>
            <DialogDescription>
              Choose how long to suspend <span className="font-medium">{user.firstName} {user.lastName}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => suspendFor(1)}>
                1 Day
              </Button>
              <Button variant="outline" onClick={() => suspendFor(7)}>
                7 Days
              </Button>
              <Button variant="outline" onClick={() => suspendFor(30)}>
                30 Days
              </Button>
              <Button variant="outline" onClick={suspendPermanently}>
                Permanent
              </Button>
            </div>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">or custom date</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Input
                type="datetime-local"
                value={customSuspendDate}
                onChange={(e) => setCustomSuspendDate(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
              />
              <Button
                disabled={!customSuspendDate}
                onClick={() => {
                  if (customSuspendDate) {
                    handleSuspend(new Date(customSuspendDate));
                  }
                }}
              >
                Suspend
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete{" "}
              <span className="font-medium">{user.firstName} {user.lastName}</span> ({user.email})?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteUser}>
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Tag Dialog */}
      <Dialog open={createTagOpen} onOpenChange={setCreateTagOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create Tag</DialogTitle>
            <DialogDescription>Create a new tag to use across users.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tagName">Name</Label>
              <Input
                id="tagName"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="e.g. VIP, Premium, New"
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="grid grid-cols-8 gap-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${
                      newTagColor === color
                        ? "border-gray-900 dark:border-white scale-110"
                        : "border-transparent hover:scale-105"
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewTagColor(color)}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="color"
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                />
                <Input
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  placeholder="#000000"
                  className="flex-1 font-mono text-sm"
                  maxLength={7}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateTagOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTag} disabled={creatingTag || !newTagName.trim()}>
              {creatingTag ? "Creating..." : "Create Tag"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Logs Modal */}
      <Dialog open={emailLogsModalOpen} onOpenChange={setEmailLogsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email History</DialogTitle>
            <DialogDescription>
              All emails sent to {user.firstName} {user.lastName}
            </DialogDescription>
          </DialogHeader>
          {loadingAllLogs ? (
            <p className="text-sm text-muted-foreground text-center py-6">Loading...</p>
          ) : allEmailLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No emails found</p>
          ) : (
            <div className="space-y-3">
              {allEmailLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-800"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{log.subject}</p>
                    {log.templateName && (
                      <p className="text-xs text-muted-foreground">{log.templateName}</p>
                    )}
                    {log.status === "failed" && log.errorMessage && (
                      <p className="text-xs text-red-500 truncate">{log.errorMessage}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                      log.status === "sent"
                        ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                        : log.status === "failed"
                          ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                          : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                    }`}>
                      {log.status}
                    </span>
                    <button
                      onClick={() => log.templateBodyHtml && setPreviewLog(log)}
                      disabled={!log.templateBodyHtml}
                      className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed"
                      title={log.templateBodyHtml ? "Preview email" : "No preview available"}
                    >
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(log.sentAt)}
                    </span>
                  </div>
                </div>
              ))}
              {emailLogPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={emailLogPage <= 1}
                    onClick={() => fetchAllEmailLogs(emailLogPage - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {emailLogPage} / {emailLogPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={emailLogPage >= emailLogPages}
                    onClick={() => fetchAllEmailLogs(emailLogPage + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Email Preview Dialog */}
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
        </DialogContent>
      </Dialog>

      {/* Send Email Modal */}
      <Dialog open={sendEmailOpen} onOpenChange={(open) => !sendingEmail && setSendEmailOpen(open)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Send Email</DialogTitle>
            <DialogDescription>
              Sending to {user.firstName} {user.lastName} ({user.email})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Template */}
            <div className="space-y-2">
              <Label>Template (optional)</Label>
              <Select value={selectedEmailTemplate} onValueChange={handleEmailTemplateChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No template</SelectItem>
                  {emailTemplates.map((tpl) => (
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
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Email subject..."
              />
            </div>

            {/* Body */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Label>{emailContentType === "html" ? "HTML Body" : "Plain Text Body"}</Label>
                  <div className="flex rounded-md border border-input overflow-hidden">
                    <button
                      type="button"
                      className={`px-3 py-1 text-xs font-medium transition-colors ${
                        emailContentType === "html"
                          ? "bg-primary text-primary-foreground"
                          : "bg-background hover:bg-muted"
                      }`}
                      onClick={() => setEmailContentType("html")}
                    >
                      HTML
                    </button>
                    <button
                      type="button"
                      className={`px-3 py-1 text-xs font-medium transition-colors ${
                        emailContentType === "plaintext"
                          ? "bg-primary text-primary-foreground"
                          : "bg-background hover:bg-muted"
                      }`}
                      onClick={() => setEmailContentType("plaintext")}
                    >
                      Plain Text
                    </button>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setEmailPreviewOpen(true)}
                  disabled={!(emailContentType === "html" ? emailHtml : emailPlainText).trim()}
                >
                  <Eye className="h-3.5 w-3.5 mr-1" />
                  Preview
                </Button>
              </div>
              <div className="relative" ref={emailVarsRef}>
                <button
                  type="button"
                  onClick={() => setEmailVarsOpen(!emailVarsOpen)}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md border border-input bg-background hover:bg-muted transition-colors text-muted-foreground"
                  title="Insert variable"
                >
                  <span className="font-mono text-[11px]">{`{ }`}</span>
                </button>
                {emailVarsOpen && (
                  <div className="absolute z-50 mt-1 w-44 rounded-md border bg-background shadow-md">
                    {EMAIL_VARIABLES.map((v) => (
                      <button
                        key={v.variable}
                        type="button"
                        onClick={() => {
                          insertEmailVariable(v.variable);
                          setEmailVarsOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent cursor-pointer"
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {emailContentType === "html" ? (
                <Textarea
                  ref={emailHtmlRef}
                  value={emailHtml}
                  onChange={(e) => setEmailHtml(e.target.value)}
                  placeholder="<h1>Hello!</h1><p>Your email content here...</p>"
                  className="font-mono text-sm min-h-[200px]"
                />
              ) : (
                <Textarea
                  ref={emailPlainTextRef}
                  value={emailPlainText}
                  onChange={(e) => setEmailPlainText(e.target.value)}
                  placeholder="Hello! Your email content here..."
                  className="text-sm min-h-[200px]"
                />
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSendEmailOpen(false)}
              disabled={sendingEmail}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendEmail}
              disabled={sendingEmail || !emailSubject.trim() || !(emailContentType === "html" ? emailHtml : emailPlainText).trim()}
            >
              {sendingEmail ? "Sending..." : "Send Email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Email Preview Modal */}
      <Dialog open={emailPreviewOpen} onOpenChange={setEmailPreviewOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
            <DialogDescription>Subject: {emailSubject || "(no subject)"}</DialogDescription>
          </DialogHeader>
          {emailContentType === "html" ? (
            <iframe
              sandbox=""
              srcDoc={emailHtml}
              className="border rounded-lg w-full min-h-[300px] bg-white"
              title="Email Preview"
            />
          ) : (
            <pre className="rounded-lg border p-4 bg-white dark:bg-gray-900 text-sm whitespace-pre-wrap font-sans min-h-[300px]">
              {emailPlainText}
            </pre>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailPreviewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Transaction Modal */}
      <Dialog open={addTransactionOpen} onOpenChange={(open) => !submittingTransaction && setAddTransactionOpen(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Transaction</DialogTitle>
            <DialogDescription>
              Manually add a purchase for {user.firstName} {user.lastName}
            </DialogDescription>
          </DialogHeader>

          {loadingProducts ? (
            <p className="text-sm text-muted-foreground text-center py-6">Loading products...</p>
          ) : (
            <div className="space-y-4">
              {/* Product */}
              <div className="space-y-2">
                <Label>Product</Label>
                <Select
                  value={selectedProductId}
                  onValueChange={(val) => {
                    setSelectedProductId(val);
                    setSelectedPriceId("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a product..." />
                  </SelectTrigger>
                  <SelectContent>
                    {transactionProducts.map((p) => {
                      const hasOneTime = p.prices.some((pr) => pr.type === "one_time" && pr.isActive);
                      return (
                        <SelectItem key={p.id} value={p.id} disabled={!hasOneTime}>
                          {p.name}{!hasOneTime ? " (no one-time prices)" : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Price */}
              {selectedProductId && (
                <div className="space-y-2">
                  <Label>Price</Label>
                  {getOneTimePrices(selectedProductId).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No one-time prices available for this product</p>
                  ) : (
                    <Select value={selectedPriceId} onValueChange={setSelectedPriceId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a price..." />
                      </SelectTrigger>
                      <SelectContent>
                        {getOneTimePrices(selectedProductId).map((price) => (
                          <SelectItem key={price.id} value={price.id}>
                            {new Intl.NumberFormat("en-US", {
                              style: "currency",
                              currency: price.currency || "USD",
                            }).format(price.amount / 100)}
                            {price.isDefault ? " (default)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {/* Amount display */}
              {getSelectedPrice() && (
                <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-3 bg-gray-50 dark:bg-gray-800/50">
                  <p className="text-xs text-muted-foreground">Amount</p>
                  <p className="text-lg font-semibold">
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: getSelectedPrice()!.currency || "USD",
                    }).format(getSelectedPrice()!.amount / 100)}
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddTransactionOpen(false)}
              disabled={submittingTransaction}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddTransaction}
              disabled={submittingTransaction || !selectedProductId || !selectedPriceId}
            >
              {submittingTransaction ? "Adding..." : "Add Transaction"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
