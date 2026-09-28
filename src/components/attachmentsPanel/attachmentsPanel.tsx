"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/loadingSpinner";
import { ConfirmModal } from "@/components/confirmModal";
import { EmptyState } from "@/components/emptyState";
import { Modal, ModalContent } from "@/components/ui/modal";
import {
  UploadCloudIcon,
  EyeIcon,
  DownloadIcon,
  Trash2Icon,
  FileTextIcon,
  CheckIcon,
  XIcon,
} from "@/components/ui/icon";
import {
  formatFileSize,
  isImageMime,
  type Attachment,
  type AttachmentsPanelProps,
} from "./attachmentsPanel.types";

const VIEW_URL = (id: number, download = false) =>
  `/api/attachments/view?id=${id}${download ? "&download=true" : ""}`;

const ICON_ACTION_CLASS =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border bg-background/90 text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function AttachmentsPanel({
  ownerType,
  ownerId,
  canManage,
  accept,
  layout,
}: AttachmentsPanelProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Attachment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [preview, setPreview] = useState<Attachment | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState(false);
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [zipping, setZipping] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/attachments?owner_type=${ownerType}&owner_id=${ownerId}`,
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load attachments");
      setAttachments(json.data?.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load attachments");
    } finally {
      setLoading(false);
    }
  }, [ownerType, ownerId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPreviewLoading(true);
    setPreviewError(false);
  }, [preview?.id]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`"${file.name}" exceeds the 10 MB limit`);
        }
        const formData = new FormData();
        formData.append("file", file);
        formData.append("owner_type", ownerType);
        formData.append("owner_id", String(ownerId));

        const res = await fetch("/api/attachments", { method: "POST", body: formData });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `Failed to upload "${file.name}"`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelected = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) =>
      prev.size === attachments.length ? new Set() : new Set(attachments.map((a) => a.id)),
    );
  };

  const handleDownloadSelected = async () => {
    const selected = attachments.filter((a) => selectedIds.has(a.id));
    if (selected.length === 0) return;
    setZipping(true);
    setError(null);
    try {
      const zip = new JSZip();
      const usedNames = new Set<string>();
      for (const a of selected) {
        const res = await fetch(VIEW_URL(a.id, true));
        if (!res.ok) throw new Error(`Failed to download "${a.file_name}"`);
        const blob = await res.blob();
        let name = a.file_name || `attachment-${a.id}`;
        if (usedNames.has(name)) {
          const dot = name.lastIndexOf(".");
          name = dot > 0 ? `${name.slice(0, dot)} (${a.id})${name.slice(dot)}` : `${name} (${a.id})`;
        }
        usedNames.add(name);
        zip.file(name, blob);
      }
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${ownerType}-${ownerId}-photos.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      exitSelectMode();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setZipping(false);
    }
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/attachments?id=${deleteTarget.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Delete failed");
      setAttachments((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {(canManage || (layout === "grid" && attachments.length > 0)) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {canManage && (
            <div
              className={
                layout === "grid" && attachments.length === 0 && !loading ? "hidden" : undefined
              }
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={accept}
                multiple
                className="hidden"
                onChange={handleUpload}
                disabled={uploading}
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <LoadingSpinner size="sm" className="mr-2" />
                ) : (
                  <UploadCloudIcon size={16} style={{ marginRight: "0.5rem" }} />
                )}
                {uploading ? "Uploading…" : "Upload"}
              </Button>
            </div>
          )}

          {layout === "grid" && attachments.length > 0 && !loading && (
            <div className="flex flex-wrap items-center gap-2">
              {selectMode ? (
                <>
                  <span className="text-sm text-muted-foreground">
                    {selectedIds.size} selected
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleSelectAll}
                    disabled={zipping}
                  >
                    {selectedIds.size === attachments.length ? "Deselect all" : "Select all"}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleDownloadSelected}
                    disabled={selectedIds.size === 0 || zipping}
                  >
                    {zipping ? (
                      <LoadingSpinner size="sm" className="mr-2" />
                    ) : (
                      <DownloadIcon size={14} style={{ marginRight: "0.375rem" }} />
                    )}
                    {zipping ? "Zipping…" : `Download${selectedIds.size ? ` (${selectedIds.size})` : ""}`}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exitSelectMode}
                    disabled={zipping}
                  >
                    <XIcon size={14} style={{ marginRight: "0.375rem" }} />
                    Cancel
                  </Button>
                </>
              ) : (
                <Button variant="outline" onClick={() => setSelectMode(true)}>
                  Select
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner size="md" />
        </div>
      ) : attachments.length === 0 ? (
        <EmptyState
          icon={layout === "grid" ? UploadCloudIcon : FileTextIcon}
          title={layout === "grid" ? "Add your first photo" : "Nothing uploaded yet"}
          description={
            layout === "grid"
              ? canManage
                ? "Upload JPG, PNG, or WebP images up to 10 MB each."
                : "No photos have been added for this vehicle."
              : canManage
                ? "Upload a file to attach it here."
                : "Nothing has been attached yet."
          }
          actionLabel={layout === "grid" && canManage ? "Choose photos" : undefined}
          onAction={layout === "grid" && canManage ? () => fileInputRef.current?.click() : undefined}
          actionDisabled={uploading}
          className={
            layout === "grid"
              ? "min-h-64 rounded-md border border-dashed border-border bg-muted/20 px-6 py-10"
              : undefined
          }
        />
      ) : layout === "grid" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {attachments.map((a) => {
            const isSelected = selectedIds.has(a.id);
            return (
            <div
              key={a.id}
              className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-muted"
            >
              {isImageMime(a.mime_type) && !failedImages.has(a.id) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={VIEW_URL(a.id)}
                  alt=""
                  className="h-full w-full cursor-pointer object-cover"
                  onClick={() => (selectMode ? toggleSelected(a.id) : setPreview(a))}
                  onError={() => {
                    setFailedImages((current) => new Set(current).add(a.id));
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="flex h-full w-full min-w-0 flex-col items-center justify-center gap-2 px-3 text-muted-foreground"
                  onClick={() => (selectMode ? toggleSelected(a.id) : setPreview(a))}
                >
                  <FileTextIcon size={28} />
                  <span className="block w-full truncate text-center text-xs">{a.file_name}</span>
                </button>
              )}
              {selectMode && (
                <button
                  type="button"
                  aria-label={isSelected ? "Deselect" : "Select"}
                  onClick={() => toggleSelected(a.id)}
                  className={`absolute inset-0 ${isSelected ? "bg-primary/20" : ""}`}
                >
                  <span
                    className={`absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border-2 shadow-sm ${
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-white bg-black/30"
                    }`}
                  >
                    {isSelected && <CheckIcon size={14} />}
                  </span>
                </button>
              )}
              <div
                className={`absolute inset-x-0 bottom-0 flex justify-end gap-1.5 bg-gradient-to-t from-black/65 via-black/20 to-transparent p-2 pt-8 transition-opacity ${
                  selectMode
                    ? "pointer-events-none opacity-0"
                    : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                }`}
              >
                <a
                  href={VIEW_URL(a.id, true)}
                  download={a.file_name}
                  className={ICON_ACTION_CLASS}
                  aria-label="Download"
                  title="Download"
                >
                  <DownloadIcon size={16} />
                </a>
                {canManage && (
                  <button
                    type="button"
                    className={`${ICON_ACTION_CLASS} text-destructive hover:bg-destructive/10`}
                    aria-label="Delete"
                    title="Delete"
                    onClick={() => setDeleteTarget(a)}
                  >
                    <Trash2Icon size={16} />
                  </button>
                )}
              </div>
            </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border">
          {attachments.map((a) => (
            <div key={a.id} className="flex items-center gap-3 p-3">
              <FileTextIcon size={18} className="shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{a.file_name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(a.size_bytes)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  className={ICON_ACTION_CLASS}
                  onClick={() => setPreview(a)}
                  aria-label="View"
                  title="View"
                >
                  <EyeIcon size={16} />
                </button>
                <a
                  href={VIEW_URL(a.id, true)}
                  download={a.file_name}
                  className={ICON_ACTION_CLASS}
                  aria-label="Download"
                  title="Download"
                >
                  <DownloadIcon size={16} />
                </a>
                {canManage && (
                  <button
                    type="button"
                    className={`${ICON_ACTION_CLASS} text-destructive hover:bg-destructive/10`}
                    onClick={() => setDeleteTarget(a)}
                    aria-label="Delete"
                    title="Delete"
                  >
                    <Trash2Icon size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        onConfirm={executeDelete}
        title="Delete Attachment"
        description={`Remove "${deleteTarget?.file_name}"? This cannot be undone.`}
        confirmText="Delete"
        isLoading={deleting}
      />

      {preview && (
        <Modal open={!!preview} onOpenChange={(open) => !open && setPreview(null)} nested>
          <ModalContent style={{ maxWidth: "48rem", padding: 0 }}>
            <div className="flex min-w-0 items-center gap-3 border-b border-border p-3 pr-14">
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {preview.file_name}
              </span>
              <a
                href={VIEW_URL(preview.id, true)}
                download={preview.file_name}
                className="shrink-0"
              >
                <Button variant="outline" size="sm" className="h-8">
                  <DownloadIcon size={14} style={{ marginRight: "0.375rem" }} />
                  <span className="hidden sm:inline">Download</span>
                </Button>
              </a>
            </div>
            <div className="relative flex h-[min(70vh,36rem)] min-h-72 items-center justify-center overflow-auto bg-muted/60 p-4">
              {previewLoading && !previewError && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted/60">
                  <LoadingSpinner size="md" centered label="Loading preview" />
                </div>
              )}
              {previewError && (
                <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
                  <p>Failed to load the file.</p>
                </div>
              )}
              {isImageMime(preview.mime_type) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={VIEW_URL(preview.id)}
                  alt=""
                  className="max-h-full max-w-full object-contain"
                  style={{ display: previewLoading ? "none" : "block" }}
                  onLoad={() => setPreviewLoading(false)}
                  onError={() => {
                    setPreviewLoading(false);
                    setPreviewError(true);
                  }}
                />
              ) : (
                <iframe
                  src={VIEW_URL(preview.id)}
                  title={preview.file_name}
                  className="h-[70vh] w-full"
                  style={{ display: previewLoading ? "none" : "block" }}
                  onLoad={() => setPreviewLoading(false)}
                  onError={() => {
                    setPreviewLoading(false);
                    setPreviewError(true);
                  }}
                />
              )}
            </div>
          </ModalContent>
        </Modal>
      )}
    </div>
  );
}

export default AttachmentsPanel;
