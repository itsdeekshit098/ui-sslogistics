import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { mockSupabaseAdmin } from "@test/supabaseMock";
import { requireStrictAdminAuth } from "@test/authMock";
import { logActivity } from "@test/activityLogMock";
import { ADMIN_USER, forbiddenError } from "@test/fixtures";

async function importRoute() {
  return await import("@/app/api/warranty/route");
}

function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

const VALID_PART = {
  vehicle_id: 1,
  part_name: "Battery",
  vendor_id: 1,
  cost: 1500,
  purchase_date: "2026-01-01",
  warranty_duration: 6,
  warranty_duration_unit: "months",
};

beforeEach(() => {
  requireStrictAdminAuth.mockReset();
  logActivity.mockReset();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-15T10:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GET /api/warranty", () => {
  it("rejects when requireStrictAdminAuth fails", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/warranty"));

    expect(res.status).toBe(403);
  });

  it("computes warranty_status per row", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      repair_parts: [
        {
          data: [
            { id: 1, warranty_expiry: "2026-01-01" }, // expired
            { id: 2, warranty_expiry: "2026-07-01" }, // expiring_soon (within 30 days)
            { id: 3, warranty_expiry: "2027-01-01" }, // active
          ],
          error: null,
          count: 3,
        },
      ],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/warranty"));
    const body = await res.json();

    expect(body.data.data[0].warranty_status).toBe("expired");
    expect(body.data.data[1].warranty_status).toBe("expiring_soon");
    expect(body.data.data[2].warranty_status).toBe("active");
  });

  it("surfaces a 500 on a query error", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      repair_parts: [{ data: null, error: { message: "timeout" } }],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/warranty"));

    expect(res.status).toBe(500);
  });
});

describe("POST /api/warranty", () => {
  it("rejects when requireStrictAdminAuth fails", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(jsonRequest("http://localhost/api/warranty", "POST", VALID_PART));

    expect(res.status).toBe(403);
  });

  it("400s on an invalid vehicle_id", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/warranty", "POST", { ...VALID_PART, vehicle_id: -1 }),
    );

    expect(res.status).toBe(400);
  });

  it("400s when part_name is missing", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/warranty", "POST", { ...VALID_PART, part_name: "" }),
    );

    expect(res.status).toBe(400);
  });

  it("400s on an invalid purchase_date", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/warranty", "POST", {
        ...VALID_PART,
        purchase_date: "01-01-2026",
      }),
    );

    expect(res.status).toBe(400);
  });

  it("400s on a non-positive warranty_duration", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/warranty", "POST", { ...VALID_PART, warranty_duration: 0 }),
    );

    expect(res.status).toBe(400);
  });

  it("400s on an invalid warranty_duration_unit", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/warranty", "POST", {
        ...VALID_PART,
        warranty_duration_unit: "days",
      }),
    );

    expect(res.status).toBe(400);
  });

  it("404s when the vehicle does not exist", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      vehicles: [{ data: null, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(jsonRequest("http://localhost/api/warranty", "POST", VALID_PART));

    expect(res.status).toBe(404);
  });

  it("404s when the vendor does not exist", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      vehicles: [{ data: { id: 1 }, error: null }],
      vendors: [{ data: null, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(jsonRequest("http://localhost/api/warranty", "POST", VALID_PART));

    expect(res.status).toBe(404);
  });

  it("creates the part with a computed warranty_expiry and logs the audit entry", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      vehicles: [{ data: { id: 1 }, error: null }],
      vendors: [{ data: { id: 1 }, error: null }],
      repair_parts: [{ data: { id: 10 }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(jsonRequest("http://localhost/api/warranty", "POST", VALID_PART));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.id).toBe(10);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CREATE_REPAIR_PART" }),
    );
  });

  it("rounds cost to 2 decimal places", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      vehicles: [{ data: { id: 1 }, error: null }],
      vendors: [{ data: { id: 1 }, error: null }],
      repair_parts: [{ data: { id: 10 }, error: null }],
    });
    const { POST } = await importRoute();

    await POST(
      jsonRequest("http://localhost/api/warranty", "POST", { ...VALID_PART, cost: 100.999 }),
    );

    expect(supa.callCount("repair_parts")).toBe(1);
  });
});

describe("PUT /api/warranty", () => {
  it("rejects when requireStrictAdminAuth fails", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(jsonRequest("http://localhost/api/warranty", "PUT", { id: 1, ...VALID_PART }));

    expect(res.status).toBe(403);
  });

  it("404s when the part does not exist", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      repair_parts: [{ data: null, error: { code: "PGRST116" } }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(jsonRequest("http://localhost/api/warranty", "PUT", { id: 1, ...VALID_PART }));

    expect(res.status).toBe(404);
  });

  it("400s when trying to move a repair-linked part to a different vehicle", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      repair_parts: [{ data: { id: 1, repair_record_id: 5, vehicle_id: 1 }, error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/warranty", "PUT", { id: 1, ...VALID_PART, vehicle_id: 2 }),
    );

    expect(res.status).toBe(400);
  });

  it("allows updating a repair-linked part when the vehicle is unchanged", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      repair_parts: [
        { data: { id: 1, repair_record_id: 5, vehicle_id: 1 }, error: null },
        { data: { id: 1 }, error: null },
      ],
      vendors: [{ data: { id: 1 }, error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/warranty", "PUT", { id: 1, ...VALID_PART, vehicle_id: 1 }),
    );

    expect(res.status).toBe(200);
  });

  it("404s when the vendor does not exist", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      repair_parts: [{ data: { id: 1, repair_record_id: null, vehicle_id: 1 }, error: null }],
      vendors: [{ data: null, error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(jsonRequest("http://localhost/api/warranty", "PUT", { id: 1, ...VALID_PART }));

    expect(res.status).toBe(404);
  });

  it("updates the part and logs the audit entry", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      repair_parts: [
        { data: { id: 1, repair_record_id: null, vehicle_id: 1 }, error: null },
        { data: { id: 1 }, error: null },
      ],
      vendors: [{ data: { id: 1 }, error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(jsonRequest("http://localhost/api/warranty", "PUT", { id: 1, ...VALID_PART }));

    expect(res.status).toBe(200);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "UPDATE_REPAIR_PART" }),
    );
  });
});

describe("DELETE /api/warranty", () => {
  it("rejects when requireStrictAdminAuth fails", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/warranty?id=1"));

    expect(res.status).toBe(403);
  });

  it("400s on an invalid id", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/warranty?id=abc"));

    expect(res.status).toBe(400);
  });

  it("404s when the part does not exist", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      repair_parts: [{ data: null, error: null }],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/warranty?id=1"));

    expect(res.status).toBe(404);
  });

  it("deletes the part and logs the audit entry", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      repair_parts: [
        { data: { id: 1, part_name: "Battery", vehicle_id: 1 }, error: null },
        { error: null },
      ],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/warranty?id=1"));

    expect(res.status).toBe(200);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DELETE_REPAIR_PART", recordId: 1 }),
    );
  });
});
