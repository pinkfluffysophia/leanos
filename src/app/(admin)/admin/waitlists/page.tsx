"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreVertical, Pencil, Trash2, Users, ClipboardList, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface Waitlist {
  id: string;
  title: string;
  description: string | null;
  shortcode: string;
  status: string;
  memberCount: number;
  createdAt: string;
}

export default function WaitlistsPage() {
  const router = useRouter();
  const [waitlists, setWaitlists] = useState<Waitlist[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Waitlist | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [shortcode, setShortcode] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [waitlistToDelete, setWaitlistToDelete] = useState<Waitlist | null>(null);

  const fetchWaitlists = async () => {
    try {
      const res = await fetch("/api/admin/waitlists");
      if (res.status === 401) {
        router.replace("/dashboard");
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setWaitlists(data.waitlists || []);
      }
    } catch {
      console.error("Failed to fetch waitlists");
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    fetchWaitlists();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => {
    setEditing(null);
    setTitle("");
    setDescription("");
    setShortcode("");
    setIsActive(true);
    setDialogOpen(true);
  };

  const openEdit = (wl: Waitlist) => {
    setEditing(wl);
    setTitle(wl.title);
    setDescription(wl.description || "");
    setShortcode(wl.shortcode);
    setIsActive(wl.status === "active");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    setSaving(true);
    try {
      const url = editing
        ? `/api/admin/waitlists/${editing.id}`
        : "/api/admin/waitlists";
      const method = editing ? "PATCH" : "POST";
      const body = {
        title: title.trim(),
        description: description.trim() || null,
        shortcode: shortcode.trim() || undefined,
        status: isActive ? "active" : "inactive",
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast.success(editing ? "Waitlist updated" : "Waitlist created");
        setDialogOpen(false);
        fetchWaitlists();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to save");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!waitlistToDelete) return;

    try {
      const res = await fetch(`/api/admin/waitlists/${waitlistToDelete.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Waitlist deleted");
        setDeleteDialogOpen(false);
        setWaitlistToDelete(null);
        fetchWaitlists();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to delete");
      }
    } catch {
      toast.error("An error occurred");
    }
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Waitlists</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Manage waitlists and their members ({waitlists.length} total)
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Create Waitlist
        </Button>
      </div>

      {waitlists.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">No waitlists yet. Create your first one.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {waitlists.map((wl) => (
            <Card
              key={wl.id}
              className="cursor-pointer hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
              onClick={() => router.push(`/admin/waitlists/${wl.id}`)}
            >
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">
                      {wl.title}
                    </h3>
                    <Badge className={wl.status === "active" ? "bg-green-600 text-white" : "bg-red-600 text-white"}>
                      {wl.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <ExternalLink className="h-3.5 w-3.5" />
                      /waitlist/{wl.shortcode}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {wl.memberCount} member{wl.memberCount !== 1 ? "s" : ""}
                    </span>
                    <span className="hidden sm:inline">
                      Created {new Date(wl.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(`/waitlist/${wl.shortcode}`, "_blank");
                  }}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(wl);
                      }}
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-red-600 dark:text-red-400"
                      onClick={(e) => {
                        e.stopPropagation();
                        setWaitlistToDelete(wl);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Waitlist" : "Create Waitlist"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update the waitlist details" : "Set up a new waitlist with a public signup page"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="wlTitle">Title *</Label>
              <Input
                id="wlTitle"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Early Access"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wlDesc">Description</Label>
              <Textarea
                id="wlDesc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description shown on the signup page"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wlShortcode">Shortcode (URL)</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">/waitlist/</span>
                <Input
                  id="wlShortcode"
                  value={shortcode}
                  onChange={(e) => setShortcode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                  placeholder="auto-generated from title"
                />
              </div>
              <p className="text-xs text-muted-foreground">Only lowercase letters, numbers, and hyphens</p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Status</Label>
                <p className="text-sm text-muted-foreground">
                  {isActive ? "Signup page is accessible" : "Signup page returns 404"}
                </p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
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

      {/* Delete Confirmation */}
      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setWaitlistToDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Waitlist</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium">&quot;{waitlistToDelete?.title}&quot;</span>?
              This will also delete all members. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
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
