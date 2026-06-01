import { logger } from "@/lib/logger";
import { after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminAuth, requireUserAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activityLog";
import { apiSuccess, apiError, handleApiError } from "@/lib/apiResponse";
import { computeWarrantyExpiry } from "@/utils/warrantyExpiry";
import type {
  CreateRepairPayload,
  RepairCategory,
  RepairPartInput,
  WarrantyDurationUnit,
} from "@/components/repairRecordsPage";

// ─── Helpers ───

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const VALID_CATEGORIES: RepairCategory[] = ["electrical", "mechanical"];

const isBlankString = (value: unknown): value is string =>
  typeof value === "string" && value.trim() === "";

const parseFiniteNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || isBlankString(value)) {
    return null;
  }
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
};

/**
 * Sync vehicle status based on open repair records.
 * - Any open repair → vehicle.status = 'Maintenance'
 * - All repairs closed AND vehicle was 'Maintenance' → vehicle.status = 'Active'
 * - Never touches 'Idle' vehicles (manual admin override)
 *
 * This is idempotent and runs inside after() so it never blocks the response.
 */
async function syncVehicleStatus(vehicleId: number): Promise<void> {
  try {
    // 1. Count open repairs for this vehicle
    const { count: openCount, error: countErr } = await supabaseAdmin
      .from("repair_records")
      .select("id", { count: "exact", head: true })
      .eq("vehicle_id", vehicleId)
      .eq("status", "Open");

    if (countErr) {
      return;
    }

    // 2. Fetch current vehicle status
    const { data: vehicle, error: vErr } = await supabaseAdmin
      .from("vehicles")
      .select("id, status")
      .eq("id", vehicleId)
      .single();

    if (vErr || !vehicle) {
      return;
    }

    // 3. Never touch 'Idle' vehicles
    if (vehicle.status === "Idle") return;

    const hasOpenRepairs = (openCount ?? 0) > 0;

    if (hasOpenRepairs && vehicle.status !== "Maintenance") {
      // Flip to Maintenance
      await supabaseAdmin
        .from("vehicles")
        .update({ status: "Maintenance" })
        .eq("id", vehicleId);
    } else if (!hasOpenRepairs && vehicle.status === "Maintenance") {
      // All repairs closed — flip back to Active
      await supabaseAdmin
        .from("vehicles")
        .update({ status: "Active" })
        .eq("id", vehicleId);
    }
  } catch {
    // Never fail the parent — log and move on
  }
}

// ─── Parts validation & sync helpers ───

const VALID_WARRANTY_UNITS: WarrantyDurationUnit[] = ["months", "years"];
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;


function validateParts(
  parts: unknown,
):
  | { valid: RepairPartInput[]; error?: string }
  | { valid?: never; error: string } {
  if (!Array.isArray(parts) || parts.length === 0) {
    return { valid: [] };
  }

  const validated: RepairPartInput[] = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const idx = i + 1;

    const partName = typeof p.part_name === "string" ? p.part_name.trim() : "";
    if (!partName) {
      return { error: `Part #${idx}: name is required` };
    }

    const vendorId = parseFiniteNumber(p.vendor_id);
    if (vendorId === null || !Number.isInteger(vendorId) || vendorId <= 0) {
      return { error: `Part #${idx}: invalid vendor` };
    }

    const cost = parseFiniteNumber(p.cost);
    if (cost === null || cost < 0) {
      return { error: `Part #${idx}: invalid cost` };
    }

    const purchaseDate =
      typeof p.purchase_date === "string" ? p.purchase_date.trim() : "";
    if (!purchaseDate || !DATE_REGEX.test(purchaseDate)) {
      return { error: `Part #${idx}: invalid purchase date (YYYY-MM-DD)` };
    }

    const warrantyDuration = parseFiniteNumber(p.warranty_duration);
    if (
      warrantyDuration === null ||
      !Number.isInteger(warrantyDuration) ||
      warrantyDuration <= 0
    ) {
      return {
        error: `Part #${idx}: warranty duration must be a positive integer`,
      };
    }

    const warrantyDurationUnit =
      p.warranty_duration_unit as WarrantyDurationUnit;
    if (!VALID_WARRANTY_UNITS.includes(warrantyDurationUnit)) {
      return {
        error: `Part #${idx}: warranty unit must be 'months' or 'years'`,
      };
    }

    const warrantyExpiry = computeWarrantyExpiry(
      purchaseDate,
      warrantyDuration,
      warrantyDurationUnit,
    );

    validated.push({
      id: p.id && Number.isFinite(Number(p.id)) ? Number(p.id) : undefined,
      part_name: partName,
      vendor_id: vendorId,
      cost: round2(cost),
      purchase_date: purchaseDate,
      warranty_duration: warrantyDuration,
      warranty_duration_unit: warrantyDurationUnit,
      warranty_expiry: warrantyExpiry,
      notes:
        typeof p.notes === "string" ? p.notes.trim() || undefined : undefined,
    });
  }

  return { valid: validated };
}

