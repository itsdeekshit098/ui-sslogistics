import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockSupabaseAdmin } from "@test/supabaseMock";
import { requireStrictAdminAuth } from "@test/authMock";
import { logActivity } from "@test/activityLogMock";
import { ADMIN_USER, forbiddenError } from "@test/fixtures";

async function importRoute() {
  return await import("@/app/api/fundings/route");
}

function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

const VALID_BORROWED_BODY = {
  direction: "BORROWED",
  funder_id: 7,
  start_date: "2026-01-01",
  interest_mode: "PERCENT",
  roi: 2,
  roi_basis: "MONTHLY",
  amount: 100000,
};

const VALID_LENT_BODY = {
  direction: "LENT",
  counterparty_entity_id: 5,
  start_date: "2026-01-01",
  interest_mode: "FIXED",
  fixed_interest_amount: 2000,
  amount: 50000,
};

beforeEach(() => {
  requireStrictAdminAuth.mockReset();
  logActivity.mockReset();
});

describe("GET /api/fundings", () => {
  it("rejects a non-admin the same way requireStrictAdminAuth does", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/fundings"));

    expect(res.status).toBe(403);
  });

  it("lists fundings with computed interest and current rate merged in", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      fundings: [
        {
          data: [
            { id: 1, interest_mode: "PERCENT" },
            { id: 2, interest_mode: "FIXED" },
          ],
          error: null,
          count: 2,
        },
      ],
      funding_entries: [
        {
          data: [
            {
              id: 1,
              funding_id: 1,
              entry_type: "PRINCIPAL_TAKEN",
              amount: 100000,
              entry_date: "2026-01-01",
              reverses_entry_id: null,
            },
          ],
          error: null,
        },
      ],
      funding_rate_history: [
        // consumed inside computeForFundings
        {
          data: [
            {
              funding_id: 1,
              roi: 2,
              roi_basis: "MONTHLY",
              fixed_interest_amount: null,
              effective_from: "2026-01-01",
            },
          ],
          error: null,
        },
        // consumed by the explicit current-rate lookup (funding 2 has no row)
        {
          data: [
            {
              funding_id: 1,
              roi: 2,
              roi_basis: "MONTHLY",
              fixed_interest_amount: null,
              effective_from: "2026-01-01",
            },
          ],
          error: null,
        },
      ],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/fundings"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.total).toBe(2);
    expect(body.data.data[0]).toEqual(
      expect.objectContaining({
        id: 1,
        computed: expect.objectContaining({ principal_taken: 100000 }),
        current_rate: expect.objectContaining({ funding_id: 1 }),
      }),
    );
    // Funding 2 has no matching rate row, so its current_rate falls back to null.
    expect(body.data.data[1]).toEqual(
      expect.objectContaining({ id: 2, current_rate: null }),
    );
  });

  it("skips the bulk entry/rate reads entirely when the page is empty", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      fundings: [{ data: [], error: null, count: 0 }],
      funding_rate_history: [{ data: [], error: null }],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/fundings"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.data).toEqual([]);
    expect(supa.callCount("funding_entries")).toBe(0);
    expect(supa.callCount("funding_rate_history")).toBe(0);
  });

  it("applies status, funder_id, loan_id and direction filters together", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      fundings: [{ data: [], error: null, count: 0 }],
      funding_rate_history: [{ data: [], error: null }],
    });
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest(
        "http://localhost/api/fundings?status=OPEN&funder_id=7&loan_id=3&direction=LENT&page=2&page_size=5",
      ),
    );

    expect(res.status).toBe(200);
  });

  it("clamps page_size to the 1..50 range and page to a minimum of 1", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      fundings: [{ data: [], error: null, count: 0 }],
      funding_rate_history: [{ data: [], error: null }],
    });
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest("http://localhost/api/fundings?page=0&page_size=999"),
    );

    expect(res.status).toBe(200);
  });

  it("surfaces a 500 when the list query errors", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      fundings: [{ data: null, error: { message: "connection reset" } }],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/fundings"));

    expect(res.status).toBe(500);
    expect(supa.callCount("funding_entries")).toBe(0);
  });
});

