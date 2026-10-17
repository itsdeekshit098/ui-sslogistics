import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockSupabaseAdmin } from "@test/supabaseMock";
import { requireUserAuth, requireStrictAdminAuth } from "@test/authMock";
import { logActivity } from "@test/activityLogMock";
import { notifyRoles } from "@test/notificationsMock";
import { ADMIN_USER, forbiddenError } from "@test/fixtures";

async function importRoute() {
  return await import("@/app/api/diesel-records/route");
}

function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

const VEHICLE = { id: 1, vehicle_number: "KA01AB1234", expected_kml: 10, tank_capacity: 100 };

beforeEach(() => {
  requireUserAuth.mockReset();
  requireStrictAdminAuth.mockReset();
  logActivity.mockReset();
  notifyRoles.mockReset();
});

describe("GET /api/diesel-records", () => {
  it("rejects when requireUserAuth fails", async () => {
    requireUserAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/diesel-records"));

    expect(res.status).toBe(403);
  });

  it("lists records with pagination", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      diesel_records: [{ data: [{ id: 1 }], error: null, count: 1 }],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/diesel-records"));

    expect(res.status).toBe(200);
  });
});

describe("POST /api/diesel-records", () => {
  it("rejects when requireUserAuth fails", async () => {
    requireUserAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/diesel-records", "POST", {
        vehicle_id: 1,
        driver_name: "Ravi",
        fill_type: "full",
        fuel_litres: 50,
        current_odo: 1000,
      }),
    );

    expect(res.status).toBe(403);
  });

  it("400s when required fields are missing", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/diesel-records", "POST", { vehicle_id: 1 }),
    );

    expect(res.status).toBe(400);
  });

  it("400s on an invalid fill_type", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/diesel-records", "POST", {
        vehicle_id: 1,
        driver_name: "Ravi",
        fill_type: "half",
        fuel_litres: 50,
        current_odo: 1000,
      }),
    );

    expect(res.status).toBe(400);
  });

  it("400s on a zero or negative fuel_litres", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/diesel-records", "POST", {
        vehicle_id: 1,
        driver_name: "Ravi",
        fill_type: "full",
        fuel_litres: 0,
        current_odo: 1000,
      }),
    );

    expect(res.status).toBe(400);
  });

  it("404s when the vehicle does not exist", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      vehicles: [{ data: null, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/diesel-records", "POST", {
        vehicle_id: 1,
        driver_name: "Ravi",
        fill_type: "full",
        fuel_litres: 50,
        current_odo: 1000,
      }),
    );

    expect(res.status).toBe(404);
  });

  it("400s when the first fill for a vehicle is a partial fill", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      vehicles: [{ data: VEHICLE, error: null }],
      diesel_records: [{ data: null, error: null }], // no last entry
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/diesel-records", "POST", {
        vehicle_id: 1,
        driver_name: "Ravi",
        fill_type: "partial",
        fuel_litres: 50,
        current_odo: 1000,
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/must be a Full fill/);
  });

  it("opens cycle 1 on the very first fill for a vehicle", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      vehicles: [{ data: VEHICLE, error: null }],
      diesel_records: [
        { data: null, error: null }, // no last entry
        { data: { id: 10 }, error: null }, // insert
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/diesel-records", "POST", {
        vehicle_id: 1,
        driver_name: "Ravi",
        fill_type: "full",
        fuel_litres: 50,
        current_odo: 1000,
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.cycle_id).toBe(1);
    expect(body.data.cycle_status).toBe("open");
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CREATE_DIESEL_RECORD" }),
    );
    expect(notifyRoles).toHaveBeenCalled();
  });

  it("400s when the odometer reading does not increase from the previous entry", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      vehicles: [{ data: VEHICLE, error: null }],
      diesel_records: [
        { data: { id: 5, current_odo: 1000, cycle_id: 1, fill_type: "full", cycle_status: "open", fill_date: "2026-06-01" }, error: null },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/diesel-records", "POST", {
        vehicle_id: 1,
        driver_name: "Ravi",
        fill_type: "partial",
        fuel_litres: 20,
        current_odo: 900,
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/greater than previous reading/);
  });

  it("400s when fill_date is earlier than the previous entry's date", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      vehicles: [{ data: VEHICLE, error: null }],
      diesel_records: [
        { data: { id: 5, current_odo: 1000, cycle_id: 1, fill_type: "full", cycle_status: "open", fill_date: "2026-06-15" }, error: null },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/diesel-records", "POST", {
        vehicle_id: 1,
        driver_name: "Ravi",
        fill_type: "partial",
        fuel_litres: 20,
        current_odo: 1100,
        fill_date: "2026-06-01",
      }),
    );

    expect(res.status).toBe(400);
  });

  it("keeps the cycle open and carries the same cycle_id on a partial fill", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      vehicles: [{ data: VEHICLE, error: null }],
      diesel_records: [
        { data: { id: 5, current_odo: 1000, cycle_id: 3, fill_type: "full", cycle_status: "open", fill_date: "2026-06-01" }, error: null },
        { data: { id: 11 }, error: null }, // insert
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/diesel-records", "POST", {
        vehicle_id: 1,
        driver_name: "Ravi",
        fill_type: "partial",
        fuel_litres: 20,
        current_odo: 1100,
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.cycle_id).toBe(3);
    expect(body.data.cycle_status).toBe("open");
  });

  it("closes the cycle and computes kml/cost_per_km/dev_pct on a full fill after a previous full fill", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      vehicles: [{ data: VEHICLE, error: null }],
      diesel_records: [
        // last entry (could be partial or full, here a partial just filled)
        { data: { id: 11, current_odo: 1100, cycle_id: 3, fill_type: "partial", cycle_status: "open", fill_date: "2026-06-10" }, error: null },
        // last full fill (opening of current cycle)
        { data: { id: 5, current_odo: 1000, cycle_id: 3, fill_date: "2026-06-01" }, error: null },
        // cycle entries after the opening full fill (the partial fill above)
        { data: [{ fuel_litres: 20, amount: 2000 }], error: null },
        { data: { id: 12 }, error: null }, // insert
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/diesel-records", "POST", {
        vehicle_id: 1,
        driver_name: "Ravi",
        fill_type: "full",
        fuel_litres: 30,
        price_per_l: 100,
        current_odo: 1200,
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.cycle_status).toBe("closed");
    // distance = 1200-1000 = 200; litres = 20+30 = 50; kml = 200/50 = 4
    expect(body.data.kml).toBe(4);
    // amount this fill = 30*100 = 3000; cycleAmount = 2000+3000=5000; cost/km = 5000/200=25
    expect(body.data.cost_per_km).toBe(25);
    // dev_pct = ((4-10)/10)*100 = -60
    expect(body.data.dev_pct).toBe(-60);
    expect(body.data.cycle_id).toBe(4);
  });

  it("opens (not closes) the cycle on a full fill when every prior entry was partial", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      vehicles: [{ data: VEHICLE, error: null }],
      diesel_records: [
        { data: { id: 11, current_odo: 1100, cycle_id: 1, fill_type: "partial", cycle_status: "open", fill_date: "2026-06-10" }, error: null },
        { data: null, error: null }, // no previous full fill at all
        { data: { id: 12 }, error: null }, // insert
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/diesel-records", "POST", {
        vehicle_id: 1,
        driver_name: "Ravi",
        fill_type: "full",
        fuel_litres: 30,
        current_odo: 1200,
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.cycle_status).toBe("open");
    expect(body.data.cycle_id).toBe(1);
  });

  it("warns, but does not block, when fuel added exceeds tank capacity", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      vehicles: [{ data: VEHICLE, error: null }],
      diesel_records: [
        { data: null, error: null },
        { data: { id: 1 }, error: null },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/diesel-records", "POST", {
        vehicle_id: 1,
        driver_name: "Ravi",
        fill_type: "full",
        fuel_litres: 150,
        current_odo: 1000,
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.warnings[0]).toMatch(/exceeds tank capacity/);
  });
});

