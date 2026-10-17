import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockSupabaseAdmin } from "@test/supabaseMock";
import {
  requireUserAuth,
  requireAdminAuth,
  requireStrictAdminAuth,
} from "@test/authMock";
import { logActivity } from "@test/activityLogMock";
import { ADMIN_USER, forbiddenError } from "@test/fixtures";

async function importRoute() {
  return await import("@/app/api/repair-records/route");
}

function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

const VALID_RECORD = {
  vehicle_id: 1,
  category: "electrical",
  issues: ["Battery"],
  technician_id: 1,
  cost: 1000,
};

const VALID_PART = {
  part_name: "Battery",
  vendor_id: 1,
  cost: 500,
  purchase_date: "2026-01-01",
  warranty_duration: 6,
  warranty_duration_unit: "months",
};

beforeEach(() => {
  requireUserAuth.mockReset();
  requireAdminAuth.mockReset();
  requireStrictAdminAuth.mockReset();
  logActivity.mockReset();
});

describe("GET /api/repair-records", () => {
  it("rejects when requireUserAuth fails", async () => {
    requireUserAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/repair-records"));

    expect(res.status).toBe(403);
  });

  it("includes a summary from the RPC by default", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin(
      { repair_records: [{ data: [], error: null, count: 0 }] },
      {
        get_repair_records_summary: [
          { data: [{ total_count: 3, total_cost: 1500, electrical_cost: 1000, mechanical_cost: 500, open_count: 1, closed_count: 2 }], error: null },
        ],
      },
    );
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/repair-records"));
    const body = await res.json();

    expect(body.data.summary).toEqual({
      totalCount: 3,
      totalCost: 1500,
      electricalCost: 1000,
      mechanicalCost: 500,
      openCount: 1,
      closedCount: 2,
    });
  });

  it("attaches each record's parts via a bulk follow-up query", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin(
      {
        repair_records: [{ data: [{ id: 1 }, { id: 2 }], error: null, count: 2 }],
        repair_parts: [{ data: [{ id: 10, repair_record_id: 1, part_name: "Battery" }], error: null }],
      },
      { get_repair_records_summary: [{ data: [], error: null }] },
    );
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/repair-records"));
    const body = await res.json();

    expect(body.data.data[0].parts).toHaveLength(1);
    expect(body.data.data[1].parts).toEqual([]);
  });

  it("surfaces a 500 when the summary RPC errors", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin(
      {},
      { get_repair_records_summary: [{ data: null, error: { message: "timeout" } }] },
    );
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/repair-records"));

    expect(res.status).toBe(500);
  });
});

describe("POST /api/repair-records", () => {
  it("rejects when requireAdminAuth fails", async () => {
    requireAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(jsonRequest("http://localhost/api/repair-records", "POST", VALID_RECORD));

    expect(res.status).toBe(403);
  });

  it("400s on an invalid category", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/repair-records", "POST", { ...VALID_RECORD, category: "plumbing" }),
    );

    expect(res.status).toBe(400);
  });

  it("400s when issues is empty", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/repair-records", "POST", { ...VALID_RECORD, issues: [] }),
    );

    expect(res.status).toBe(400);
  });

  it("404s when the vehicle does not exist", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      vehicles: [{ data: null, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(jsonRequest("http://localhost/api/repair-records", "POST", VALID_RECORD));

    expect(res.status).toBe(404);
  });

  it("400s when the technician is inactive", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      vehicles: [{ data: { id: 1 }, error: null }],
      technicians: [{ data: { id: 1, is_active: false }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(jsonRequest("http://localhost/api/repair-records", "POST", VALID_RECORD));

    expect(res.status).toBe(400);
  });

  it("400s when a part has an invalid vendor id", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      vehicles: [{ data: { id: 1 }, error: null }],
      technicians: [{ data: { id: 1, is_active: true }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/repair-records", "POST", {
        ...VALID_RECORD,
        parts: [{ ...VALID_PART, vendor_id: -1 }],
      }),
    );

    expect(res.status).toBe(400);
  });

  it("400s when a part's vendor doesn't exist in the DB", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      vehicles: [{ data: { id: 1 }, error: null }],
      technicians: [{ data: { id: 1, is_active: true }, error: null }],
      vendors: [{ data: [], error: null }], // none found
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/repair-records", "POST", {
        ...VALID_RECORD,
        parts: [VALID_PART],
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/Vendor\(s\) not found/);
  });

  it("creates the record with status 'Open' and inserts parts, logging the audit entry", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      vehicles: [{ data: { id: 1 }, error: null }],
      technicians: [{ data: { id: 1, is_active: true }, error: null }],
      vendors: [{ data: [{ id: 1 }], error: null }],
      repair_records: [{ data: { id: 10 }, error: null }],
      repair_parts: [{ error: null }], // insert parts
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/repair-records", "POST", {
        ...VALID_RECORD,
        parts: [VALID_PART],
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.id).toBe(10);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CREATE_REPAIR_RECORD" }),
    );
  });

  it("creates the record with no parts at all", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      vehicles: [{ data: { id: 1 }, error: null }],
      technicians: [{ data: { id: 1, is_active: true }, error: null }],
      repair_records: [{ data: { id: 10 }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(jsonRequest("http://localhost/api/repair-records", "POST", VALID_RECORD));

    expect(res.status).toBe(201);
  });
});