describe("POST /api/fundings", () => {
  it("rejects a non-admin", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings", "POST", VALID_BORROWED_BODY),
    );

    expect(res.status).toBe(403);
  });

  it("400s on an invalid direction", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings", "POST", {
        ...VALID_BORROWED_BODY,
        direction: "SIDEWAYS",
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/Invalid direction/);
  });

  it("400s when BORROWED has no funder_id", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings", "POST", {
        ...VALID_BORROWED_BODY,
        funder_id: undefined,
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Funder is required");
  });

  it("400s when the selected funder no longer exists", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      lenders: [{ data: null, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings", "POST", VALID_BORROWED_BODY),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Selected funder no longer exists");
  });

  it("400s when LENT has no counterparty_entity_id", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings", "POST", {
        ...VALID_LENT_BODY,
        counterparty_entity_id: undefined,
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Borrower is required");
  });

  it("400s when the selected borrower no longer exists", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      entities: [{ data: null, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings", "POST", VALID_LENT_BODY),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Selected borrower no longer exists");
  });

  it("400s when start_date is missing", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      lenders: [{ data: { id: 7 }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings", "POST", {
        ...VALID_BORROWED_BODY,
        start_date: undefined,
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Start date is required");
  });

  it("400s on an invalid interest_mode", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      lenders: [{ data: { id: 7 }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings", "POST", {
        ...VALID_BORROWED_BODY,
        interest_mode: "COMPOUND",
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/Invalid interest mode/);
  });

  it("400s on a non-positive amount, with a BORROWED-specific message", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      lenders: [{ data: { id: 7 }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings", "POST", {
        ...VALID_BORROWED_BODY,
        amount: 0,
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Amount borrowed must be greater than zero");
  });

  it("400s on a non-positive amount, with a LENT-specific message", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      entities: [{ data: { id: 5 }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings", "POST", {
        ...VALID_LENT_BODY,
        amount: -5,
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Amount lent must be greater than zero");
  });

  it("400s when PERCENT mode has no roi", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      lenders: [{ data: { id: 7 }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings", "POST", {
        ...VALID_BORROWED_BODY,
        roi: undefined,
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Rate of interest is required");
  });

  it("400s on an invalid roi_basis", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      lenders: [{ data: { id: 7 }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings", "POST", {
        ...VALID_BORROWED_BODY,
        roi_basis: "WEEKLY",
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/Invalid ROI basis/);
  });

  it("400s when FIXED mode has no fixed_interest_amount", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      entities: [{ data: { id: 5 }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings", "POST", {
        ...VALID_LENT_BODY,
        fixed_interest_amount: undefined,
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Fixed monthly interest amount is required");
  });

  it("400s on an out-of-range interest_due_day", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      lenders: [{ data: { id: 7 }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings", "POST", {
        ...VALID_BORROWED_BODY,
        interest_due_day: 40,
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Interest due day must be between 1 and 31");
  });

  it("creates a BORROWED funding, its opening rate and principal entry, and logs the audit entry", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      lenders: [{ data: { id: 7 }, error: null }],
      fundings: [{ data: { id: 42 }, error: null }],
      funding_rate_history: [{ error: null }],
      funding_entries: [{ error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings", "POST", {
        ...VALID_BORROWED_BODY,
        interest_due_day: 5,
        notes: "  opening notes  ",
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.funding.id).toBe(42);
    expect(supa.callCount("funding_rate_history")).toBe(1);
    expect(supa.callCount("funding_entries")).toBe(1);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CREATE_FUNDING", recordId: 42 }),
    );
  });

  it("creates a LENT/FIXED funding successfully", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      entities: [{ data: { id: 5 }, error: null }],
      fundings: [{ data: { id: 43 }, error: null }],
      funding_rate_history: [{ error: null }],
      funding_entries: [{ error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings", "POST", VALID_LENT_BODY),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.funding.id).toBe(43);
  });

  it("rolls back the funding when the opening rate insert fails", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      lenders: [{ data: { id: 7 }, error: null }],
      fundings: [{ data: { id: 42 }, error: null }, { error: null }],
      funding_rate_history: [{ error: { message: "constraint violation" } }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings", "POST", VALID_BORROWED_BODY),
    );

    expect(res.status).toBe(500);
    expect(supa.callCount("fundings")).toBe(2);
    expect(logActivity).not.toHaveBeenCalled();
  });

  it("rolls back the funding when the opening principal entry insert fails", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      lenders: [{ data: { id: 7 }, error: null }],
      fundings: [{ data: { id: 42 }, error: null }, { error: null }],
      funding_rate_history: [{ error: null }],
      funding_entries: [{ error: { message: "constraint violation" } }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings", "POST", VALID_BORROWED_BODY),
    );

    expect(res.status).toBe(500);
    expect(supa.callCount("fundings")).toBe(2);
    expect(logActivity).not.toHaveBeenCalled();
  });
});

describe("PUT /api/fundings", () => {
  const EXISTING_FUNDING = { id: 10 };

  it("rejects a non-admin", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/fundings", "PUT", { id: 10, notes: "x" }),
    );

    expect(res.status).toBe(403);
  });

  it("400s when the funding ID is missing", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(jsonRequest("http://localhost/api/fundings", "PUT", {}));

    expect(res.status).toBe(400);
  });

  it("400s on an invalid funder_id", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/fundings", "PUT", { id: 10, funder_id: "abc" }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Invalid funder");
  });

  it("clears borrower_entity_id and linked_loan_id when set to empty string", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      fundings: [{ data: EXISTING_FUNDING, error: null }, { error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/fundings", "PUT", {
        id: 10,
        borrower_entity_id: "",
        linked_loan_id: null,
      }),
    );

    expect(res.status).toBe(200);
  });

  it("sets borrower_entity_id and linked_loan_id when given real values", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      fundings: [{ data: EXISTING_FUNDING, error: null }, { error: null }],
      entities: [{ data: { id: 9 }, error: null }],
      loans: [{ data: { id: 3 }, error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/fundings", "PUT", {
        id: 10,
        borrower_entity_id: 9,
        linked_loan_id: 3,
      }),
    );

    expect(res.status).toBe(200);
  });

  it("400s on an out-of-range interest_due_day and clears it when empty", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/fundings", "PUT", { id: 10, interest_due_day: 99 }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Interest due day must be between 1 and 31");
  });

  it("400s on an invalid status", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/fundings", "PUT", { id: 10, status: "PAUSED" }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/Invalid status/);
  });

  it("400s on an invalid settlement date", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/fundings", "PUT", {
        id: 10,
        status: "SETTLED",
        settled_on: "not-a-date",
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Invalid settlement date");
  });

  it("settles with a default settled_on when none is given", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      fundings: [{ data: EXISTING_FUNDING, error: null }, { error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/fundings", "PUT", { id: 10, status: "SETTLED" }),
    );

    expect(res.status).toBe(200);
  });

  it("clears settled_on when status is set back to OPEN", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      fundings: [{ data: EXISTING_FUNDING, error: null }, { error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/fundings", "PUT", { id: 10, status: "OPEN" }),
    );

    expect(res.status).toBe(200);
  });

  it("400s when notes exceed the max length", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/fundings", "PUT", { id: 10, notes: "x".repeat(501) }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/500 characters or less/);
  });

  it("clears notes when explicitly set to null", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      fundings: [{ data: EXISTING_FUNDING, error: null }, { error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/fundings", "PUT", { id: 10, notes: null }),
    );

    expect(res.status).toBe(200);
  });

  it("400s when no updatable fields are supplied", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(jsonRequest("http://localhost/api/fundings", "PUT", { id: 10 }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("No fields to update");
  });

  it("404s when the funding doesn't exist", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      fundings: [{ data: null, error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/fundings", "PUT", { id: 10, notes: "x" }),
    );

    expect(res.status).toBe(404);
  });

  it("surfaces a 500 when the update query errors", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      fundings: [{ data: null, error: { message: "deadlock" } }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/fundings", "PUT", { id: 10, notes: "x" }),
    );

    expect(res.status).toBe(500);
  });

  it("updates the funding and logs the audit entry", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      fundings: [{ data: EXISTING_FUNDING, error: null }, { error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/fundings", "PUT", { id: 10, notes: "updated" }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.funding.id).toBe(10);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "UPDATE_FUNDING", recordId: 10 }),
    );
  });
});

