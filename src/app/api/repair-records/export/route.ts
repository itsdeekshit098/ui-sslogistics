import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminAuth } from "@/lib/auth";
import { apiError, handleApiError, serverError } from "@/lib/apiResponse";
import type { RepairCategory } from "@/components/repairRecordsPage";

const VALID_CATEGORIES: RepairCategory[] = ["electrical", "mechanical"];

// Helper to escape CSV values (quotes strings containing delimiters/newlines)
function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  let str = String(value);
  // Neutralize spreadsheet formula injection (=, +, -, @, tab, CR at the start
  // of user-controlled text). Numbers are left untouched so costs render as-is.
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, "\"\"")}"`;
  }
  return str;
}

export async function GET(req: Request) {
  try {
    await requireAdminAuth();

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
        "id, repair_date, category, issues, status, cost, description, vehicles(vehicle_number), technicians(name)"
      )
      .order("repair_date", { ascending: false })
      .order("id", { ascending: false });

    if (vehicleId) {
      const vehicleIdNum = Number(vehicleId);
      if (!Number.isFinite(vehicleIdNum)) {
        return apiError("Invalid vehicle_id", 400);
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
      return serverError(error);
    }

    // PostgREST returns to-one embeds as objects at runtime, but without FK
    // metadata in the generated types they are inferred as arrays — cast.
    type ExportRow = {
      id: number;
      repair_date: string | null;
      category: string | null;
      issues: unknown;
      status: string | null;
      cost: number | null;
      description: string | null;
      vehicles: { vehicle_number: string | null } | null;
      technicians: { name: string | null } | null;
    };
    const records = (data ?? []) as unknown as ExportRow[];

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
    return handleApiError(err);
  }
}
