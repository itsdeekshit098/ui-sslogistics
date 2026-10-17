import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { mockSupabaseAdmin } from "@test/supabaseMock";
import { requireStrictAdminAuth } from "@test/authMock";
import { ADMIN_USER, forbiddenError } from "@test/fixtures";

async function importRoute() {
  return await import("@/app/api/driver-salaries/export/route");
}

beforeEach(() => {
  requireStrictAdminAuth.mockReset();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-15T10:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GET /api/driver-salaries/export", () => {
  it("rejects when requireStrictAdminAuth fails", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest("http://localhost/api/driver-salaries/export?month=2026-06"),
    );

    expect(res.status).toBe(403);
  });

  it("400s on a missing month", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/driver-salaries/export"));

    expect(res.status).toBe(400);
  });

  it("400s when the month hasn't started", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest("http://localhost/api/driver-salaries/export?month=2026-12"),
    );

    expect(res.status).toBe(400);
  });

  it("returns a CSV with the correct content headers", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      drivers: [{ data: [], error: null }],
      driver_attendance: [{ data: [], error: null }],
      driver_shift_counts: [{ data: [], error: null }],
      driver_salary_rates: [{ data: [], error: null }],
      driver_salary_entries: [{ data: [], error: null }],
      driver_salary_settlements: [{ data: [], error: null }],
    });
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest("http://localhost/api/driver-salaries/export?month=2026-06"),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toMatch(/text\/csv/);
    expect(res.headers.get("Content-Disposition")).toContain("driver_salaries_2026-06.csv");
  });

  it("includes a header row, one row per driver, and a totals row", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      drivers: [{ data: [{ id: 1, name: "Ravi", place: "Chennai", is_active: true }], error: null }],
      driver_attendance: [{ data: [], error: null }],
      driver_shift_counts: [{ data: [], error: null }],
      driver_salary_rates: [
        { data: [{ driver_id: 1, monthly_salary: 30000, effective_from: "2026-01-01" }], error: null },
      ],
      driver_salary_entries: [{ data: [], error: null }],
      driver_salary_settlements: [{ data: [], error: null }],
    });
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest("http://localhost/api/driver-salaries/export?month=2026-06"),
    );
    const text = await res.text();
    const lines = text.replace(/^﻿/, "").split("\r\n");

    expect(lines[0]).toContain("Driver");
    expect(lines[1]).toContain("Ravi");
    expect(lines.at(-1)).toContain("TOTAL");
  });

  it("leaves money cells blank, not zero, for a driver with no salary set", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      drivers: [{ data: [{ id: 1, name: "Ravi", place: null, is_active: true }], error: null }],
      driver_attendance: [{ data: [], error: null }],
      driver_shift_counts: [{ data: [], error: null }],
      driver_salary_rates: [{ data: [], error: null }],
      driver_salary_entries: [{ data: [], error: null }],
      driver_salary_settlements: [{ data: [], error: null }],
    });
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest("http://localhost/api/driver-salaries/export?month=2026-06"),
    );
    const text = await res.text();
    const lines = text.replace(/^﻿/, "").split("\r\n");
    const driverLine = lines[1].split(",");

    // monthly_salary is column index 2 — should be empty, not "0".
    expect(driverLine[2]).toBe("");
  });
});
