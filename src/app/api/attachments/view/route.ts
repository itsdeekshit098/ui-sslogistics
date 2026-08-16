import { logger } from "@/lib/logger";
import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminAuth, requireStrictAdminAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/apiResponse";

const BUCKET_NAME = "attachments";

/** Maximum file size (in bytes) that we'll stream inline for preview. Above this, force download. */
const INLINE_PREVIEW_LIMIT = 10 * 1024 * 1024; // 10 MB

/**
 * Sanitize a filename for use in Content-Disposition headers.
 * Strips control characters, quotes, backslashes, and non-ASCII to prevent
 * header injection vulnerabilities.
 *
 * The non-ASCII strip is not just a courtesy: Content-Disposition must be a
 * valid HTTP header ByteString (every char <= 255), and header construction
 * throws otherwise. macOS screenshot filenames trip this in practice — they
 * embed U+202F (narrow no-break space, code point 8239) between the time and
 * AM/PM, e.g. "Screenshot 2026-08-10 at 7.50.31\u202FPM.png".
 */
function sanitizeFileName(raw: string): string {
  const cleaned = raw
    .replace(/[\x00-\x1f\x7f"\\]/g, "")
    .replace(/[^\x20-\x7e]/g, "_");
  return cleaned.trim() || "attachment";
}

/**
 * GET — Proxy a private Supabase Storage attachment through our own domain.
 *
 * The browser never sees the Supabase URL — it only sees:
 *   /api/attachments/view?id=123
 *
 * Unlike the vehicle-documents view route, the storage path is looked up
 * server-side from the attachment id rather than accepted from the caller,
 * which removes path traversal as a concern entirely — there is no path for
 * a client to supply.
 *
 * Query params:
 *   - id (required): The attachment row id
 *   - download (optional): If "true", forces Content-Disposition: attachment
 */
export async function GET(req: NextRequest) {
  try {
    const idParam = req.nextUrl.searchParams.get("id");
    const id = Number(idParam);
    if (!idParam || !Number.isFinite(id)) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing or invalid id" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const { data: attachment, error: fetchErr } = await supabaseAdmin
      .from("attachments")
      .select("storage_path, file_name, mime_type, client_entry_id")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr || !attachment) {
      return new Response(
        JSON.stringify({ success: false, error: "Attachment not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    // A payment proof is gated like every other money route; a vehicle photo
    // only needs the ordinary admin tier, matching the documents view route.
    await (attachment.client_entry_id != null ? requireStrictAdminAuth() : requireAdminAuth());

    const forceDownload = req.nextUrl.searchParams.get("download") === "true";

    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .download(attachment.storage_path);

    if (error || !data) {
      logger.error("Failed to download attachment from storage", {
        storagePath: attachment.storage_path,
        message: error?.message,
      });
      return new Response(
        JSON.stringify({ success: false, error: "Attachment not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    const fileName = sanitizeFileName(attachment.file_name);
    const fileSize = data.size;

    const disposition =
      forceDownload || fileSize > INLINE_PREVIEW_LIMIT
        ? `attachment; filename="${fileName}"`
        : `inline; filename="${fileName}"`;

    return new Response(data.stream(), {
      status: 200,
      headers: {
        "Content-Type": attachment.mime_type,
        "Content-Disposition": disposition,
        "Content-Length": fileSize.toString(),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    logger.error("Attachment view route error", {
      message: err instanceof Error ? err.message : "Unknown error",
    });
    return handleApiError(err);
  }
}
