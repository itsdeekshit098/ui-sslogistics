import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockSupabaseAdmin } from "@test/supabaseMock";
import { requireUserAuth, requireAdminAuth } from "@test/authMock";
import { logActivity } from "@test/activityLogMock";
import { ADMIN_USER, forbiddenError } from "@test/fixtures";

async function importRoute() {
  return await import("@/app/api/repair-issues/route");
}

function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, { method, body: JSON.stringify(body) });
}

beforeEach(() => {
  requireUserAuth.mockReset();
  requireAdminAuth.mockReset();
  logActivity.mockReset();
});

describe("GET /api/repair-issues", () => {
  it("rejects when requireUserAuth fails", async () => {
    requireUserAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET();

    expect(res.status).toBe(403);
  });

  it("groups issues by category", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      repair_issue_options: [
        {
          data: [
            { category: "electrical", name: "Battery" },
            { category: "mechanical", name: "Clutch" },
          ],
          error: null,
        },
      ],
    });
    const { GET } = await importRoute();

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.electrical).toEqual(["Battery"]);
    expect(body.data.mechanical).toEqual(["Clutch"]);
  });

  it("surfaces a 500 on a query error", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      repair_issue_options: [{ data: null, error: { message: "timeout" } }],
    });
    const { GET } = await importRoute();

    const res = await GET();

    expect(res.status).toBe(500);
  });
});

describe("POST /api/repair-issues", () => {
  it("rejects when requireAdminAuth fails", async () => {
    requireAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/repair-issues", "POST", {
        name: "Battery",
        category: "electrical",
      }),
    );

    expect(res.status).toBe(403);
  });

  it("400s when name is missing", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/repair-issues", "POST", { category: "electrical" }),
    );

    expect(res.status).toBe(400);
  });

  it("400s on an invalid category", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/repair-issues", "POST", {
        name: "Battery",
        category: "plumbing",
      }),
    );

    expect(res.status).toBe(400);
  });

  it("creates the issue option and logs the audit entry", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      repair_issue_options: [{ data: { id: 1, category: "electrical", name: "Battery" }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/repair-issues", "POST", {
        name: "Battery",
        category: "electrical",
      }),
    );

    expect(res.status).toBe(201);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CREATE_REPAIR_ISSUE" }),
    );
  });

  it("409s when a similar issue already exists in the category", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      repair_issue_options: [{ data: null, error: { code: "23505" } }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/repair-issues", "POST", {
        name: "Battery",
        category: "electrical",
      }),
    );

    expect(res.status).toBe(409);
  });
});