async function validateVendorIds(vendorIds: number[]): Promise<string | null> {
  if (vendorIds.length === 0) return null;
  const unique = [...new Set(vendorIds)];
  const { data, error } = await supabaseAdmin
    .from("vendors")
    .select("id")
    .in("id", unique);
  if (error) return "Failed to validate vendors";
  const foundIds = new Set((data ?? []).map((v) => v.id));
  const missing = unique.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    return `Vendor(s) not found: ${missing.join(", ")}`;
  }
  return null;
}

async function insertPartsForRepair(
  parts: RepairPartInput[],
  repairRecordId: number,
  vehicleId: number,
  userId: string,
): Promise<void> {
  if (parts.length === 0) return;
  const rows = parts.map((p) => ({
    repair_record_id: repairRecordId,
    vehicle_id: vehicleId,
    part_name: p.part_name,
    vendor_id: p.vendor_id,
    cost: p.cost,
    purchase_date: p.purchase_date,
    warranty_duration: p.warranty_duration,
    warranty_duration_unit: p.warranty_duration_unit,
    warranty_expiry: p.warranty_expiry,
    notes: p.notes || null,
    created_by: userId,
  }));
  const { error } = await supabaseAdmin.from("repair_parts").insert(rows);
  if (error) {
    logger.error("Failed to insert repair parts", { error: error.message, code: error?.code });
    throw new Error("Failed to save parts");
  }
}

async function syncPartsForRepair(
  parts: RepairPartInput[],
  repairRecordId: number,
  vehicleId: number,
  userId: string,
): Promise<void> {
  // Fetch existing parts for this repair
  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from("repair_parts")
    .select("id")
    .eq("repair_record_id", repairRecordId);

  if (fetchErr) {
    logger.error("Failed to fetch existing parts", { error: fetchErr.message });
    throw new Error("Failed to sync parts");
  }

  const existingIds = new Set((existing ?? []).map((r) => r.id));
  const incomingIds = new Set(parts.filter((p) => p.id).map((p) => p.id!));

  // 1. Insert new parts first (no id) — safest first: if this fails, nothing is lost
  const toInsert = parts.filter((p) => !p.id);
  if (toInsert.length > 0) {
    const rows = toInsert.map((p) => ({
      repair_record_id: repairRecordId,
      vehicle_id: vehicleId,
      part_name: p.part_name,
      vendor_id: p.vendor_id,
      cost: p.cost,
      purchase_date: p.purchase_date,
      warranty_duration: p.warranty_duration,
      warranty_duration_unit: p.warranty_duration_unit,
      warranty_expiry: p.warranty_expiry,
      notes: p.notes || null,
      created_by: userId,
    }));
    const { error: insErr } = await supabaseAdmin.from("repair_parts").insert(rows);
    if (insErr) {
      logger.error("Failed to insert new parts", { error: insErr.message });
      throw new Error("Failed to sync parts");
    }
  }

  // 2. Update existing parts in parallel
  const toUpdate = parts.filter((p) => p.id && existingIds.has(p.id));
  if (toUpdate.length > 0) {
    const updateResults = await Promise.all(
      toUpdate.map((p) =>
        supabaseAdmin
          .from("repair_parts")
          .update({
            part_name: p.part_name,
            vendor_id: p.vendor_id,
            cost: p.cost,
            purchase_date: p.purchase_date,
            warranty_duration: p.warranty_duration,
            warranty_duration_unit: p.warranty_duration_unit,
            warranty_expiry: p.warranty_expiry,
            notes: p.notes || null,
          })
          .eq("id", p.id!),
      ),
    );
    const failedUpdate = updateResults.find((r) => r.error);
    if (failedUpdate?.error) {
      logger.error("Failed to update parts", { error: failedUpdate.error.message });
      throw new Error("Failed to sync parts");
    }
  }

  // 3. Delete removed parts last — only after inserts/updates succeed
  const toDelete = [...existingIds].filter((id) => !incomingIds.has(id));
  if (toDelete.length > 0) {
    const { error: delErr } = await supabaseAdmin.from("repair_parts").delete().in("id", toDelete);
    if (delErr) {
      logger.error("Failed to delete removed parts", { error: delErr.message });
      throw new Error("Failed to sync parts");
    }
  }
}