describe("PUT /api/diesel-records", () => {
  it("rejects when requireStrictAdminAuth fails", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/diesel-records", "PUT", {
        id: 1,
        driver_name: "Ravi",
        fuel_litres: 30,
      }),
    );

    expect(res.status).toBe(403);
  });

  it("400s when driver_name or fuel_litres is missing", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(jsonRequest("http://localhost/api/diesel-records", "PUT", { id: 1 }));

    expect(res.status).toBe(400);
  });

  it("404s when the record does not exist", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      diesel_records: [{ data: null, error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/diesel-records", "PUT", {
        id: 1,
        driver_name: "Ravi",
        fuel_litres: 30,
      }),
    );

    expect(res.status).toBe(404);
  });

  it("updates without recalculating the cycle when fuel/price are unchanged", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      diesel_records: [
        { data: { id: 1, fuel_litres: 30, price_per_l: 100, vehicle_id: 1, cycle_status: "open" }, error: null },
        { error: null }, // update
      ],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/diesel-records", "PUT", {
        id: 1,
        driver_name: "Ravi Updated",
        fuel_litres: 30,
        price_per_l: 100,
      }),
    );

    expect(res.status).toBe(200);
    expect(supa.callCount("diesel_records")).toBe(2);
  });

  it("recalculates the closing cycle's metrics when fuel_litres changes on the closing record itself", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      diesel_records: [
        { data: { id: 1, fuel_litres: 30, price_per_l: 100, vehicle_id: 1, cycle_status: "closed", current_odo: 1200 }, error: null }, // existing
        { error: null }, // update
        { data: { id: 5, current_odo: 1000, fill_date: "2026-06-01" }, error: null }, // opening full fill
        { data: [], error: null }, // intermediates
        { error: null }, // metrics update on closing record
      ],
      vehicles: [{ data: { expected_kml: 10 }, error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/diesel-records", "PUT", {
        id: 1,
        driver_name: "Ravi",
        fuel_litres: 40,
        price_per_l: 100,
      }),
    );

    expect(res.status).toBe(200);
  });

  it("logs the audit entry on a successful update", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      diesel_records: [
        { data: { id: 1, fuel_litres: 30, price_per_l: 100, vehicle_id: 1, cycle_status: "open" }, error: null },
        { error: null },
      ],
    });
    const { PUT } = await importRoute();

    await PUT(
      jsonRequest("http://localhost/api/diesel-records", "PUT", {
        id: 1,
        driver_name: "Ravi",
        fuel_litres: 30,
      }),
    );

    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "UPDATE_DIESEL_RECORD", recordId: 1 }),
    );
  });
});

describe("DELETE /api/diesel-records", () => {
  it("rejects when requireStrictAdminAuth fails", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/diesel-records?id=1"));

    expect(res.status).toBe(403);
  });

  it("400s when id is missing", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/diesel-records"));

    expect(res.status).toBe(400);
  });

  it("404s when the record does not exist", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      diesel_records: [{ data: null, error: null }],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/diesel-records?id=1"));

    expect(res.status).toBe(404);
  });

  it("deletes the record and logs the audit entry", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      diesel_records: [
        { data: { id: 1, vehicle_id: 1, driver_name: "Ravi", fill_type: "full", fuel_litres: 30, current_odo: 1000, cycle_id: 1 }, error: null },
        { error: null },
      ],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/diesel-records?id=1"));

    expect(res.status).toBe(200);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DELETE_DIESEL_RECORD", recordId: 1 }),
    );
  });
});
