import { after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireStrictAdminAuth, requireUserAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activityLog";
import { notifyRoles } from "@/lib/notifications";
import { apiSuccess, apiError, handleApiError, serverError } from "@/lib/apiResponse";
import type { CreateDieselPayload } from "@/app/admin/diesel-records/dieselRecords.types";

const isBlankString = (value: unknown): value is string =>
  typeof value === "string" && value.trim() === "";

const parseFiniteNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || isBlankString(value)) {
    return null;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
};

// ─── GET — Fetch diesel records for a vehicle (paginated) ───
export async function GET(req: Request) {
  try {
    await requireUserAuth();

    const { searchParams } = new URL(req.url);
    const vehicleId = searchParams.get("vehicle_id");
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const pageSize = Math.min(
      200,
      Math.max(1, Number(searchParams.get("pageSize")) || 10),
    );

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabaseAdmin
      .from("diesel_records")
      .select(
        "*, vehicles(vehicle_number, company, model, expected_kml, tank_capacity)",
        { count: "exact" },
      )
      .order("fill_date", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to);

    if (vehicleId) {
      query = query.eq("vehicle_id", Number(vehicleId));
    }

    const { data, error, count } = await query;

    if (error) {
      return serverError(error);
    }

    return apiSuccess({ data: data ?? [], total: count ?? 0 });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

// ─── POST — Create diesel record with cycle logic ───
export async function POST(req: Request) {
  try {
    const authUser = await requireUserAuth();
    const body: CreateDieselPayload = await req.json();

    // ── 1. Validate required fields ──
    if (
      body.vehicle_id === null ||
      body.vehicle_id === undefined ||
      !body.driver_name?.trim() ||
      !body.fill_type ||
      body.fuel_litres === null ||
      body.fuel_litres === undefined ||
      body.current_odo === null ||
      body.current_odo === undefined
    ) {
      return apiError("Missing required fields", 400);
    }

    if (!["full", "partial"].includes(body.fill_type)) {
      return apiError("fill_type must be 'full' or 'partial'", 400);
    }

    const vehicleId = parseFiniteNumber(body.vehicle_id);
    const currentOdo = parseFiniteNumber(body.current_odo);
    const fuelLitres = parseFiniteNumber(body.fuel_litres);

    if (vehicleId === null || !Number.isInteger(vehicleId) || vehicleId <= 0) {
      return apiError("Invalid vehicle_id", 400);
    }
    if (currentOdo === null || currentOdo < 0) {
      return apiError("Invalid odometer reading", 400);
    }
    if (fuelLitres === null || fuelLitres <= 0) {
      return apiError("Invalid fuel litres", 400);
    }

    let pricePerL = 0;
    if (body.price_per_l !== undefined && body.price_per_l !== null) {
      const parsedPricePerL = parseFiniteNumber(body.price_per_l);
      if (parsedPricePerL === null || parsedPricePerL < 0) {
        return apiError("Invalid price per litre", 400);
      }
      pricePerL = parsedPricePerL;
    }

    // ── 2. Fetch vehicle master (expected_kml, tank_capacity) ──
    const { data: vehicle, error: vErr } = await supabaseAdmin
      .from("vehicles")
      .select("id, vehicle_number, expected_kml, tank_capacity")
      .eq("id", vehicleId)
      .single();

    if (vErr || !vehicle) {
      return apiError("Vehicle not found", 404);
    }

    // ── 3. Tank capacity warning (non-blocking, return in response) ──
    const warnings: string[] = [];
    if (vehicle.tank_capacity && fuelLitres > vehicle.tank_capacity) {
      warnings.push(
        `Fuel added (${fuelLitres}L) exceeds tank capacity (${vehicle.tank_capacity}L)`,
      );
    }
    if (
      body.fill_type === "full" &&
      vehicle.tank_capacity &&
      fuelLitres < vehicle.tank_capacity * 0.3
    ) {
      warnings.push(
        `Only ${fuelLitres}L for a full fill? Tank capacity is ${vehicle.tank_capacity}L`,
      );
    }

    // ── 4. Get last entry for this vehicle (prev odo + cycle context) ──
    const { data: lastEntry, error: lastEntryErr } = await supabaseAdmin
      .from("diesel_records")
      .select("id, current_odo, cycle_id, fill_type, cycle_status, fill_date")
      .eq("vehicle_id", vehicleId)
      .order("fill_date", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastEntryErr) {
      return serverError(lastEntryErr);
    }

    // ── 5. Validate odometer is increasing (also catches duplicates) ──
    // DB unique index on (vehicle_id, current_odo) is the final safety net
    if (lastEntry && currentOdo <= lastEntry.current_odo) {
      return apiError(
        `Odometer must be greater than previous reading (${lastEntry.current_odo} km)`,
        400,
      );
    }

    // ── 5b. Validate fill_date is not older than the previous record's ──
    if (lastEntry) {
      const newFillDate = new Date(body.fill_date || Date.now());
      const lastFillDate = new Date(lastEntry.fill_date);
      if (newFillDate.getTime() < lastFillDate.getTime()) {
        return apiError(
          `Fill date cannot be earlier than the previous entry's date (${formatDisplayDateTime(lastFillDate)})`,
          400,
        );
      }
    }

    // ── 6. First fill must be a full fill ──
    if (!lastEntry && body.fill_type === "partial") {
      return apiError("First fill for this vehicle must be a Full fill", 400);
    }

    // ── 7. Calculate derived fields ──
    const amount = round2(fuelLitres * pricePerL);
    const prevOdo = lastEntry ? lastEntry.current_odo : null;
    const distance = prevOdo !== null ? round1(currentOdo - prevOdo) : null;
    const expectedKml = vehicle.expected_kml ?? null;

    let kml: number | null = null;
    let devPct: number | null = null;
    let costPerKm: number | null = null;
    let cycleId: number;
    let cycleStatus: "open" | "closed";
    let cycleDistanceTotal: number | null = null;
    let cycleFuelTotal: number | null = null;

    if (body.fill_type === "partial") {
      // ── PARTIAL FILL — just accumulate, keep cycle open ──
      cycleId = lastEntry ? lastEntry.cycle_id : 1;
      cycleStatus = "open";
    } else {
      // ── FULL FILL ──
      if (!lastEntry) {
        // Very first fill ever for this vehicle — opens first cycle
        cycleId = 1;
        cycleStatus = "open";
      } else {
        // There IS a previous entry — close the cycle

        // Find the last FULL fill for this vehicle (start of current cycle)
        const { data: lastFullFill, error: lastFullErr } = await supabaseAdmin
          .from("diesel_records")
          .select("id, current_odo, cycle_id, fill_date")
          .eq("vehicle_id", vehicleId)
          .eq("fill_type", "full")
          .order("fill_date", { ascending: false })
          .order("id", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastFullErr) {
          return serverError(lastFullErr);
        }

        if (lastFullFill) {
          // There's a previous full fill — we can close the cycle
          const cycleDistance = currentOdo - lastFullFill.current_odo;

          // Sum all litres from entries AFTER the last full fill + this fill
          const { data: cycleEntries, error: cycleEntriesErr } =
            await supabaseAdmin
              .from("diesel_records")
              .select("fuel_litres, amount")
              .eq("vehicle_id", vehicleId)
              .gt("id", lastFullFill.id)
              .order("id", { ascending: true });

          if (cycleEntriesErr) {
            return serverError(cycleEntriesErr);
          }

          const intermediateLitres = cycleEntries
            ? cycleEntries.reduce((sum, e) => sum + Number(e.fuel_litres), 0)
            : 0;
          const intermediateAmount = cycleEntries
            ? cycleEntries.reduce((sum, e) => sum + Number(e.amount), 0)
            : 0;

          const cycleLitres = intermediateLitres + fuelLitres;
          const cycleAmount = intermediateAmount + amount;

          cycleDistanceTotal = round1(cycleDistance);
          cycleFuelTotal = round2(cycleLitres);

          if (cycleDistance > 0 && cycleLitres > 0) {
            kml = round2(cycleDistance / cycleLitres);
            costPerKm = round2(cycleAmount / cycleDistance);
            if (expectedKml && expectedKml > 0) {
              devPct = round2(((kml - expectedKml) / expectedKml) * 100);
            }
          }

          cycleId = lastFullFill.cycle_id + 1;
          cycleStatus = "closed";
        } else {
          // No previous full fill found (all previous were partial) — this full fill opens cycle
          cycleId = lastEntry.cycle_id;
          cycleStatus = "open";
        }
      }
    }

    // ── 8. Insert the record ──
    const insertPayload = {
      vehicle_id: vehicleId,
      driver_name: body.driver_name.trim(),
      fill_date: body.fill_date || new Date().toISOString(),
      fill_type: body.fill_type,
      fuel_litres: fuelLitres,
      price_per_l: pricePerL,
      current_odo: currentOdo,
      station: body.station?.trim() || null,
      payment_method: body.payment_method || null,
      receipt_number: body.receipt_number?.trim() || null,
      notes: body.notes?.trim() || null,
      amount,
      prev_odo: prevOdo,
      distance,
      kml,
      expected_kml: expectedKml,
      dev_pct: devPct,
      cost_per_km: costPerKm,
      cycle_distance: cycleDistanceTotal,
      cycle_fuel: cycleFuelTotal,
      cycle_id: cycleId,
      cycle_status: cycleStatus,
      verified_by: authUser.email,
      created_by: authUser.id,
    };

    const { data: newRecord, error: insertErr } = await supabaseAdmin
      .from("diesel_records")
      .insert([insertPayload])
      .select("id")
      .single();

    if (insertErr) {
      return serverError(insertErr);
    }

    // ── 9. Audit log ──
    after(() =>
      logActivity({
        action: "CREATE_DIESEL_RECORD",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "diesel_records",
        recordId: newRecord?.id || null,
        details: {
          vehicle_id: vehicleId,
          fill_type: body.fill_type,
          fuel_litres: fuelLitres,
          current_odo: currentOdo,
          cycle_id: cycleId,
          cycle_status: cycleStatus,
          kml,
        },
      }),
    );

    // ── 10. Notify admin/staff so they can review the record ──
    after(() =>
      notifyRoles({
        roles: ["admin", "staff"],
        type: "diesel_record_created",
        title: "New diesel record",
        body: `${authUser.displayName} logged a diesel fill for vehicle ${vehicle.vehicle_number}`,
        linkPath: `/admin/diesel-records?vehicle_id=${vehicleId}`,
        metadata: { record_id: newRecord?.id, vehicle_id: vehicleId },
        excludeUserId: authUser.id,
      }),
    );

    return apiSuccess(
      {
        id: newRecord?.id,
        cycle_id: cycleId,
        cycle_status: cycleStatus,
        kml,
        dev_pct: devPct,
        cost_per_km: costPerKm,
        warnings,
      },
      "Diesel record created successfully",
      201,
    );
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

// ─── PUT — Update diesel record (admin only) with cycle recalculation ───
export async function PUT(req: Request) {
  try {
    const authUser = await requireStrictAdminAuth();

    const body = await req.json();
    const {
      id,
      driver_name,
      fuel_litres,
      price_per_l,
      station,
      payment_method,
      receipt_number,
      notes,
    } = body;

    if (!id) {
      return apiError("Missing record ID", 400);
    }

    if (!driver_name || !fuel_litres) {
      return apiError("Driver name and fuel litres are required", 400);
    }

    // ── 1. Fetch existing record before update ──
    const { data: existing, error: existingErr } = await supabaseAdmin
      .from("diesel_records")
      .select("*")
      .eq("id", Number(id))
      .single();

    if (existingErr || !existing) {
      return !existing && !existingErr
        ? apiError("Record not found", 404)
        : serverError(existingErr);
    }

    const fuelLitres = Number(fuel_litres);

    let pricePerL = 0;
    if (
      price_per_l !== undefined &&
      price_per_l !== null &&
      price_per_l !== ""
    ) {
      pricePerL = Number(price_per_l);
      if (isNaN(pricePerL) || !isFinite(pricePerL) || pricePerL < 0) {
        return apiError("Invalid price per litre", 400);
      }
    }

    const amount = round2(fuelLitres * pricePerL);

    // ── 2. Update the record ──
    const updatePayload: Record<string, unknown> = {
      driver_name: driver_name.trim(),
      fuel_litres: fuelLitres,
      price_per_l: pricePerL,
      amount,
      station: station?.trim() || null,
      payment_method: payment_method || null,
      receipt_number: receipt_number?.trim() || null,
      notes: notes?.trim() || null,
    };

    const { error } = await supabaseAdmin
      .from("diesel_records")
      .update(updatePayload)
      .eq("id", Number(id));

    if (error) {
      return serverError(error);
    }

    // ── 3. Recalculate cycle if fuel or price changed ──
    const fuelChanged = fuelLitres !== Number(existing.fuel_litres);
    const priceChanged = pricePerL !== Number(existing.price_per_l);

    if (fuelChanged || priceChanged) {
      // Determine which closing record needs recalculation
      let closingRecordId: number | null = null;
      let closingOdo: number;
      let closingFuelLitres: number;
      let closingAmount: number;

      if (existing.cycle_status === "closed") {
        // This record IS the cycle-closing full fill
        closingRecordId = existing.id;
        closingOdo = existing.current_odo;
        closingFuelLitres = fuelLitres; // use new value
        closingAmount = amount; // use new value
      } else {
        // Find the next cycle-closing record after this one
        const { data: nextClosed, error: nextClosedErr } = await supabaseAdmin
          .from("diesel_records")
          .select("id, current_odo, fuel_litres, amount")
          .eq("vehicle_id", existing.vehicle_id)
          .eq("cycle_status", "closed")
          .gt("id", existing.id)
          .order("id", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (nextClosedErr) {
          return serverError(nextClosedErr);
        }

        if (nextClosed) {
          closingRecordId = nextClosed.id;
          closingOdo = nextClosed.current_odo;
          closingFuelLitres = Number(nextClosed.fuel_litres);
          closingAmount = Number(nextClosed.amount);
        }
      }

      if (closingRecordId) {
        // Find the opening full fill (last full fill before the closing one)
        const { data: openingFull, error: openingErr } = await supabaseAdmin
          .from("diesel_records")
          .select("id, current_odo, fill_date")
          .eq("vehicle_id", existing.vehicle_id)
          .eq("fill_type", "full")
          .lt("id", closingRecordId!)
          .order("fill_date", { ascending: false })
          .order("id", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (openingErr) {
          return serverError(openingErr);
        }

        if (openingFull) {
          const cycleDistance = closingOdo! - openingFull.current_odo;

          // Intermediates between opening and closing (DB already has updated values)
          const { data: intermediates, error: intermediatesErr } =
            await supabaseAdmin
              .from("diesel_records")
              .select("fuel_litres, amount")
              .eq("vehicle_id", existing.vehicle_id)
              .gt("id", openingFull.id)
              .lt("id", closingRecordId!)
              .order("id", { ascending: true });

          if (intermediatesErr) {
            return serverError(intermediatesErr);
          }

          const intermediateLitres = intermediates
            ? intermediates.reduce((sum, e) => sum + Number(e.fuel_litres), 0)
            : 0;
          const intermediateAmount = intermediates
            ? intermediates.reduce((sum, e) => sum + Number(e.amount), 0)
            : 0;

          const cycleLitres = intermediateLitres + closingFuelLitres!;
          const cycleAmount = intermediateAmount + closingAmount!;

          // Fetch vehicle expected_kml
          const { data: vehicle, error: vehicleErr } = await supabaseAdmin
            .from("vehicles")
            .select("expected_kml")
            .eq("id", existing.vehicle_id)
            .single();

          if (vehicleErr) {
            return serverError(vehicleErr);
          }

          const expectedKml = vehicle?.expected_kml ?? null;

          let kml: number | null = null;
          let devPct: number | null = null;
          let costPerKm: number | null = null;

          if (cycleDistance > 0 && cycleLitres > 0) {
            kml = round2(cycleDistance / cycleLitres);
            costPerKm = round2(cycleAmount / cycleDistance);
            if (expectedKml && expectedKml > 0) {
              devPct = round2(((kml - expectedKml) / expectedKml) * 100);
            }
          }

          // Update the closing record with recalculated metrics
          const { error: updateMetricsErr } = await supabaseAdmin
            .from("diesel_records")
            .update({
              kml,
              dev_pct: devPct,
              cost_per_km: costPerKm,
              expected_kml: expectedKml,
              cycle_distance: round1(cycleDistance),
              cycle_fuel: round2(cycleLitres),
            })
            .eq("id", closingRecordId);

          if (updateMetricsErr) {
            return serverError(updateMetricsErr);
          }
        }
      }
    }

    after(() =>
      logActivity({
        action: "UPDATE_DIESEL_RECORD",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "diesel_records",
        recordId: Number(id),
        details: updatePayload,
      }),
    );

    return apiSuccess(null, "Record updated");
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

// ── Helpers ──
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// Formats a date for user-facing error messages, e.g. "10 Jul 2026, 01:39 PM".
// Explicit Asia/Kolkata timezone since this runs server-side (unlike the
// client-side en-IN formatters elsewhere, which implicitly rely on the
// browser being in IST) — this is a logistics company operating in India.
function formatDisplayDateTime(date: Date): string {
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

// ─── DELETE — Delete diesel record (admin only) ───
export async function DELETE(req: Request) {
  try {
    const authUser = await requireStrictAdminAuth();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return apiError("Missing record ID", 400);
    }

    const { data: record, error: recordErr } = await supabaseAdmin
      .from("diesel_records")
      .select(
        "id, vehicle_id, driver_name, fill_type, fuel_litres, current_odo, cycle_id",
      )
      .eq("id", Number(id))
      .single();

    if (recordErr || !record) {
      return !record && !recordErr
        ? apiError("Record not found", 404)
        : serverError(recordErr);
    }

    const { error } = await supabaseAdmin
      .from("diesel_records")
      .delete()
      .eq("id", Number(id));

    if (error) {
      return serverError(error);
    }

    after(() =>
      logActivity({
        action: "DELETE_DIESEL_RECORD",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "diesel_records",
        recordId: Number(id),
        details: {
          vehicle_id: record.vehicle_id,
          driver_name: record.driver_name,
          fill_type: record.fill_type,
          fuel_litres: record.fuel_litres,
          current_odo: record.current_odo,
          cycle_id: record.cycle_id,
        },
      }),
    );

    return apiSuccess(null, "Record deleted");
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
