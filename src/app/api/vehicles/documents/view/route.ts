import { logger } from "@/lib/logger";
import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/apiResponse";

const BUCKET_NAME = "vehicle-documents";

/** Maximum file size (in bytes) that we'll stream inline for preview. Above this, force download. */
const INLINE_PREVIEW_LIMIT = 10 * 1024 * 1024; // 10 MB

/** Map common file extensions to MIME types. */
function getMimeType(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}

/**
 * Sanitize a filename for use in Content-Disposition headers.
 * Strips control characters, quotes, backslashes, and non-ASCII to prevent
 * header injection vulnerabilities.
 */
function sanitizeFileName(raw: string): string {
  // Remove control chars (0x00-0x1F, 0x7F), quotes, backslashes
  const cleaned = raw.replace(/[\x00-\x1f\x7f"\\]/g, "");
  // Fallback if the result is empty or only whitespace
  return cleaned.trim() || "document";
}

/**
 * GET — Proxy a private Supabase Storage file through our own domain.
 *
 * The browser never sees the Supabase URL — it only sees:
 *   /api/vehicles/documents/view?filePath=AP39UQ5739/rc_url.pdf
 *
 * Query params:
 *   - filePath (required): The storage object path
 *   - download (optional): If "true", forces Content-Disposition: attachment
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdminAuth();

    const filePath = req.nextUrl.searchParams.get("filePath");
    if (!filePath) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing filePath" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Validate the filePath looks reasonable (folder/filename.ext)
    // Prevent path traversal attacks
    if (filePath.includes("..") || filePath.startsWith("/")) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid filePath" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const forceDownload = req.nextUrl.searchParams.get("download") === "true";

    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .download(filePath);

    if (error || !data) {
      logger.error("Failed to download document from storage", {
        filePath,
        message: error?.message,
      });
      return new Response(
        JSON.stringify({ success: false, error: "Document not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    const mimeType = getMimeType(filePath);
    const fileName = sanitizeFileName(filePath.split("/").pop() || "document");
    const fileSize = data.size;

    // For very large files, force download instead of inline preview
    const disposition =
      forceDownload || fileSize > INLINE_PREVIEW_LIMIT
        ? `attachment; filename="${fileName}"`
        : `inline; filename="${fileName}"`;

    return new Response(data.stream(), {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": disposition,
        "Content-Length": fileSize.toString(),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    logger.error("Document view route error", {
      message: err instanceof Error ? err.message : "Unknown error",
    });
    return handleApiError(err);
  }
}
