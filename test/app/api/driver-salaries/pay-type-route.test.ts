import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockSupabaseAdmin } from "@test/supabaseMock";
import { requireStrictAdminAuth, requireUserAuth } from "@test/authMock";
import { ADMIN_USER, STAFF_USER, forbiddenError, unauthorizedError } from "@test/fixtures";

async function importRoute() {
  return await import("@/app/api/driver-salaries/[driverId]/pay-type/route");
}

const URL = "http://localhost/api/driver-salaries/1/pay-type";
const params = (driverId = "1") => ({ params: Promise.resolve({ driverId }) });
const get = () => new NextRequest(URL);

const HISTORY = [
  {
    id: 7,
    driver_id: 1,
    pay_type: "PER_TRIP",
    rate_per_trip: "850.00",
    effective_from: "2026-10-01",
    note: null,
    created_at: "2026-10-01T00:00:00Z",
  },
];

beforeEach(() => {
  requireStrictAdminAuth.mockReset();
  requireUserAuth.mockReset();
});

describe("GET /api/driver-salaries/[driverId]/pay-type", () => {
  // The history carries rate_per_trip — pay — so only admins may read it,
  // like every other salary method. Staff and drivers get the pay *type*
  // from /api/driver-attendance instead.
  it("refuses staff and drivers without returning the rate", async () => {
    requireUserAuth.mockResolvedValue(STAFF_USER); // the old, too-loose check would let this through
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({ driver_pay_types: [{ data: HISTORY }] });
    const { GET } = await importRoute();

    const res = await GET(get(), params());
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(JSON.stringify(body)).not.toContain("850");
  });

  it("refuses a signed-out request", async () => {
    requireStrictAdminAuth.mockRejectedValue(unauthorizedError());
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(get(), params());

    expect(res.status).toBe(401);
  });

  it("returns the history with the rate as a number for an admin", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({ driver_pay_types: [{ data: HISTORY }] });
    const { GET } = await importRoute();

    const res = await GET(get(), params());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.payTypes[0]).toMatchObject({ pay_type: "PER_TRIP", rate_per_trip: 850 });
  });

  it("400s on an id that isn't a whole number above zero", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    for (const id of ["0", "-1", "1.5", "abc"]) {
      expect((await GET(get(), params(id))).status).toBe(400);
    }
  });

  it("answers an empty history until sql/51 is applied", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({ driver_pay_types: [{ error: { code: "PGRST205" } }] });
    const { GET } = await importRoute();

    const body = await (await GET(get(), params())).json();

    expect(body.data.payTypes).toEqual([]);
  });
});