// ─── GET — Fetch repair records (paginated, filterable) ───

export async function GET(req: Request) {
  try {
    await requireUserAuth();

    const { searchParams } = new URL(req.url);
    const vehicleId = searchParams.get("vehicle_id");
    const fromDate = searchParams.get("from_date");
    const toDate = searchParams.get("to_date");
    const category = searchParams.get("category");
    const technicianId = searchParams.get("technician_id");
    const status = searchParams.get("status");
    const includeSummary = searchParams.get("include_summary") !== "false";
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, Number(searchParams.get("pageSize")) || 10),
    );

    // ── Summary via DB aggregate ──
    let summary: Record<string, number> | undefined;

    if (includeSummary) {
      const { data: summaryRow, error: summaryError } = await supabaseAdmin.rpc(
        "get_repair_records_summary",
        {
          p_vehicle_id:
            vehicleId && Number.isFinite(Number(vehicleId))
              ? Number(vehicleId)
              : null,
          p_from_date: fromDate || null,
          p_to_date: toDate || null,
          p_category:
            category && VALID_CATEGORIES.includes(category as RepairCategory)
              ? category
              : null,
          p_technician_id:
            technicianId && Number.isFinite(Number(technicianId))
              ? Number(technicianId)
              : null,
          p_status: status || null,
        },
      );

      if (summaryError) {
        logger.error("Database error", { error: summaryError.message, code: summaryError?.code, hint: summaryError?.hint });
        return apiError("Internal server error", 500);
      }

      const row = summaryRow?.[0];
      summary = {
        totalCount: Number(row?.total_count ?? 0),
        totalCost: Number(row?.total_cost ?? 0),
        electricalCost: Number(row?.electrical_cost ?? 0),
        mechanicalCost: Number(row?.mechanical_cost ?? 0),
        openCount: Number(row?.open_count ?? 0),
        closedCount: Number(row?.closed_count ?? 0),
      };
    }

    // ── Paginated data query ──
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabaseAdmin
      .from("repair_records")
      .select(
        "*, vehicles(vehicle_number, company, model), technicians(id, name, phone, specializations)",
        { count: "exact" },
      )
      .order("repair_date", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to);

    if (vehicleId) {
      query = query.eq("vehicle_id", Number(vehicleId));
    }
    if (fromDate) {
      query = query.gte("repair_date", fromDate);
    }
    if (toDate) {
      query = query.lte("repair_date", toDate);
    }
    if (category && VALID_CATEGORIES.includes(category as RepairCategory)) {
      query = query.eq("category", category);
    }
    if (technicianId && Number.isFinite(Number(technicianId))) {
      query = query.eq("technician_id", Number(technicianId));
    }
    if (status) {
      query = query.eq("status", status);
    }

    const { data, error, count } = await query;

    if (error) {
      logger.error("Database error", { error: error.message, code: error?.code, hint: error?.hint });
      return apiError("Internal server error", 500);
    }

    // ── Attach parts to each record ──
    const records = data ?? [];
    let recordsWithParts = records;
    if (records.length > 0) {
      const recordIds = records.map((r) => r.id);
      const { data: parts } = await supabaseAdmin
        .from("repair_parts")
        .select("*, vendors(id, name, phone, location)")
        .in("repair_record_id", recordIds)
        .order("id", { ascending: true });

      if (parts && parts.length > 0) {
        const partsMap = new Map<number, typeof parts>();
        for (const part of parts) {
          const rid = part.repair_record_id as number;
          if (!partsMap.has(rid)) partsMap.set(rid, []);
          partsMap.get(rid)!.push(part);
        }
        recordsWithParts = records.map((r) => ({
          ...r,
          parts: partsMap.get(r.id) ?? [],
        }));
      }
    }

    return apiSuccess({
      data: recordsWithParts,
      total: count ?? 0,
      summary,
    });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

// ─── POST — Create repair record ───

