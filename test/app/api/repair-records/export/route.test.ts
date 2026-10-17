import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockSupabaseAdmin } from "@test/supabaseMock";
import { requireAdminAuth } from "@test/authMock";
import { ADMIN_USER, forbiddenError } from "@test/fixtures";

async function importRoute() {
  return await import("@/app/api/repair-records/export/route");
}

beforeEach(() => {
  requireAdminAuth.mockReset();
});

describe("GET /api/repair-records/export", () => {
  it("rejects when requireAdminAuth fails", async () => {
    requireAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/repair-records/export"));

    expect(res.status).toBe(403);
  });

  it("400s on an invalid vehicle_id", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      repair_records: [{ data: [], error: null }],
    });
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest("http://localhost/api/repair-records/export?vehicle_id=abc"),
    );

    expect(res.status).toBe(400);
  });

  it("returns CSV headers", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      repair_records: [{ data: [], error: null }],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/repair-records/export"));

    expect(res.headers.get("Content-Type")).toMatch(/text\/csv/);
    expect(res.headers.get("Content-Disposition")).toContain("repair_records.csv");
  });

  it("includes a header row and one row per record with embedded vehicle/technician names", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      repair_records: [
        {
          data: [
            {
              id: 1,
              repair_date: "2026-06-01T00:00:00Z",
              category: "electrical",
              issues: ["Battery", "Lights"],
              status: "Open",
              cost: 1500,
              description: "Replaced battery",
              vehicles: { vehicle_number: "KA01AB1234" },
              technicians: { name: "Tech A" },
            },
          ],
          error: null,
        },
      ],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/repair-records/export"));
    const text = await res.text();
    const lines = text.split("\n");

    expect(lines[0]).toContain("Repair ID");
    expect(lines[1]).toContain("KA01AB1234");
    expect(lines[1]).toContain("Battery; Lights");
    expect(lines[1]).toContain("Tech A");
  });

  it("handles a record with no vehicle/technician/description gracefully", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      repair_records: [
        {
          data: [
            {
              id: 2,
              repair_date: null,
              category: null,
              issues: null,
              status: null,
              cost: null,
              description: null,
              vehicles: null,
              technicians: null,
            },
          ],
          error: null,
        },
      ],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/repair-records/export"));

    expect(res.status).toBe(200);
  });

  it("surfaces a 500 on a query error", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      repair_records: [{ data: null, error: { message: "timeout" } }],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/repair-records/export"));

    expect(res.status).toBe(500);
  });
});
