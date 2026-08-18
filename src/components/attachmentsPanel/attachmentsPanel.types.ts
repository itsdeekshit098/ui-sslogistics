export type AttachmentOwnerType = "vehicle" | "client_entry" | "loan";

/** One row from the `attachments` table (sql/38_add_attachments.sql, extended
 * with loan_id by sql/44_add_loan_attachments.sql). */
export interface Attachment {
  id: number;
  vehicle_id: number | null;
  client_entry_id: number | null;
  loan_id: number | null;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  caption: string | null;
  created_at: string;
}

export interface AttachmentsPanelProps {
  ownerType: AttachmentOwnerType;
  ownerId: number;
  canManage: boolean;
  /** `<input accept>` value, e.g. "image/*" or "image/*,application/pdf". */
  accept: string;
  /** Thumbnail grid for photos, filename rows for documents. */
  layout: "grid" | "list";
}

export function isImageMime(mime: string): boolean {
  return mime.startsWith("image/");
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
