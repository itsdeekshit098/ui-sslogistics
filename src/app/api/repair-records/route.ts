import { after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminAuth, requireUserAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activityLog";
import { apiSuccess, apiError, handleApiError } from "@/lib/apiResponse";
import type {
  CreateRepairPayload,
  RepairCategory,
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
        return apiError(summaryError.message, 500);
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
      return apiError(error.message, 500);
    }

    return apiSuccess({
      data: data ?? [],
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
      return apiError(insertErr.message, 500);
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

    const { error: updateErr } = await supabaseAdmin
      .from("repair_records")
      .update(updatePayload)
      .eq("id", Number(id));

    if (updateErr) {
      return apiError(updateErr.message, 500);
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
      return !record && !recordErr
        ? apiError("Record not found", 404)
        : apiError(recordErr!.message, 500);
    }

    const { error: deleteErr } = await supabaseAdmin
      .from("repair_records")
      .delete()
      .eq("id", Number(id));

    if (deleteErr) {
      return apiError(deleteErr.message, 500);
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
