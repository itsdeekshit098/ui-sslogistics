import { logger } from "@/lib/logger";
import { after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activityLog";
import { apiSuccess, apiError, handleApiError } from "@/lib/apiResponse";

const BUCKET_NAME = "vehicle-documents";

/** Only these DB columns can be written via documentType */
const VALID_DOCUMENT_TYPES = [
  "rc_url",
  "fc_url",
  "insurance_url",
  "permit_url",
  "pollution_url",
  "tax_url",
] as const;

/** Max upload size: 10 MB */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Allowed MIME types for document uploads */
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

function isValidDocumentType(
  value: string,
): value is (typeof VALID_DOCUMENT_TYPES)[number] {
  return (VALID_DOCUMENT_TYPES as readonly string[]).includes(value);
}

function isAllowedMimeType(mime: string): boolean {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(mime);
}

/**
 * POST — Upload a document to private storage and save the FILE PATH in the database.
 */
export async function POST(req: Request) {
  try {
    const authUser = await requireAdminAuth();
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const vehicleId = formData.get("vehicleId") as string;
    const vehicleNumber = formData.get("vehicleNumber") as string;
    const documentType = formData.get("documentType") as string;

    if (!file || !vehicleId || !vehicleNumber || !documentType) {
      return apiError(
        "Missing required fields (file, vehicleId, vehicleNumber, documentType)",
        400,
      );
    }

    // Validate documentType against allowlist
    if (!isValidDocumentType(documentType)) {
      return apiError("Invalid document type", 400);
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return apiError("File exceeds maximum size of 10 MB", 400);
    }

    // Validate file MIME type
    if (!isAllowedMimeType(file.type)) {
      return apiError(
        "Invalid file type. Allowed: JPEG, PNG, GIF, WebP, PDF, Excel",
        400,
      );
    }

    const buffer = await file.arrayBuffer();
    const fileExtension = file.name.split(".").pop();
    const fileName = `${documentType}.${fileExtension}`;
    const filePath = `${vehicleNumber}/${fileName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      logger.error("Database error", { 
        error: uploadError.message, 
        code: (uploadError as unknown as Record<string, unknown>)?.code, 
        hint: (uploadError as unknown as Record<string, unknown>)?.hint 
      });
      return apiError("Internal server error", 500);
    }

    const updatePayload: Record<string, unknown> = { [documentType]: filePath };
    updatePayload.updated_by = authUser.id;

    const { error: dbError } = await supabaseAdmin
      .from("vehicles")
      .update(updatePayload)
      .eq("id", vehicleId);

    if (dbError) {
      logger.error("Database error", { error: dbError.message, code: dbError?.code, hint: dbError?.hint });
      return apiError("Internal server error", 500);
    }

    after(() =>
      logActivity({
        action: "UPLOAD_DOCUMENT",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "vehicles",
        recordId: Number(vehicleId),
        details: {
          vehicle_number: vehicleNumber,
          document_type: documentType,
          file_name: file.name,
          file_size_bytes: file.size,
        },
      }),
    );

    return apiSuccess({ filePath }, "Document saved", 201);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

/**
 * DELETE — Remove a document from private storage and clear the database column.
 */
export async function DELETE(req: Request) {
  try {
    const authUser = await requireAdminAuth();
    const body = await req.json();
    const { vehicleId, documentType, filePath } = body;

    if (!vehicleId || !documentType || !filePath) {
      return apiError("Missing vehicleId, documentType, or filePath", 400);
    }

    // Validate documentType against allowlist
    if (!isValidDocumentType(documentType)) {
      return apiError("Invalid document type", 400);
    }

    const { error: deleteError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .remove([filePath]);
    if (deleteError) {
      logger.error("Database error", { 
        error: deleteError.message, 
        code: (deleteError as unknown as Record<string, unknown>)?.code, 
        hint: (deleteError as unknown as Record<string, unknown>)?.hint 
      });
      return apiError("Internal server error", 500);
    }

    const updatePayload: Record<string, unknown> = { [documentType]: null };
    updatePayload.updated_by = authUser.id;

    const { error: dbError } = await supabaseAdmin
      .from("vehicles")
      .update(updatePayload)
      .eq("id", vehicleId);

    if (dbError) {
      logger.error("Database error", { error: dbError.message, code: dbError?.code, hint: dbError?.hint });
      return apiError("Internal server error", 500);
    }

    after(() =>
      logActivity({
        action: "DELETE_DOCUMENT",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "vehicles",
        recordId: Number(vehicleId),
        details: {
          document_type: documentType,
          file_path: filePath,
        },
      }),
    );

    return apiSuccess(null, "Document deleted successfully");
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
