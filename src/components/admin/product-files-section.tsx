"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileDown, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface AttachedFile {
  id: string; // productFiles row id
  fileId: string;
  name: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  attachedAt: string;
  deletedAt: string | null;
}

interface FileLibraryRow {
  id: string;
  name: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function ProductFilesSection({ productId }: { productId: string }) {
  const [attached, setAttached] = useState<AttachedFile[]>([]);
  const [library, setLibrary] = useState<FileLibraryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function loadAll() {
    try {
      const [attachedRes, libRes] = await Promise.all([
        fetch(`/api/admin/products/${productId}/files`),
        fetch(`/api/admin/files`),
      ]);
      const attachedData = await attachedRes.json();
      const libData = await libRes.json();
      if (!attachedRes.ok) throw new Error(attachedData.error || "Failed to load attached files");
      if (!libRes.ok) throw new Error(libData.error || "Failed to load file library");
      setAttached(attachedData.files);
      setLibrary(libData.files);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load files");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const attachedIds = new Set(attached.map((a) => a.fileId));
  const available = library.filter((f) => !attachedIds.has(f.id));

  async function handleAttach() {
    if (!picked) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/products/${productId}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: picked }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Attach failed");
      const backfilled = (data.backfilled as number | undefined) ?? 0;
      toast.success(
        backfilled > 0
          ? `File attached. Sent download link to ${backfilled} past buyer${backfilled === 1 ? "" : "s"}.`
          : "File attached"
      );
      setPicked("");
      await loadAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Attach failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDetach(fileId: string) {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/products/${productId}/files?fileId=${encodeURIComponent(fileId)}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Detach failed");
      toast.success("File detached");
      await loadAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Detach failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Files</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Buyers automatically receive download links for any files attached
              here. Each link expires after 3 downloads.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <Select value={picked} onValueChange={setPicked} disabled={available.length === 0 || busy}>
            <SelectTrigger className="flex-1">
              <SelectValue
                placeholder={
                  available.length === 0
                    ? "All library files are already attached"
                    : "Pick a file from the library…"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {available.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name} ({formatBytes(f.fileSize)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleAttach} disabled={!picked || busy}>
            <Plus className="w-4 h-4 mr-2" />
            Attach
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : attached.length === 0 ? (
          <div className="py-8 text-center">
            <FileDown className="w-8 h-8 mx-auto text-muted-foreground mb-2" strokeWidth={1.5} />
            <p className="text-muted-foreground text-sm">
              No files attached. Upload one in the{" "}
              <a href="/admin/files" className="underline">
                Files area
              </a>{" "}
              first, then attach it here.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {attached.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileDown className="w-4 h-4 text-pink-500 shrink-0" strokeWidth={1.5} />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{f.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {f.fileName} · {formatBytes(f.fileSize)}
                      {f.deletedAt && " · deleted (existing links still work)"}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => handleDetach(f.fileId)}
                  disabled={busy}
                  aria-label="Detach file"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
