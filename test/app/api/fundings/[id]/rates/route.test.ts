import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockSupabaseAdmin } from "@test/supabaseMock";
import { requireStrictAdminAuth } from "@test/authMock";
import { logActivity } from "@test/activityLogMock";
import { ADMIN_USER, forbiddenError } from "@test/fixtures";

async function importRoute() {
  return await import("@/app/api/fundings/[id]/rates/route");
}

function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

const PERCENT_FUNDING = { id: 10, interest_mode: "PERCENT", start_date: "2026-01-01" };
const FIXED_FUNDING = { id: 10, interest_mode: "FIXED", start_date: "2026-01-01" };

const VALID_PERCENT_BODY = {
  effective_from: "2026-02-01",
  roi: 2.5,
  roi_basis: "MONTHLY",
  note: "Renegotiated rate",
};

const VALID_FIXED_BODY = {
  effective_from: "2026-02-01",
  fixed_interest_amount: 2500,
};

beforeEach(() => {
  requireStrictAdminAuth.mockReset();
  logActivity.mockReset();
});

describe("POST /api/fundings/[id]/rates", () => {
  it("rejects a non-admin the same way requireStrictAdminAuth does", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings/10/rates", "POST", VALID_PERCENT_BODY),
      params("10"),
    );

    expect(res.status).toBe(403);
  });

  it("400s on a non-numeric funding id", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings/abc/rates", "POST", VALID_PERCENT_BODY),
      params("abc"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Invalid funding ID");
  });

  it("404s when the funding doesn't exist", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      fundings: [{ data: null, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings/10/rates", "POST", VALID_PERCENT_BODY),
      params("10"),
    );

    expect(res.status).toBe(404);
  });

  it("surfaces a 500 when the funding lookup errors", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      fundings: [{ data: null, error: { message: "connection reset" } }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings/10/rates", "POST", VALID_PERCENT_BODY),
      params("10"),
    );

    expect(res.status).toBe(500);
  });

  it("400s when effective_from is missing/invalid", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      fundings: [{ data: PERCENT_FUNDING, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings/10/rates", "POST", {
        ...VALID_PERCENT_BODY,
        effective_from: "not-a-date",
      }),
      params("10"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Effective-from date is required");
  });

  it("400s when effective_from is before the funding's start date", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      fundings: [{ data: PERCENT_FUNDING, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings/10/rates", "POST", {
        ...VALID_PERCENT_BODY,
        effective_from: "2025-12-31",
      }),
      params("10"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("A rate cannot take effect before the funding started");
  });

  it("400s when PERCENT mode has no roi", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      fundings: [{ data: PERCENT_FUNDING, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings/10/rates", "POST", {
        ...VALID_PERCENT_BODY,
        roi: undefined,
      }),
      params("10"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Rate of interest is required");
  });

  it("400s on an invalid roi_basis", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      fundings: [{ data: PERCENT_FUNDING, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings/10/rates", "POST", {
        ...VALID_PERCENT_BODY,
        roi_basis: "WEEKLY",
      }),
      params("10"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/Invalid ROI basis/);
  });

  it("400s when FIXED mode has no fixed_interest_amount", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      fundings: [{ data: FIXED_FUNDING, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings/10/rates", "POST", {
        effective_from: "2026-02-01",
      }),
      params("10"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Fixed monthly interest amount is required");
  });

  it("409s when a rate already exists on that effective date", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      fundings: [{ data: PERCENT_FUNDING, error: null }],
      funding_rate_history: [{ data: null, error: { code: "23505", message: "duplicate key" } }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings/10/rates", "POST", VALID_PERCENT_BODY),
      params("10"),
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe("A rate already takes effect on that date");
  });

  it("surfaces a 500 for a non-23505 insert error", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      fundings: [{ data: PERCENT_FUNDING, error: null }],
      funding_rate_history: [{ data: null, error: { code: "23000", message: "constraint violation" } }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings/10/rates", "POST", VALID_PERCENT_BODY),
      params("10"),
    );

    expect(res.status).toBe(500);
  });

  it("records a PERCENT rate change and logs the audit entry", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      fundings: [{ data: PERCENT_FUNDING, error: null }],
      funding_rate_history: [
        {
          data: {
            id: 77,
            funding_id: 10,
            roi: 2.5,
            roi_basis: "MONTHLY",
            effective_from: "2026-02-01",
          },
          error: null,
        },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings/10/rates", "POST", VALID_PERCENT_BODY),
      params("10"),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.rate.id).toBe(77);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CREATE_FUNDING_RATE_CHANGE",
        recordId: 77,
        details: expect.objectContaining({
          funding_id: 10,
          roi: 2.5,
          roi_basis: "MONTHLY",
          effective_from: "2026-02-01",
        }),
      }),
    );
  });

  it("records a FIXED rate change without a note", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      fundings: [{ data: FIXED_FUNDING, error: null }],
      funding_rate_history: [
        {
          data: {
            id: 78,
            funding_id: 10,
            fixed_interest_amount: 2500,
            effective_from: "2026-02-01",
          },
          error: null,
        },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings/10/rates", "POST", VALID_FIXED_BODY),
      params("10"),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.rate.id).toBe(78);
  });
});