export async function POST(req: Request) {
  try {
    const authUser = await requireAdminAuth();
    const body: CreateRepairPayload = await req.json();

    // ── Validate required fields ──
    if (body.vehicle_id === null || body.vehicle_id === undefined) {
      return apiError("Missing vehicle ID", 400);
    }

    const vehicleId = parseFiniteNumber(body.vehicle_id);
    if (vehicleId === null || !Number.isInteger(vehicleId) || vehicleId <= 0) {
      return apiError("Invalid vehicle ID", 400);
    }

    if (!body.category || !VALID_CATEGORIES.includes(body.category)) {
      return apiError("Category must be 'electrical' or 'mechanical'", 400);
    }

    if (!Array.isArray(body.issues) || body.issues.length === 0) {
      return apiError("At least one issue must be selected", 400);
    }

    const technicianId = parseFiniteNumber(body.technician_id);
    if (
      technicianId === null ||
      !Number.isInteger(technicianId) ||
      technicianId <= 0
    ) {
      return apiError("Invalid technician ID", 400);
    }

    // Validate cost (required)
    if (
      body.cost === undefined ||
      body.cost === null ||
      isBlankString(body.cost)
    ) {
      return apiError("Cost is required", 400);
    }

    const parsedCost = parseFiniteNumber(body.cost);
    if (parsedCost === null || parsedCost < 0) {
      return apiError("Invalid cost value", 400);
    }
    const cost = round2(parsedCost);

    // Verify vehicle exists
    const { data: vehicle, error: vErr } = await supabaseAdmin
      .from("vehicles")
      .select("id")
      .eq("id", vehicleId)
      .single();

    if (vErr || !vehicle) {
      return apiError("Vehicle not found", 404);
    }

    // Verify technician exists and is active
    const { data: technician, error: tErr } = await supabaseAdmin
      .from("technicians")
      .select("id, is_active")
      .eq("id", technicianId)
      .single();

    if (tErr || !technician) {
      return apiError("Technician not found", 404);
    }

    if (!technician.is_active) {
      return apiError("Selected technician is inactive", 400);
    }

    // ── Validate parts (optional) ──
    let validatedParts: RepairPartInput[] = [];
    if (body.parts && body.parts.length > 0) {
      const partsResult = validateParts(body.parts);
      if (partsResult.error) {
        return apiError(partsResult.error, 400);
      }
      validatedParts = partsResult.valid!;

      const vendorError = await validateVendorIds(
        validatedParts.map((p) => p.vendor_id),
      );
      if (vendorError) {
        return apiError(vendorError, 400);
      }
    }

    // ── Insert ──
    const insertPayload = {
      vehicle_id: vehicleId,
      repair_date: body.repair_date || new Date().toISOString(),
      category: body.category,
      issues: body.issues,
      description: body.description?.trim() || null,
      cost,
      status: "Open",
      technician_id: technicianId,
      created_by: authUser.id,
      updated_by: authUser.id,
    };

    const { data: newRecord, error: insertErr } = await supabaseAdmin
      .from("repair_records")
      .insert([insertPayload])
      .select("id")
      .single();

    if (insertErr) {
      logger.error("Database error", { error: insertErr.message, code: insertErr?.code, hint: insertErr?.hint });
      return apiError("Internal server error", 500);
    }

    // ── Insert parts if provided ──
    if (validatedParts.length > 0 && newRecord?.id) {
      await insertPartsForRepair(
        validatedParts,
        newRecord.id,
        vehicleId,
        authUser.id,
      );
    }

    // ── after(): sync vehicle status + audit log ──
    after(async () => {
      await Promise.all([
        syncVehicleStatus(vehicleId),
        logActivity({
          action: "CREATE_REPAIR_RECORD",
          userId: authUser.id,
          userEmail: authUser.email,
          tableName: "repair_records",
          recordId: newRecord?.id || null,
          details: {
            vehicle_id: vehicleId,
            category: body.category,
            issues: body.issues,
            cost,
          },
        }),
      ]);
    });

    return apiSuccess(
      { id: newRecord?.id },
      "Repair record created successfully",
      201,
    );
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

// ─── PUT — Update repair record ───

export async function PUT(req: Request) {
  try {
    const authUser = await requireAdminAuth();
    const body = await req.json();
    const { id, ...fields } = body;

    if (!id) {
      return apiError("Missing record ID", 400);
    }

    // Fetch existing record
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from("repair_records")
      .select("*")
      .eq("id", Number(id))
      .single();

    if (fetchErr || !existing) {
      return apiError("Record not found", 404);
    }

    // Build update payload — only allowed fields
    const updatePayload: Record<string, unknown> = {
      updated_by: authUser.id,
    };

    if (fields.description !== undefined) {
      updatePayload.description = fields.description?.trim() || null;
    }

    if (fields.technician_id !== undefined) {
      const technicianId = parseFiniteNumber(fields.technician_id);
      if (
        technicianId === null ||
        !Number.isInteger(technicianId) ||
        technicianId <= 0
      ) {
        return apiError("Invalid technician ID", 400);
      }
      updatePayload.technician_id = technicianId;
    }

    if (fields.cost !== undefined) {
      if (fields.cost === null || isBlankString(fields.cost)) {
        return apiError("Cost cannot be empty", 400);
      }
      const parsedCost = parseFiniteNumber(fields.cost);
      if (parsedCost === null || parsedCost < 0) {
        return apiError("Invalid cost value", 400);
      }
      updatePayload.cost = round2(parsedCost);
    }

    if (fields.issues !== undefined) {
      if (!Array.isArray(fields.issues) || fields.issues.length === 0) {
        return apiError("At least one issue must be selected", 400);
      }
      updatePayload.issues = fields.issues;
    }

    if (fields.status !== undefined) {
      if (!["Open", "Closed"].includes(fields.status)) {
        return apiError("Status must be 'Open' or 'Closed'", 400);
      }
      updatePayload.status = fields.status;
    }

    // ── Validate parts if provided ──
    let validatedParts: RepairPartInput[] | undefined;
    if (fields.parts !== undefined) {
      if (!Array.isArray(fields.parts)) {
        return apiError("Parts must be an array", 400);
      }
      if (fields.parts.length === 0) {
        validatedParts = [];
      } else {
        const partsResult = validateParts(fields.parts);
        if (partsResult.error) {
          return apiError(partsResult.error, 400);
        }
        validatedParts = partsResult.valid!;

        const vendorError = await validateVendorIds(
          validatedParts.map((p) => p.vendor_id),
        );
        if (vendorError) {
          return apiError(vendorError, 400);
        }
      }
    }

    const { error: updateErr } = await supabaseAdmin
      .from("repair_records")
      .update(updatePayload)
      .eq("id", Number(id));

    if (updateErr) {
      logger.error("Database error", { error: updateErr.message, code: updateErr?.code, hint: updateErr?.hint });
      return apiError("Internal server error", 500);
    }

    // ── Sync parts if provided ──
    if (validatedParts !== undefined) {
      if (validatedParts.length === 0) {
        // Remove all parts for this repair
        await supabaseAdmin
          .from("repair_parts")
          .delete()
          .eq("repair_record_id", Number(id));
      } else {
        await syncPartsForRepair(
          validatedParts,
          Number(id),
          existing.vehicle_id,
          authUser.id,
        );
      }
    }

    // ── after(): sync vehicle status + audit log ──
    after(async () => {
      await Promise.all([
        syncVehicleStatus(existing.vehicle_id),
        logActivity({
          action: "UPDATE_REPAIR_RECORD",
          userId: authUser.id,
          userEmail: authUser.email,
          tableName: "repair_records",
          recordId: Number(id),
          details: updatePayload,
        }),
      ]);
    });

    return apiSuccess(null, "Repair record updated", 200);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

// ─── DELETE — Delete repair record (admin only) ───

export async function DELETE(req: Request) {
  try {
    const authUser = await requireAdminAuth();

    // Only admin can delete, not staff
    if (authUser.role !== "admin") {
      return apiError("Only admins can delete repair records", 403);
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return apiError("Missing record ID", 400);
    }

    // Fetch record before deleting (for audit log + vehicle sync)
    const { data: record, error: recordErr } = await supabaseAdmin
      .from("repair_records")
      .select("id, vehicle_id, category, issues, status, cost, technician_id")
      .eq("id", Number(id))
      .single();

    if (recordErr || !record) {
      if (!record && !recordErr) {
        return apiError("Record not found", 404);
      }
      logger.error("Database error", { error: recordErr!.message, code: recordErr?.code, hint: recordErr?.hint });
      return apiError("Internal server error", 500);
    }

    const { error: deleteErr } = await supabaseAdmin
      .from("repair_records")
      .delete()
      .eq("id", Number(id));

    if (deleteErr) {
      logger.error("Database error", { error: deleteErr.message, code: deleteErr?.code, hint: deleteErr?.hint });
      return apiError("Internal server error", 500);
    }

    // ── after(): sync vehicle status + audit log ──
    after(async () => {
      await Promise.all([
        syncVehicleStatus(record.vehicle_id),
        logActivity({
          action: "DELETE_REPAIR_RECORD",
          userId: authUser.id,
          userEmail: authUser.email,
          tableName: "repair_records",
          recordId: Number(id),
          details: {
            vehicle_id: record.vehicle_id,
            category: record.category,
            issues: record.issues,
            status: record.status,
            cost: record.cost,
          },
        }),
      ]);
    });

    return apiSuccess(null, "Repair record deleted", 200);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