describe("PUT /api/repair-records", () => {
  it("rejects when requireStrictAdminAuth fails", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(jsonRequest("http://localhost/api/repair-records", "PUT", { id: 1 }));

    expect(res.status).toBe(403);
  });

  it("404s when the record does not exist", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      repair_records: [{ data: null, error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(jsonRequest("http://localhost/api/repair-records", "PUT", { id: 1 }));

    expect(res.status).toBe(404);
  });

  it("400s on an invalid status", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      repair_records: [{ data: { id: 1, vehicle_id: 1 }, error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/repair-records", "PUT", { id: 1, status: "Pending" }),
    );

    expect(res.status).toBe(400);
  });

  it("deletes all parts when parts is set to an empty array", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      repair_records: [
        { data: { id: 1, vehicle_id: 1 }, error: null },
        { error: null }, // update
      ],
      repair_parts: [{ error: null }], // delete all
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/repair-records", "PUT", { id: 1, parts: [] }),
    );

    expect(res.status).toBe(200);
    expect(supa.callCount("repair_parts")).toBe(1);
  });

  it("syncs parts: inserts new, updates existing, deletes removed", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      repair_records: [
        { data: { id: 1, vehicle_id: 1 }, error: null },
        { error: null }, // update repair_records
      ],
      vendors: [{ data: [{ id: 1 }], error: null }],
      repair_parts: [
        { data: [{ id: 100 }, { id: 101 }], error: null }, // existing parts (100 kept via update, 101 removed)
        { error: null }, // insert new part (no id)
        { error: null }, // update existing part id=100
        { error: null }, // delete removed part id=101
      ],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/repair-records", "PUT", {
        id: 1,
        parts: [
          { ...VALID_PART }, // new (no id)
          { ...VALID_PART, id: 100 }, // update
        ],
      }),
    );

    expect(res.status).toBe(200);
    expect(supa.callCount("repair_parts")).toBe(4);
  });

  it("updates the record and logs the audit entry", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      repair_records: [
        { data: { id: 1, vehicle_id: 1 }, error: null },
        { error: null },
      ],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/repair-records", "PUT", { id: 1, status: "Closed" }),
    );

    expect(res.status).toBe(200);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "UPDATE_REPAIR_RECORD", recordId: 1 }),
    );
  });
});

describe("DELETE /api/repair-records", () => {
  it("rejects when requireStrictAdminAuth fails", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/repair-records?id=1"));

    expect(res.status).toBe(403);
  });

  it("400s when id is missing", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/repair-records"));

    expect(res.status).toBe(400);
  });

  it("404s when the record does not exist", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      repair_records: [{ data: null, error: null }],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/repair-records?id=1"));

    expect(res.status).toBe(404);
  });

  it("deletes the record and logs the audit entry", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      repair_records: [
        { data: { id: 1, vehicle_id: 1, category: "electrical", issues: ["Battery"], status: "Open", cost: 1000 }, error: null },
        { error: null },
      ],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/repair-records?id=1"));

    expect(res.status).toBe(200);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DELETE_REPAIR_RECORD", recordId: 1 }),
    );
  });
});