describe("DELETE /api/fundings", () => {
  it("rejects a non-admin", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/fundings?id=10"));

    expect(res.status).toBe(403);
  });

  it("400s when the funding ID is missing", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({});
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/fundings"));

    expect(res.status).toBe(400);
    expect(supa.from).not.toHaveBeenCalled();
  });

  it("surfaces a 500 when the existence check errors", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      fundings: [{ data: null, error: { message: "connection reset" } }],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/fundings?id=10"));

    expect(res.status).toBe(500);
  });

  it("404s when the funding doesn't exist", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      fundings: [{ data: null, error: null }],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/fundings?id=10"));

    expect(res.status).toBe(404);
  });

  it("surfaces a 500 when the delete itself errors", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      fundings: [
        { data: { id: 10, funder_id: 7 }, error: null },
        { error: { message: "fk violation" } },
      ],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/fundings?id=10"));

    expect(res.status).toBe(500);
  });

  it("deletes the funding and logs the audit entry", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      fundings: [{ data: { id: 10, funder_id: 7 }, error: null }, { error: null }],
      funding_entries: [{ count: 0, error: null }],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/fundings?id=10"));

    expect(res.status).toBe(200);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DELETE_FUNDING", recordId: 10 }),
    );
  });
});

describe("bad input that used to reach the database as a 500", () => {
  const post = (body: unknown, raw?: string) =>
    new NextRequest("http://localhost/api/fundings", {
      method: "POST",
      body: raw ?? JSON.stringify(body),
    });
  const put = (body: unknown, raw?: string) =>
    new NextRequest("http://localhost/api/fundings", {
      method: "PUT",
      body: raw ?? JSON.stringify(body),
    });

  beforeEach(() => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
  });

  it.each([["malformed JSON", "{bad"], ["null", "null"], ["an array", "[]"], ["an empty body", ""]])(
    "POST and PUT answer 400 for %s",
    async (_label, raw) => {
      const { POST, PUT } = await importRoute();
      expect((await POST(post(undefined, raw))).status).toBe(400);
      expect((await PUT(put(undefined, raw))).status).toBe(400);
    },
  );

  it.each([1.5, "1.5", "", "abc", 0, -3])("PUT refuses %j as the funding id", async (id) => {
    const { PUT } = await importRoute();
    const res = await PUT(put({ id, notes: "x" }));
    expect(res.status).toBe(400);
  });

  it.each([1.5, "abc", 0])("POST refuses %j as the funder id", async (funder_id) => {
    const { POST } = await importRoute();
    const res = await POST(post({ ...VALID_BORROWED_BODY, funder_id }));
    expect(res.status).toBe(400);
  });

  it("refuses notes that are not text instead of saving [object Object]", async () => {
    mockSupabaseAdmin({ lenders: [{ data: { id: 7 }, error: null }] });
    const { POST, PUT } = await importRoute();
    const created = await POST(post({ ...VALID_BORROWED_BODY, notes: { a: 1 } }));
    expect(created.status).toBe(400);
    expect((await created.json()).error).toBe("Notes must be text");
    const updated = await PUT(put({ id: 10, notes: { a: 1 } }));
    expect(updated.status).toBe(400);
  });

  it("refuses a linked loan or borrower that is not a whole id, or does not exist", async () => {
    const { PUT } = await importRoute();
    expect((await PUT(put({ id: 10, linked_loan_id: 1.5 }))).status).toBe(400);
    expect((await PUT(put({ id: 10, borrower_entity_id: "x" }))).status).toBe(400);
    expect((await PUT(put({ id: 10, counterparty_entity_id: 2.5 }))).status).toBe(400);

    mockSupabaseAdmin({ loans: [{ data: null, error: null }] });
    const missing = await PUT(put({ id: 10, linked_loan_id: 99999 }));
    expect(missing.status).toBe(400);
    expect((await missing.json()).error).toBe("Selected loan no longer exists");
  });

  it("answers 400, not a database error, when a funder does not exist on update", async () => {
    mockSupabaseAdmin({ lenders: [{ data: null, error: null }] });
    const { PUT } = await importRoute();
    const res = await PUT(put({ id: 10, funder_id: 99999 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Selected funder no longer exists");
  });

  it.each([["funder_id", "abc"], ["funder_id", "1.5"], ["loan_id", "abc"], ["loan_id", "1.5"]])(
    "the list refuses %s=%s",
    async (key, value) => {
      const { GET } = await importRoute();
      const res = await GET(new NextRequest(`http://localhost/api/fundings?${key}=${value}`));
      expect(res.status).toBe(400);
    },
  );

  it.each([["1.5"], ["abc"], ["0"]])("DELETE refuses id=%s", async (id) => {
    const { DELETE } = await importRoute();
    const res = await DELETE(new NextRequest(`http://localhost/api/fundings?id=${id}`, { method: "DELETE" }));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/fundings: unknown filters", () => {
  it.each([["status=BOGUS"], ["direction=SIDEWAYS"], ["status=open"]])(
    "answers 400 for %s instead of an empty list",
    async (query) => {
      requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
      mockSupabaseAdmin({});
      const { GET } = await importRoute();
      const res = await GET(new NextRequest(`http://localhost/api/fundings?${query}`));
      expect(res.status).toBe(400);
    },
  );
});

describe("a failed reference lookup is a 500, not 'no longer exists'", () => {
  it("POST answers 500 when the funder lookup errors", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({ lenders: [{ data: null, error: { message: "timeout" } }] });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings", "POST", VALID_BORROWED_BODY),
    );

    expect(res.status).toBe(500);
  });
});
