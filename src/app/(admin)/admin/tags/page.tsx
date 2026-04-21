"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tag, Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

interface TagItem {
  id: string;
  name: string;
  color: string;
  createdAt: string;
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
  // Perceived brightness formula
  return (r * 299 + g * 587 + b * 114) / 1000 > 180;
}

export default function TagsPage() {
  const router = useRouter();
  const [tags, setTags] = useState<TagItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TagItem | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3B82F6");
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<TagItem | null>(null);

  const fetchTags = async () => {
    try {
      const res = await fetch("/api/admin/tags");
      if (res.status === 401) {
        router.replace("/dashboard");
        return;
      }
      if (res.ok) {
        const data = await res.json();
        if (data?.tags) {
          setTags(data.tags);
        }
      }
    } catch (error) {
      console.error("Failed to fetch tags:", error);
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    fetchTags();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => {
    setEditing(null);
    setName("");
    setColor("#3B82F6");
    setDialogOpen(true);
  };

  const openEdit = (tag: TagItem) => {
    setEditing(tag);
    setName(tag.name);
    setColor(tag.color);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Tag name is required");
      return;
    }

    setSaving(true);
    try {
      const url = editing ? "/api/admin/tags" : "/api/admin/tags";
      const method = editing ? "PATCH" : "POST";
      const body = editing
        ? { id: editing.id, name: name.trim(), color }
        : { name: name.trim(), color };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast.success(editing ? "Tag updated" : "Tag created");
        setDialogOpen(false);
        setEditing(null);
        setName("");
        setColor("#3B82F6");
        fetchTags();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to save tag");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!tagToDelete) return;

    try {
      const res = await fetch(`/api/admin/tags?id=${tagToDelete.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Tag deleted");
        setDeleteDialogOpen(false);
        setTagToDelete(null);
        fetchTags();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to delete tag");
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tags</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Manage tags for organizing content ({tags.length} total)
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          New Tag
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>All Tags</CardTitle>
              <CardDescription>{tags.length} tag{tags.length !== 1 ? "s" : ""}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {tags.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No tags yet. Create your first one.
            </p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {tags.map((tag) => {
                const isLight = isLightColor(tag.color);
                return (
                  <div
                    key={tag.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                      isLight ? "text-gray-900 border-gray-300" : "text-white border-transparent"
                    }`}
                    style={{ backgroundColor: tag.color }}
                  >
                    <span className="text-sm font-medium">{tag.name}</span>
                    <button
                      onClick={() => openEdit(tag)}
                      className={`p-0.5 rounded ${
                        isLight
                          ? "text-gray-500 hover:text-gray-900 hover:bg-black/10"
                          : "text-white/70 hover:text-white hover:bg-black/20"
                      }`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setTagToDelete(tag);
                        setDeleteDialogOpen(true);
                      }}
                      className={`p-0.5 rounded ${
                        isLight
                          ? "text-gray-500 hover:text-gray-900 hover:bg-black/10"
                          : "text-white/70 hover:text-white hover:bg-black/20"
                      }`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) {
          setEditing(null);
          setName("");
          setColor("#3B82F6");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Tag" : "Create Tag"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update the tag name or color" : "Add a new tag with a name and color"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tagName">Name</Label>
              <Input
                id="tagName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Featured, New, Sale"
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-md border-2 transition-all ${
                      color === c
                        ? "border-gray-900 dark:border-white scale-110"
                        : "border-transparent hover:scale-105"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                />
                <Input
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="#3B82F6"
                  className="w-28 font-mono text-sm"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editing ? "Update Tag" : "Create Tag"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => {
        setDeleteDialogOpen(open);
        if (!open) setTagToDelete(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Tag</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the tag{" "}
              <span className="font-medium">&quot;{tagToDelete?.name}&quot;</span>?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setDeleteDialogOpen(false);
              setTagToDelete(null);
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
