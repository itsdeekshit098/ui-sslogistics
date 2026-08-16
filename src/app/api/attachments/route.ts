import { randomUUID } from "crypto";
import { after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminAuth, requireStrictAdminAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activityLog";
import { apiSuccess, apiError, handleApiError, serverError } from "@/lib/apiResponse";

// The first many-files-per-record attachment table (sql/38_add_attachments.sql).
// Vehicle photos and client payment proofs share one private bucket and one
// pair of routes, split only by which parent they attach to — the auth tier
// is stricter for a payment proof than for a vehicle photo, since a
// receivables ledger is as sensitive as the rest of the money modules.
//
// Unlike the vehicle-documents route (deterministic path, upsert: true, one
// file per slot), every object here gets a random UUID path so many files can
// sit against the same record without collision.

const BUCKET_NAME = "attachments";

const OWNER_TYPES = ["vehicle", "client_entry"] as const;
type OwnerType = (typeof OWNER_TYPES)[number];

function isOwnerType(value: string | null): value is OwnerType {
  return !!value && (OWNER_TYPES as readonly string[]).includes(value);
}

/** Max upload size: 10 MB — mirrors the vehicle-documents route. */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;

/** A vehicle photo is image-only; a payment proof is usually a bank receipt PDF. */
const ALLOWED_MIME_TYPES: Record<OwnerType, readonly string[]> = {
  vehicle: IMAGE_MIME_TYPES,
  client_entry: [...IMAGE_MIME_TYPES, "application/pdf"],
};

const OWNER_COLUMN: Record<OwnerType, "vehicle_id" | "client_entry_id"> = {
  vehicle: "vehicle_id",
  client_entry: "client_entry_id",
};

const SELECT_COLUMNS =
  "id, vehicle_id, client_entry_id, storage_path, file_name, mime_type, size_bytes, caption, created_at";

/**
 * A client-entry attachment is a payment proof, gated the same as every other
 * money route (requireStrictAdminAuth, GET included). A vehicle photo only
 * needs the ordinary admin tier, matching the existing documents routes.
 */
async function requireAuthFor(ownerType: OwnerType) {
  return ownerType === "client_entry" ? requireStrictAdminAuth() : requireAdminAuth();
}

async function parentExists(ownerType: OwnerType, ownerId: number): Promise<boolean> {
  const table = ownerType === "vehicle" ? "vehicles" : "client_ledger_entries";
  const { data } = await supabaseAdmin.from(table).select("id").eq("id", ownerId).maybeSingle();
  return !!data;
}

// ─── GET — list attachments for one owner ───

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const ownerType = searchParams.get("owner_type");
    const ownerIdParam = searchParams.get("owner_id");

    if (!isOwnerType(ownerType)) {
      return apiError(`owner_type must be one of: ${OWNER_TYPES.join(", ")}`, 400);
    }
    const ownerId = Number(ownerIdParam);
    if (!ownerIdParam || !Number.isFinite(ownerId)) {
      return apiError("Missing or invalid owner_id", 400);
    }

    await requireAuthFor(ownerType);

    const { data, error, count } = await supabaseAdmin
      .from("attachments")
      .select(SELECT_COLUMNS, { count: "exact" })
      .eq(OWNER_COLUMN[ownerType], ownerId)
      .order("created_at", { ascending: false });

    if (error) return serverError(error);

    return apiSuccess({ data: data ?? [], total: count ?? data?.length ?? 0 });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

// ─── POST — upload a file against one owner ───

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const ownerType = formData.get("owner_type") as string | null;
    const ownerIdRaw = formData.get("owner_id") as string | null;

    if (!isOwnerType(ownerType)) {
      return apiError(`owner_type must be one of: ${OWNER_TYPES.join(", ")}`, 400);
    }
    const ownerId = Number(ownerIdRaw);
    if (!ownerIdRaw || !Number.isFinite(ownerId)) {
      return apiError("Missing or invalid owner_id", 400);
    }
    if (!file) {
      return apiError("Missing file", 400);
    }

    const authUser = await requireAuthFor(ownerType);

    if (file.size > MAX_FILE_SIZE) {
      return apiError("File exceeds maximum size of 10 MB", 400);
    }
    if (!ALLOWED_MIME_TYPES[ownerType].includes(file.type)) {
      return apiError(
        ownerType === "vehicle"
          ? "Invalid file type. Allowed: JPEG, PNG, GIF, WebP"
          : "Invalid file type. Allowed: JPEG, PNG, GIF, WebP, PDF",
        400,
      );
    }

    if (!(await parentExists(ownerType, ownerId))) {
      return apiError(
        ownerType === "vehicle" ? "Vehicle not found" : "Statement entry not found",
        404,
      );
    }

    const extension = file.name.split(".").pop() || "bin";
    const prefix = ownerType === "vehicle" ? "vehicles" : "client-entries";
    const storagePath = `${prefix}/${ownerId}/${randomUUID()}.${extension}`;

    const buffer = await file.arrayBuffer();
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(storagePath, buffer, { contentType: file.type, upsert: false });

    if (uploadError) return serverError(uploadError);

    const { data: attachment, error: insertError } = await supabaseAdmin
      .from("attachments")
      .insert([
        {
          [OWNER_COLUMN[ownerType]]: ownerId,
          storage_path: storagePath,
          file_name: file.name,
          mime_type: file.type,
          size_bytes: file.size,
          uploaded_by: authUser.id,
        },
      ])
      .select(SELECT_COLUMNS)
      .single();

    if (insertError) {
      // A failed row write must not leave an orphaned object behind.
      await supabaseAdmin.storage.from(BUCKET_NAME).remove([storagePath]);
      return serverError(insertError);
    }

    after(async () => {
      await logActivity({
        action: "UPLOAD_ATTACHMENT",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "attachments",
        recordId: attachment.id,
        details: { owner_type: ownerType, owner_id: ownerId, file_name: file.name },
      });
    });

    return apiSuccess({ attachment }, "File uploaded", 201);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

// ─── DELETE — remove one attachment ───

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get("id");
    const id = Number(idParam);
    if (!idParam || !Number.isFinite(id)) {
      return apiError("Missing attachment ID", 400);
    }

    const { data: attachment, error: fetchErr } = await supabaseAdmin
      .from("attachments")
      .select("id, vehicle_id, client_entry_id, storage_path, file_name")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr) return serverError(fetchErr);
    if (!attachment) return apiError("Attachment not found", 404);

    const ownerType: OwnerType = attachment.client_entry_id != null ? "client_entry" : "vehicle";
    const authUser = await requireAuthFor(ownerType);

    const { error: storageErr } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .remove([attachment.storage_path]);
    if (storageErr) return serverError(storageErr);

    const { error } = await supabaseAdmin.from("attachments").delete().eq("id", id);
    if (error) return serverError(error);

    after(async () => {
      await logActivity({
        action: "DELETE_ATTACHMENT",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "attachments",
        recordId: id,
        details: { owner_type: ownerType, file_name: attachment.file_name },
      });
    });

    return apiSuccess(null, "Attachment deleted", 200);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
