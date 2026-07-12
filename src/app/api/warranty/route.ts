import { after } from "next/server";
import { requireStrictAdminAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError, apiSuccess, handleApiError, serverError } from "@/lib/apiResponse";
import { computeWarrantyExpiry } from "@/utils/warrantyExpiry";
import { getStatusDates, type ExpiryStatus } from "@/utils/expiryStatus";
import { logActivity } from "@/lib/activityLog";

type WarrantyStatus = ExpiryStatus;

// ─── GET — Warranty items (admin only) ───

export async function GET(req: Request) {
  try {
    await requireStrictAdminAuth();

    const { searchParams } = new URL(req.url);
    const vehicleId = searchParams.get("vehicle_id");
    const vendorId = searchParams.get("vendor_id");
    const status = searchParams.get("status") as WarrantyStatus | null;
    const fromDate = searchParams.get("from_date");
    const toDate = searchParams.get("to_date");
    const search = searchParams.get("search")?.trim() ?? "";
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, Number(searchParams.get("pageSize")) || 20),
    );

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { today, cutoff } = getStatusDates();

    let query = supabaseAdmin
      .from("repair_parts")
      .select(
        "id, repair_record_id, vehicle_id, part_name, vendor_id, cost, purchase_date, warranty_duration, warranty_duration_unit, warranty_expiry, notes, created_at, vendors(id, name, phone, location), vehicles(vehicle_number, company, model), repair_records(id, repair_date, category, issues, status)",
        { count: "exact" },
      )
      .order("warranty_expiry", { ascending: true })
      .order("id", { ascending: false })
      .range(from, to);

    if (vehicleId && Number.isFinite(Number(vehicleId))) {
      query = query.eq("vehicle_id", Number(vehicleId));
    }
    if (vendorId && Number.isFinite(Number(vendorId))) {
      query = query.eq("vendor_id", Number(vendorId));
    }
    if (fromDate) {
      query = query.gte("warranty_expiry", fromDate);
    }
    if (toDate) {
      query = query.lte("warranty_expiry", toDate);
    }
    if (search) {
      const safe = search.replace(/[,.*()%_]/g, "");
      query = query.ilike("part_name", `%${safe}%`);
    }
    if (status === "expired") {
      query = query.lt("warranty_expiry", today);
    } else if (status === "expiring_soon") {
      query = query
        .gte("warranty_expiry", today)
        .lte("warranty_expiry", cutoff);
    } else if (status === "active") {
      query = query.gt("warranty_expiry", cutoff);
    }

    const { data, error, count } = await query;

    if (error) {
      return serverError(error);
    }

    const rows = (data ?? []).map((row) => {
      const expiry = String(row.warranty_expiry || "");
      let warranty_status: WarrantyStatus = "active";
      if (expiry < today) {
        warranty_status = "expired";
      } else if (expiry <= cutoff) {
        warranty_status = "expiring_soon";
      }
      return { ...row, warranty_status };
    });

    return apiSuccess({ data: rows, total: count ?? 0 });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

// ─── POST — Create standalone part (admin only) ───

const VALID_UNITS = ["months", "years"];
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;


