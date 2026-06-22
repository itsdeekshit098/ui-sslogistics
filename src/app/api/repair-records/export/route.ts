import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase";
import { requireUserAuth } from "@/lib/auth";
import type { RepairCategory } from "@/components/repairRecordsPage";

const VALID_CATEGORIES: RepairCategory[] = ["electrical", "mechanical"];

// Helper to escape CSV values (quotes strings containing commas or quotes)
function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  const str = String(value);
  if (str.includes(",") || str.includes("\"") || str.includes("\\n")) {
    return `"${str.replace(/"/g, "\"\"")}"`;
  }
  return str;
}

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

    // ── Unpaginated data query ──
    let query = supabaseAdmin
      .from("repair_records")
      .select(
        "*, vehicles(vehicle_number, company, model), technicians(id, name, phone, specializations)"
      )
      .order("repair_date", { ascending: false })
      .order("id", { ascending: false });

    if (vehicleId) {
      const vehicleIdNum = Number(vehicleId);
      if (!Number.isFinite(vehicleIdNum)) {
        return new Response(JSON.stringify({ error: "Invalid vehicle_id" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      query = query.eq("vehicle_id", vehicleIdNum);
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

    // Since this is an export, we should set a reasonable upper limit to prevent memory issues, e.g., 10,000 records
    const { data, error } = await query.limit(10000);

    if (error) {
      logger.error("Database error during export", { error: error.message, code: error?.code, hint: error?.hint });
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const records = data ?? [];

    // ── Format as CSV ──
    const headers = [
      "Repair ID",
      "Date",
      "Vehicle Number",
      "Category",
      "Issues",
      "Status",
      "Cost (₹)",
      "Technician Name",
      "Description"
    ];

    const csvRows = [];
    csvRows.push(headers.join(","));

    for (const row of records) {
      const [datePart] = row.repair_date ? row.repair_date.split("T") : [""];
      const issuesString = Array.isArray(row.issues) ? row.issues.join("; ") : "";
      const vehicleNumber = row.vehicles?.vehicle_number || "";
      const technicianName = row.technicians?.name || "";

      const csvRow = [
        row.id,
        datePart,
        vehicleNumber,
        row.category || "",
        issuesString,
        row.status || "",
        row.cost || 0,
        technicianName,
        row.description || ""
      ].map(escapeCsvValue);

      csvRows.push(csvRow.join(","));
    }

    const csvContent = csvRows.join("\n");

    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=\"repair_records.csv\"",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });

  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message.startsWith("UNAUTHORIZED")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (err.message.startsWith("FORBIDDEN")) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    logger.error("Failed to export CSV", { error: err });
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
