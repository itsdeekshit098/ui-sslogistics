import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { mockSupabaseAdmin } from "@test/supabaseMock";
import { requireAdminAuth } from "@test/authMock";
import { logActivity } from "@test/activityLogMock";
import { ADMIN_USER } from "@test/fixtures";

function post(body: unknown) {
  return new NextRequest("http://localhost/api/drivers", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const EXISTING = [
  { id: 1, name: "MEHABOOB", place: "Nellore", phone: "9876543210", dl_number: "AP0920190012", is_active: true },
  { id: 2, name: "Ramesh Kumar", place: "Guntur", phone: null, dl_number: null, is_active: true },
  { id: 3, name: "Srinu", place: null, phone: null, dl_number: null, is_active: false },
];

/** The route reads every driver once, then inserts. */
function mockDrivers(inserted = { id: 9, name: "New" }) {
  mockSupabaseAdmin({
    drivers: [
      { data: EXISTING, error: null },
      { data: inserted, error: null },
    ],
  });
}

beforeEach(() => {
  requireAdminAuth.mockReset();
  requireAdminAuth.mockResolvedValue(ADMIN_USER);
  logActivity.mockReset();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-12T05:00:00Z"));
});

describe("POST /api/drivers — the same name twice", () => {
  it("refuses a name that differs only in case", async () => {
    mockDrivers();
    const { POST } = await import("@/app/api/drivers/route");

    const res = await POST(post({ name: "Mehaboob" }));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toContain("MEHABOOB");
    expect(body.error).toContain("already exists");
  });

  it("refuses a name that differs only in spacing", async () => {
    mockDrivers();
    const { POST } = await import("@/app/api/drivers/route");

    const res = await POST(post({ name: "Ramesh  Kumar" }));

    expect(res.status).toBe(409);
  });

  it("names the place and phone so the existing driver is recognisable", async () => {
    mockDrivers();
    const { POST } = await import("@/app/api/drivers/route");

    const body = await (await POST(post({ name: "mehaboob" }))).json();

    expect(body.error).toContain("Nellore");
    expect(body.error).toContain("9876543210");
  });

  it("cannot be waived with confirm_similar", async () => {
    // The warning's "Add anyway" must never let a true duplicate through.
    mockDrivers();
    const { POST } = await import("@/app/api/drivers/route");

    const res = await POST(post({ name: "MEHABOOB", confirm_similar: true }));

    expect(res.status).toBe(409);
  });
});

describe("POST /api/drivers — the same licence", () => {
  it("refuses a repeated DL number even when the name differs", async () => {
    mockDrivers();
    const { POST } = await import("@/app/api/drivers/route");

    const res = await POST(post({ name: "Completely Different", dl_number: "AP0920190012" }));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toContain("DL number");
    expect(body.error).toContain("MEHABOOB");
  });

  it("ignores punctuation and case in the DL", async () => {
    mockDrivers();
    const { POST } = await import("@/app/api/drivers/route");

    const res = await POST(post({ name: "Someone Else", dl_number: "ap09-2019-0012" }));

    expect(res.status).toBe(409);
  });

  it("lets two drivers with no DL through", async () => {
    mockDrivers();
    const { POST } = await import("@/app/api/drivers/route");

    const res = await POST(post({ name: "Prasad Reddy" }));

    expect(res.status).toBe(201);
  });
});

describe("POST /api/drivers — a similar name", () => {
  it("asks rather than refusing, and returns who it matched", async () => {
    mockDrivers();
    const { POST } = await import("@/app/api/drivers/route");

    const res = await POST(post({ name: "MAHABOOB" }));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.code).toBe("SIMILAR_DRIVER_EXISTS");
    expect(body.similar).toEqual([
      expect.objectContaining({ id: 1, name: "MEHABOOB", place: "Nellore" }),
    ]);
    // Nothing was written.
    expect(logActivity).not.toHaveBeenCalled();
  });

  it("goes ahead once the user confirms it is someone else", async () => {
    mockDrivers({ id: 9, name: "MAHABOOB" });
    const { POST } = await import("@/app/api/drivers/route");

    const res = await POST(post({ name: "MAHABOOB", confirm_similar: true }));

    expect(res.status).toBe(201);
  });

  it("flags an inactive driver too — re-adding someone who left is the usual way a duplicate appears", async () => {
    mockDrivers();
    const { POST } = await import("@/app/api/drivers/route");

    const body = await (await POST(post({ name: "Sreenu" }))).json();

    expect(body.code).toBe("SIMILAR_DRIVER_EXISTS");
    expect(body.similar[0]).toMatchObject({ id: 3, name: "Srinu", is_active: false });
  });

  it("does not interrupt a genuinely new name", async () => {
    mockDrivers({ id: 9, name: "Balaji" });
    const { POST } = await import("@/app/api/drivers/route");

    const res = await POST(post({ name: "Balaji" }));

    expect(res.status).toBe(201);
  });
});
