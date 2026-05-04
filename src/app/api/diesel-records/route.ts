import { after } from "next/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminAuth, requireUserAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activityLog";
import type { CreateDieselPayload } from "@/app/admin/diesel-records/dieselRecords.types";

// ─── GET — Fetch diesel records for a vehicle (paginated) ───
export async function GET(req: Request) {
  try {
    await requireUserAuth();

    const { searchParams } = new URL(req.url);
    const vehicleId = searchParams.get("vehicle_id");
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const pageSize = Math.min(
      100,
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
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data ?? [], total: count ?? 0 });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.startsWith("UNAUTHORIZED"))
      return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof Error && err.message.startsWith("FORBIDDEN"))
      return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 },
    );
  }
}

// ─── POST — Create diesel record with cycle logic ───
export async function POST(req: Request) {
  try {
    const authUser = await requireUserAuth();
    const body: CreateDieselPayload = await req.json();

    // ── 1. Validate required fields ──
    if (
      !body.vehicle_id ||
      !body.driver_name ||
      !body.fill_type ||
      !body.fuel_litres ||
      !body.current_odo
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    if (!["full", "partial"].includes(body.fill_type)) {
      return NextResponse.json(
        { error: "fill_type must be 'full' or 'partial'" },
        { status: 400 },
      );
    }

    const vehicleId = Number(body.vehicle_id);
    const currentOdo = Number(body.current_odo);
    const fuelLitres = Number(body.fuel_litres);
    const pricePerL = Number(body.price_per_l) || 0;

    if (!Number.isFinite(vehicleId) || vehicleId <= 0) {
      return NextResponse.json({ error: "Invalid vehicle ID" }, { status: 400 });
    }
    if (!Number.isFinite(currentOdo) || currentOdo <= 0) {
      return NextResponse.json(
        { error: "Invalid odometer reading (must be a positive number)" },
        { status: 400 },
      );
    }
    if (!Number.isFinite(fuelLitres) || fuelLitres <= 0) {
      return NextResponse.json(
        { error: "Invalid fuel litres (must be a positive number)" },
        { status: 400 },
      );
    }
    if (!Number.isFinite(pricePerL) || pricePerL < 0) {
      return NextResponse.json(
        { error: "Invalid price per litre (must be non-negative)" },
        { status: 400 },
      );
    }

    // ── 2. Fetch vehicle master (expected_kml, tank_capacity) ──
    const { data: vehicle, error: vErr } = await supabaseAdmin
      .from("vehicles")
      .select("id, expected_kml, tank_capacity")
      .eq("id", vehicleId)
      .single();

    if (vErr || !vehicle) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
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
    const { data: lastEntry } = await supabaseAdmin
      .from("diesel_records")
      .select("id, current_odo, cycle_id, fill_type, cycle_status")
      .eq("vehicle_id", vehicleId)
      .order("fill_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    // ── 5. Validate odometer is increasing (also catches duplicates) ──
    // DB unique index on (vehicle_id, current_odo) is the final safety net
    if (lastEntry && currentOdo <= lastEntry.current_odo) {
      return NextResponse.json(
        {
          error: `Odometer must be greater than previous reading (${lastEntry.current_odo} km)`,
        },
        { status: 400 },
      );
    }

    // ── 6. First fill must be a full fill ──
    if (!lastEntry && body.fill_type === "partial") {
      return NextResponse.json(
        { error: "First fill for this vehicle must be a Full fill" },
        { status: 400 },
      );
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
        const { data: lastFullFill } = await supabaseAdmin
          .from("diesel_records")
          .select("id, current_odo, cycle_id, fill_date")
          .eq("vehicle_id", vehicleId)
          .eq("fill_type", "full")
          .order("fill_date", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastFullFill) {
          // There's a previous full fill — we can close the cycle
          const cycleDistance = currentOdo - lastFullFill.current_odo;

          // Sum all litres from entries AFTER the last full fill + this fill
          const { data: cycleEntries } = await supabaseAdmin
            .from("diesel_records")
            .select("fuel_litres, amount")
            .eq("vehicle_id", vehicleId)
            .gt("fill_date", lastFullFill.fill_date)
            .order("fill_date", { ascending: true });

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
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // ── 9. Audit log ──
    after(() =>
      logActivity({
        action: "CREATE_DIESEL_RECORD",
        userId: authUser.id,
        userEmail: authUser.email,
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

    return NextResponse.json(
      {
        message: "Diesel record created successfully",
        id: newRecord?.id,
        cycle_id: cycleId,
        cycle_status: cycleStatus,
        kml,
        dev_pct: devPct,
        cost_per_km: costPerKm,
        warnings,
      },
      { status: 201 },
    );
  } catch (err: unknown) {
    if (err instanceof Error && err.message.startsWith("UNAUTHORIZED"))
      return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof Error && err.message.startsWith("FORBIDDEN"))
      return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 },
    );
  }
}

// ─── PUT — Update diesel record (admin only) with cycle recalculation ───
export async function PUT(req: Request) {
  try {
    const authUser = await requireAdminAuth();

    if (authUser.role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can edit diesel records" },
        { status: 403 },
      );
    }

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
      return NextResponse.json({ error: "Missing record ID" }, { status: 400 });
    }

    if (!driver_name || !fuel_litres) {
      return NextResponse.json(
        { error: "Driver name and fuel litres are required" },
        { status: 400 },
      );
    }

    // ── 1. Fetch existing record before update ──
    const { data: existing } = await supabaseAdmin
      .from("diesel_records")
      .select("*")
      .eq("id", Number(id))
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    const fuelLitres = Number(fuel_litres);
    const pricePerL = Number(price_per_l) || 0;

    if (!Number.isFinite(fuelLitres) || fuelLitres <= 0) {
      return NextResponse.json(
        { error: "Invalid fuel litres (must be a positive number)" },
        { status: 400 },
      );
    }
    if (!Number.isFinite(pricePerL) || pricePerL < 0) {
      return NextResponse.json(
        { error: "Invalid price per litre (must be non-negative)" },
        { status: 400 },
      );
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
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // ── 3. Recalculate cycle if fuel or price changed ──
    const fuelChanged = fuelLitres !== Number(existing.fuel_litres);
    const priceChanged = pricePerL !== Number(existing.price_per_l);

    if (fuelChanged || priceChanged) {
      // Determine which closing record needs recalculation
      let closingRecordId: number | null = null;
      let closingOdo: number;
      let closingFillDate: string;
      let closingFuelLitres: number;
      let closingAmount: number;

      if (existing.cycle_status === "closed") {
        // This record IS the cycle-closing full fill
        closingRecordId = existing.id;
        closingOdo = existing.current_odo;
        closingFillDate = existing.fill_date;
        closingFuelLitres = fuelLitres; // use new value
        closingAmount = amount; // use new value
      } else {
        // Find the next cycle-closing record after this one
        const { data: nextClosed } = await supabaseAdmin
          .from("diesel_records")
          .select("id, current_odo, fill_date, fuel_litres, amount")
          .eq("vehicle_id", existing.vehicle_id)
          .eq("cycle_status", "closed")
          .gt("fill_date", existing.fill_date)
          .order("fill_date", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (nextClosed) {
          closingRecordId = nextClosed.id;
          closingOdo = nextClosed.current_odo;
          closingFillDate = nextClosed.fill_date;
          closingFuelLitres = Number(nextClosed.fuel_litres);
          closingAmount = Number(nextClosed.amount);
        }
      }

      if (closingRecordId) {
        // Find the opening full fill (last full fill before the closing one)
        const { data: openingFull } = await supabaseAdmin
          .from("diesel_records")
          .select("id, current_odo, fill_date")
          .eq("vehicle_id", existing.vehicle_id)
          .eq("fill_type", "full")
          .lt("fill_date", closingFillDate!)
          .neq("id", closingRecordId)
          .order("fill_date", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (openingFull) {
          const cycleDistance = closingOdo! - openingFull.current_odo;

          // Intermediates between opening and closing (DB already has updated values)
          const { data: intermediates } = await supabaseAdmin
            .from("diesel_records")
            .select("fuel_litres, amount")
            .eq("vehicle_id", existing.vehicle_id)
            .gt("fill_date", openingFull.fill_date)
            .lt("fill_date", closingFillDate!)
            .order("fill_date", { ascending: true });

          const intermediateLitres = intermediates
            ? intermediates.reduce((sum, e) => sum + Number(e.fuel_litres), 0)
            : 0;
          const intermediateAmount = intermediates
            ? intermediates.reduce((sum, e) => sum + Number(e.amount), 0)
            : 0;

          const cycleLitres = intermediateLitres + closingFuelLitres!;
          const cycleAmount = intermediateAmount + closingAmount!;

          // Fetch vehicle expected_kml
          const { data: vehicle } = await supabaseAdmin
            .from("vehicles")
            .select("expected_kml")
            .eq("id", existing.vehicle_id)
            .single();

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
          await supabaseAdmin
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
        }
      }
    }

    after(() =>
      logActivity({
        action: "UPDATE_DIESEL_RECORD",
        userId: authUser.id,
        userEmail: authUser.email,
        tableName: "diesel_records",
        recordId: Number(id),
        details: updatePayload,
      }),
    );

    return NextResponse.json({ message: "Record updated" }, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.startsWith("UNAUTHORIZED"))
      return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof Error && err.message.startsWith("FORBIDDEN"))
      return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 },
    );
  }
}

// ── Helpers ──
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ─── DELETE — Delete diesel record (admin only) ───
export async function DELETE(req: Request) {
  try {
    const authUser = await requireAdminAuth();

    // Only admin can delete, not staff
    if (authUser.role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can delete diesel records" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing record ID" }, { status: 400 });
    }

    // ── 1. Fetch record details before deleting ──
    const { data: record, error: fetchErr } = await supabaseAdmin
      .from("diesel_records")
      .select("*")
      .eq("id", Number(id))
      .single();

    if (fetchErr || !record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    const isFirstRecord = record.prev_odo === null;
    let idsToDelete = [Number(id)];
    let nextFullFillId: number | null = null;

    // ── 2. Handle First Record Deletion (Orphan Cleanup) ──
    if (isFirstRecord) {
      // Find subsequent partials that depend on this first record
      const { data: successors } = await supabaseAdmin
        .from("diesel_records")
        .select("id, fill_type")
        .eq("vehicle_id", record.vehicle_id)
        .gt("fill_date", record.fill_date)
        .order("fill_date", { ascending: true });

      if (successors) {
        for (const s of successors) {
          if (s.fill_type === "partial") {
            idsToDelete.push(s.id);
          } else {
            nextFullFillId = s.id;
            break;
          }
        }
      }
    }

    // ── 3. Perform the deletion ──
    const { error: delErr } = await supabaseAdmin
      .from("diesel_records")
      .delete()
      .in("id", idsToDelete);

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    // ── 4. Handle Full Fill ripples (Cycle ID shifting) ──
    if (record.fill_type === "full") {
      // Decrement cycle_id for all remaining future records of this vehicle
      await supabaseAdmin.rpc("decrement_cycle_ids", {
        p_vehicle_id: record.vehicle_id,
        p_after_date: record.fill_date,
      });
    }

    // ── 5. Repair the chain and recalculate efficiency ──
    if (isFirstRecord) {
      // If we deleted the first chain, the next Full Fill is the new 'start'
      if (nextFullFillId) {
        await supabaseAdmin
          .from("diesel_records")
          .update({
            prev_odo: null,
            distance: null,
            cycle_status: "open",
            kml: null,
            dev_pct: null,
            cost_per_km: null,
            cycle_distance: null,
            cycle_fuel: null,
          })
          .eq("id", nextFullFillId);
      }
    } else {
      // NORMAL REPAIR LOGIC (for non-first records)
      // Find the record immediately after the deleted one
      const { data: nextRecord } = await supabaseAdmin
        .from("diesel_records")
        .select("id, current_odo, fill_date")
        .eq("vehicle_id", record.vehicle_id)
        .gt("fill_date", record.fill_date)
        .order("fill_date", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (nextRecord) {
        // Optimization: The new previous odo for the next record is simply the
        // prev_odo of the record we just deleted! We don't need to fetch it.
        const newPrevOdo = record.prev_odo;
        const newDistance =
          newPrevOdo !== null
            ? round1(nextRecord.current_odo - newPrevOdo)
            : null;

        // Update the next record's link
        await supabaseAdmin
          .from("diesel_records")
          .update({
            prev_odo: newPrevOdo,
            distance: newDistance,
          })
          .eq("id", nextRecord.id);

        // Identify the closing record for cycle recalculation
        const { data: closingRecord } = await supabaseAdmin
          .from("diesel_records")
          .select("id, current_odo, fill_date, fuel_litres, amount")
          .eq("vehicle_id", record.vehicle_id)
          .eq("cycle_status", "closed")
          .gte("fill_date", nextRecord.fill_date)
          .order("fill_date", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (closingRecord) {
          const { data: openingFull } = await supabaseAdmin
            .from("diesel_records")
            .select("id, current_odo, fill_date")
            .eq("vehicle_id", record.vehicle_id)
            .eq("fill_type", "full")
            .lt("fill_date", closingRecord.fill_date)
            .neq("id", closingRecord.id)
            .order("fill_date", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (openingFull) {
            const cycleDistance =
              closingRecord.current_odo - openingFull.current_odo;

            const { data: intermediates } = await supabaseAdmin
              .from("diesel_records")
              .select("fuel_litres, amount")
              .eq("vehicle_id", record.vehicle_id)
              .gt("fill_date", openingFull.fill_date)
              .lt("fill_date", closingRecord.fill_date)
              .order("fill_date", { ascending: true });

            const intermediateLitres = intermediates
              ? intermediates.reduce((sum, e) => sum + Number(e.fuel_litres), 0)
              : 0;
            const intermediateAmount = intermediates
              ? intermediates.reduce((sum, e) => sum + Number(e.amount), 0)
              : 0;

            const cycleLitres =
              intermediateLitres + Number(closingRecord.fuel_litres);
            const cycleAmount =
              intermediateAmount + Number(closingRecord.amount);

            const { data: vehicle } = await supabaseAdmin
              .from("vehicles")
              .select("expected_kml")
              .eq("id", record.vehicle_id)
              .single();

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

            await supabaseAdmin
              .from("diesel_records")
              .update({
                kml,
                dev_pct: devPct,
                cost_per_km: costPerKm,
                expected_kml: expectedKml,
                cycle_distance: round1(cycleDistance),
                cycle_fuel: round2(cycleLitres),
                cycle_status: "closed",
              })
              .eq("id", closingRecord.id);
          } else {
            await supabaseAdmin
              .from("diesel_records")
              .update({
                kml: null,
                dev_pct: null,
                cost_per_km: null,
                cycle_distance: null,
                cycle_fuel: null,
                cycle_status: "open",
              })
              .eq("id", closingRecord.id);
          }
        }
      }
    }

    after(() =>
      logActivity({
        action: "DELETE_DIESEL_RECORD",
        userId: authUser.id,
        userEmail: authUser.email,
        tableName: "diesel_records",
        recordId: Number(id),
        details: record,
      }),
    );

    return NextResponse.json(
      { message: "Record deleted and cycles recalculated" },
      { status: 200 },
    );
  } catch (err: unknown) {
    if (err instanceof Error && err.message.startsWith("UNAUTHORIZED"))
      return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof Error && err.message.startsWith("FORBIDDEN"))
      return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 },
    );
  }
}

