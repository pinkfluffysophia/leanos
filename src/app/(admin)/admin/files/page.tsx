"use client";

import { useEffect, useRef, useState } from "react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, FileDown, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

interface FileRow {
  id: string;
  name: string;
  fileName: string;
  blobUrl: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
  productCount: number;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export default function AdminFilesPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<FileRow | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/admin/files");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load files");
      setFiles(data.files);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load files");
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function resetDialog() {
    setName("");
    setPicked(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleUpload() {
    if (!picked) {
      toast.error("Pick a file first");
      return;
    }
    if (picked.size > 100 * 1024 * 1024) {
      toast.error("File exceeds 100MB limit");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", picked);
      formData.append("name", name);
      const res = await fetch("/api/admin/files/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      toast.success("File uploaded");
      setDialogOpen(false);
      resetDialog();
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(file: FileRow) {
    try {
      const res = await fetch(`/api/admin/files/${file.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Delete failed");
      toast.success("File deleted");
      setConfirmDelete(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <div className="p-6 sm:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-light text-slate-800 dark:text-slate-100">
            Files
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Upload digital goods and attach them to products from each
            product&apos;s detail page.
          </p>
        </div>
        <Button
          onClick={() => setDialogOpen(true)}
          className="bg-gradient-to-r from-pink-400 to-rose-400 hover:from-pink-500 hover:to-rose-500 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Upload File
        </Button>
      </div>

      {!loaded ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : files.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileDown className="w-10 h-10 mx-auto text-pink-300 mb-3" strokeWidth={1.5} />
            <p className="text-sm text-slate-500">
              No files uploaded yet. Click &ldquo;Upload File&rdquo; to add the first
              one.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {files.map((f) => (
            <Card key={f.id}>
              <CardContent className="flex items-center justify-between gap-4 py-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-pink-100 dark:bg-pink-300/10 flex items-center justify-center shrink-0">
                    <FileDown className="w-5 h-5 text-pink-500 dark:text-pink-200" strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-slate-800 dark:text-slate-100 truncate">
                      {f.name}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {f.fileName} · {formatBytes(f.fileSize)} · {f.mimeType}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {f.productCount} product{f.productCount === 1 ? "" : "s"}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setConfirmDelete(f)}
                    aria-label="Delete file"
                  >
                    <Trash2 className="w-4 h-4 text-rose-500" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload File</DialogTitle>
            <DialogDescription>
              Files up to 100MB. Use any format buyers should be able to
              download.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="file-display-name">Display name</Label>
              <Input
                id="file-display-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Course handbook PDF"
              />
              <p className="text-xs text-slate-500 mt-1">
                Optional. Defaults to the original filename.
              </p>
            </div>
            <div>
              <Label>File</Label>
              <Input
                ref={fileInputRef}
                type="file"
                onChange={(e) => setPicked(e.target.files?.[0] || null)}
              />
              {picked && (
                <p className="text-xs text-slate-500 mt-1">
                  {picked.name} · {formatBytes(picked.size)}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!picked || uploading}
              className="bg-gradient-to-r from-pink-400 to-rose-400 hover:from-pink-500 hover:to-rose-500 text-white"
            >
              <Upload className="w-4 h-4 mr-2" />
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this file?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.productCount
                ? `This file is attached to ${confirmDelete.productCount} product${confirmDelete.productCount === 1 ? "" : "s"}. New purchases will no longer include it. Existing buyers can still use their download links until they expire.`
                : "Existing download links keep working until they expire. The file will be hidden from this list."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
              className="bg-rose-500 hover:bg-rose-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
