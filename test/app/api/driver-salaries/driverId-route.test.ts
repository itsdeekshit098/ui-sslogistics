import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { mockSupabaseAdmin } from "@test/supabaseMock";
import { requireStrictAdminAuth } from "@test/authMock";
import { ADMIN_USER, forbiddenError } from "@test/fixtures";

async function importRoute() {
  return await import("@/app/api/driver-salaries/[driverId]/route");
}

function paramsFor(driverId: string) {
  return { params: Promise.resolve({ driverId }) };
}

beforeEach(() => {
  requireStrictAdminAuth.mockReset();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-15T10:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

const URL = "http://localhost/api/driver-salaries/1";

describe("GET /api/driver-salaries/[driverId]", () => {
  it("rejects when requireStrictAdminAuth fails", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(new NextRequest(URL), paramsFor("1"));

    expect(res.status).toBe(403);
  });

  it("400s on an invalid driver ID", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(new NextRequest(URL), paramsFor("abc"));

    expect(res.status).toBe(400);
  });

  it("400s on an invalid month", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest(`${URL}?month=garbage`),
      paramsFor("1"),
    );

    expect(res.status).toBe(400);
  });

  it("400s when the month hasn't started", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(new NextRequest(`${URL}?month=2026-12`), paramsFor("1"));

    expect(res.status).toBe(400);
  });

  it("404s when the driver does not exist", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      drivers: [{ data: null, error: null }],
      driver_attendance: [{ data: [], error: null }],
      driver_shift_counts: [{ data: [], error: null }],
      driver_salary_rates: [{ data: [], error: null }],
      driver_salary_entries: [{ data: [], error: null }],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest(`${URL}?month=2026-06`), paramsFor("1"));

    expect(res.status).toBe(404);
  });

  it("returns the driver's detail: row, rate history, and entries", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      drivers: [
        { data: { id: 1, name: "Ravi", place: null, is_active: true }, error: null }, // driverRes lookup
        { data: [{ id: 1, name: "Ravi", place: null, is_active: true }], error: null }, // loadMonth's fetchDrivers
      ],
      driver_attendance: [{ data: [], error: null }],
      driver_shift_counts: [{ data: [], error: null }],
      driver_salary_rates: [
        { data: [{ id: 1, driver_id: 1, monthly_salary: "30000", effective_from: "2026-01-01" }], error: null },
      ],
      driver_salary_entries: [
        {
          data: [
            { id: 1, driver_id: 1, entry_type: "ADVANCE", amount: "1000", reverses_entry_id: null },
          ],
          error: null,
        },
      ],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest(`${URL}?month=2026-06`), paramsFor("1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.row.monthly_salary).toBe(30000);
    expect(body.data.rates[0].monthly_salary).toBe(30000);
    expect(body.data.entries[0].amount).toBe(1000);
    expect(body.data.entries[0].is_reversed).toBe(false);
    expect(body.data.entries[0].is_reversal).toBe(false);
  });

  it("marks a reversed entry and its reversal correctly", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      drivers: [
        { data: { id: 1, name: "Ravi", place: null, is_active: true }, error: null },
        { data: [{ id: 1, name: "Ravi", place: null, is_active: true }], error: null },
      ],
      driver_attendance: [{ data: [], error: null }],
      driver_shift_counts: [{ data: [], error: null }],
      driver_salary_rates: [{ data: [], error: null }],
      driver_salary_entries: [
        {
          data: [
            { id: 2, driver_id: 1, entry_type: "ADVANCE", amount: -1000, reverses_entry_id: 1 },
            { id: 1, driver_id: 1, entry_type: "ADVANCE", amount: 1000, reverses_entry_id: null },
          ],
          error: null,
        },
      ],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest(`${URL}?month=2026-06`), paramsFor("1"));
    const body = await res.json();

    const original = body.data.entries.find((e: { id: number }) => e.id === 1);
    const reversal = body.data.entries.find((e: { id: number }) => e.id === 2);
    expect(original.is_reversed).toBe(true);
    expect(reversal.is_reversal).toBe(true);
  });
});