export async function POST(req: Request) {
  try {
    const authUser = await requireStrictAdminAuth();
    const body = await req.json();

    // Validate vehicle_id (required)
    const vehicleId = Number(body.vehicle_id);
    if (
      !Number.isFinite(vehicleId) ||
      !Number.isInteger(vehicleId) ||
      vehicleId <= 0
    ) {
      return apiError("Valid vehicle is required", 400);
    }

    // Validate part_name
    const partName =
      typeof body.part_name === "string" ? body.part_name.trim() : "";
    if (!partName) {
      return apiError("Part name is required", 400);
    }

    // Validate vendor_id (required)
    const vendorId = Number(body.vendor_id);
    if (
      !Number.isFinite(vendorId) ||
      !Number.isInteger(vendorId) ||
      vendorId <= 0
    ) {
      return apiError("Valid vendor is required", 400);
    }

    // Validate cost
    const cost = Number(body.cost);
    if (!Number.isFinite(cost) || cost < 0) {
      return apiError("Valid cost is required", 400);
    }

    // Validate purchase_date
    const purchaseDate =
      typeof body.purchase_date === "string" ? body.purchase_date.trim() : "";
    if (!purchaseDate || !DATE_REGEX.test(purchaseDate)) {
      return apiError("Valid purchase date (YYYY-MM-DD) is required", 400);
    }

    // Validate warranty_duration
    const warrantyDuration = Number(body.warranty_duration);
    if (
      !Number.isFinite(warrantyDuration) ||
      !Number.isInteger(warrantyDuration) ||
      warrantyDuration <= 0
    ) {
      return apiError("Warranty duration must be a positive integer", 400);
    }

    // Validate warranty_duration_unit
    const unit = body.warranty_duration_unit;
    if (!VALID_UNITS.includes(unit)) {
      return apiError("Warranty unit must be 'months' or 'years'", 400);
    }

    // Verify vehicle exists
    const { data: vehicle, error: vErr } = await supabaseAdmin
      .from("vehicles")
      .select("id")
      .eq("id", vehicleId)
      .single();
    if (vErr || !vehicle) {
      return apiError("Vehicle not found", 404);
    }

    // Verify vendor exists
    const { data: vendor, error: vendErr } = await supabaseAdmin
      .from("vendors")
      .select("id")
      .eq("id", vendorId)
      .single();
    if (vendErr || !vendor) {
      return apiError("Vendor not found", 404);
    }

    const warrantyExpiry = computeWarrantyExpiry(purchaseDate, warrantyDuration, unit as "months" | "years");
    const notes =
      typeof body.notes === "string" ? body.notes.trim() || null : null;

    // repair_record_id is optional (nullable) — for standalone parts
    const repairRecordId = body.repair_record_id
      ? Number(body.repair_record_id)
      : null;

    const insertPayload = {
      repair_record_id: repairRecordId,
      vehicle_id: vehicleId,
      part_name: partName,
      vendor_id: vendorId,
      cost: Math.round(cost * 100) / 100,
      purchase_date: purchaseDate,
      warranty_duration: warrantyDuration,
      warranty_duration_unit: unit,
      warranty_expiry: warrantyExpiry,
      notes,
      created_by: authUser.id,
    };

    const { data: part, error: insertErr } = await supabaseAdmin
      .from("repair_parts")
      .insert([insertPayload])
      .select("id")
      .single();

    if (insertErr) {
      return serverError(insertErr);
    }

    after(async () => {
      await logActivity({
        action: "CREATE_REPAIR_PART",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "repair_parts",
        recordId: part.id,
        details: {
          part_name: partName,
          vehicle_id: vehicleId,
          vendor_id: vendorId,
        },
      });
    });

    return apiSuccess({ id: part.id }, "Part added successfully", 201);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

// ─── DELETE — Delete a part (admin only) ───

export async function DELETE(req: Request) {
  try {
    const authUser = await requireStrictAdminAuth();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id || isNaN(Number(id))) {
      return apiError("Valid ID is required", 400);
    }

    const { data: part, error: fetchErr } = await supabaseAdmin
      .from("repair_parts")
      .select("id, part_name, vehicle_id")
      .eq("id", Number(id))
      .single();

    if (fetchErr || !part) {
      return apiError("Part not found", 404);
    }

    const { error: delErr } = await supabaseAdmin
      .from("repair_parts")
      .delete()
      .eq("id", Number(id));

    if (delErr) {
      return serverError(delErr);
    }

    after(async () => {
      await logActivity({
        action: "DELETE_REPAIR_PART",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "repair_parts",
        recordId: part.id,
        details: {
          part_name: part.part_name,
          vehicle_id: part.vehicle_id,
        },
      });
    });

    return apiSuccess(null, "Part deleted successfully");
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

// ─── PUT — Update a part (admin only) ───

export async function PUT(req: Request) {
  try {
    const authUser = await requireStrictAdminAuth();
    const body = await req.json();

    const id = Number(body.id);
    if (!Number.isFinite(id) || !Number.isInteger(id) || id <= 0) {
      return apiError("Valid ID is required", 400);
    }

    const vehicleId = Number(body.vehicle_id);
    if (!Number.isFinite(vehicleId) || !Number.isInteger(vehicleId) || vehicleId <= 0) {
      return apiError("Valid vehicle is required", 400);
    }

    const partName = typeof body.part_name === "string" ? body.part_name.trim() : "";
    if (!partName) {
      return apiError("Part name is required", 400);
    }

    const vendorId = Number(body.vendor_id);
    if (!Number.isFinite(vendorId) || !Number.isInteger(vendorId) || vendorId <= 0) {
      return apiError("Valid vendor is required", 400);
    }

    const cost = Number(body.cost);
    if (!Number.isFinite(cost) || cost < 0) {
      return apiError("Valid cost is required", 400);
    }

    const purchaseDate = typeof body.purchase_date === "string" ? body.purchase_date.trim() : "";
    if (!purchaseDate || !DATE_REGEX.test(purchaseDate)) {
      return apiError("Valid purchase date (YYYY-MM-DD) is required", 400);
    }

    const warrantyDuration = Number(body.warranty_duration);
    if (!Number.isFinite(warrantyDuration) || !Number.isInteger(warrantyDuration) || warrantyDuration <= 0) {
      return apiError("Warranty duration must be a positive integer", 400);
    }

    const unit = body.warranty_duration_unit;
    if (!VALID_UNITS.includes(unit)) {
      return apiError("Warranty unit must be 'months' or 'years'", 400);
    }

    const warrantyExpiry = computeWarrantyExpiry(purchaseDate, warrantyDuration, unit as "months" | "years");
    const notes = typeof body.notes === "string" ? body.notes.trim() || null : null;

    // 1. Fetch existing part to verify existence and check repair linking
    const { data: existingPart, error: existingErr } = await supabaseAdmin
      .from("repair_parts")
      .select("id, repair_record_id, vehicle_id")
      .eq("id", id)
      .single();

    if (existingErr) {
      if (existingErr.code === "PGRST116") {
        return apiError("Part not found", 404);
      }
      return serverError(existingErr);
    }

    // 2. Security guard: Cannot change vehicle on repair-linked parts
    if (existingPart.repair_record_id && existingPart.vehicle_id !== vehicleId) {
      return apiError("Cannot change vehicle for parts linked to a repair record", 400);
    }

    // 3. Check if vendor exists
    const { data: vendor, error: vendorErr } = await supabaseAdmin
      .from("vendors")
      .select("id")
      .eq("id", vendorId)
      .single();

    if (vendorErr || !vendor) {
      return apiError("Vendor not found", 404);
    }

    const updatePayload = {
      vehicle_id: vehicleId,
      part_name: partName,
      vendor_id: vendorId,
      cost: Math.round(cost * 100) / 100,
      purchase_date: purchaseDate,
      warranty_duration: warrantyDuration,
      warranty_duration_unit: unit,
      warranty_expiry: warrantyExpiry,
      notes,
    };

    const { data: part, error: updateErr } = await supabaseAdmin
      .from("repair_parts")
      .update(updatePayload)
      .eq("id", id)
      .select("id")
      .single();

    if (updateErr) {
      return serverError(updateErr);
    }

    after(async () => {
      await logActivity({
        action: "UPDATE_REPAIR_PART",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "repair_parts",
        recordId: part.id,
        details: {
          part_name: partName,
          vehicle_id: vehicleId,
          vendor_id: vendorId,
        },
      });
    });

    return apiSuccess({ id: part.id }, "Part updated successfully");
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
