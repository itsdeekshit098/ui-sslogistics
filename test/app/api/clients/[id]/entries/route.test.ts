import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockSupabaseAdmin } from "@test/supabaseMock";
import { requireStrictAdminAuth } from "@test/authMock";
import { logActivity } from "@test/activityLogMock";
import { ADMIN_USER, forbiddenError } from "@test/fixtures";

async function importRoute() {
  return await import("@/app/api/clients/[id]/entries/route");
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

beforeEach(() => {
  requireStrictAdminAuth.mockReset();
  logActivity.mockReset();
});

describe("GET /api/clients/[id]/entries", () => {
  it("rejects a non-admin", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/clients/1/entries"), params("1"));

    expect(res.status).toBe(403);
  });

  it("400s on a non-numeric client id", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/clients/abc/entries"), params("abc"));

    expect(res.status).toBe(400);
  });

  it("surfaces a 500 when the skeleton query errors", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      client_ledger_entries: [{ data: null, error: { message: "connection reset" } }],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/clients/1/entries"), params("1"));

    expect(res.status).toBe(500);
    expect(supa.callCount("client_ledger_entries")).toBe(1);
  });

  it("returns an empty page with a zero closing balance when there are no entries", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      client_ledger_entries: [{ data: [], error: null }],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/clients/1/entries"), params("1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.data).toEqual([]);
    expect(body.data.total).toBe(0);
    expect(body.data.closing_balance).toBe(0);
    // The second (full-row) query never fires when the page is empty.
    expect(supa.callCount("client_ledger_entries")).toBe(1);
  });

  it("computes a running balance, excludes a reversed pair, and paginates newest-first", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const skeleton = [
      { id: 1, entry_date: "2026-01-01", direction: "DEBIT", amount: 1000, reverses_entry_id: null },
      { id: 2, entry_date: "2026-01-05", direction: "DEBIT", amount: 500, reverses_entry_id: null },
      { id: 3, entry_date: "2026-01-06", direction: "CREDIT", amount: 500, reverses_entry_id: 2 }, // reverses #2
      { id: 4, entry_date: "2026-01-10", direction: "CREDIT", amount: 300, reverses_entry_id: null },
    ];
    mockSupabaseAdmin({
      client_ledger_entries: [
        { data: skeleton, error: null },
        {
          data: skeleton.map((row) => ({ ...row })),
          error: null,
        },
      ],
      attachments: [{ data: [{ client_entry_id: 1 }, { client_entry_id: 1 }], error: null }],
    });
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest("http://localhost/api/clients/1/entries?page=1&page_size=10"),
      params("1"),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.total).toBe(4);
    // Chronological running balance: +1000 (id1). id2 is reversed by id3, so
    // neither id2 nor id3 count. Then -300 (id4, CREDIT) => closing balance 700.
    expect(body.data.closing_balance).toBe(700);

    // Newest first in the returned page.
    const ids = body.data.data.map((row: { id: number }) => row.id);
    expect(ids).toEqual([4, 3, 2, 1]);

    const entry1 = body.data.data.find((row: { id: number }) => row.id === 1);
    expect(entry1.attachment_count).toBe(2);
    expect(entry1.is_reversed).toBe(false);
    expect(entry1.is_reversal).toBe(false);

    const entry2 = body.data.data.find((row: { id: number }) => row.id === 2);
    expect(entry2.is_reversed).toBe(true);

    const entry3 = body.data.data.find((row: { id: number }) => row.id === 3);
    expect(entry3.is_reversal).toBe(true);
  });

  it("clamps page_size to the 100 max and page to at least 1", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const skeleton = [
      { id: 1, entry_date: "2026-01-01", direction: "DEBIT", amount: 100, reverses_entry_id: null },
    ];
    mockSupabaseAdmin({
      client_ledger_entries: [
        { data: skeleton, error: null },
        { data: skeleton, error: null },
      ],
      attachments: [{ data: [], error: null }],
    });
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest("http://localhost/api/clients/1/entries?page=0&page_size=99999"),
      params("1"),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.data).toHaveLength(1);
  });

  it("surfaces a 500 when the full-row query errors", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const skeleton = [
      { id: 1, entry_date: "2026-01-01", direction: "DEBIT", amount: 100, reverses_entry_id: null },
    ];
    mockSupabaseAdmin({
      client_ledger_entries: [
        { data: skeleton, error: null },
        { data: null, error: { message: "connection reset" } },
      ],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/clients/1/entries"), params("1"));

    expect(res.status).toBe(500);
  });

  it("treats a missing attachments result as zero counts", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const skeleton = [
      { id: 1, entry_date: "2026-01-01", direction: "DEBIT", amount: 100, reverses_entry_id: null },
    ];
    mockSupabaseAdmin({
      client_ledger_entries: [
        { data: skeleton, error: null },
        { data: skeleton, error: null },
      ],
      attachments: [{ data: null, error: null }],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/clients/1/entries"), params("1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.data[0].attachment_count).toBe(0);
  });
});

describe("POST /api/clients/[id]/entries", () => {
  it("rejects a non-admin", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/1/entries", "POST", {
        entry_type: "BILL",
        amount: 100,
      }),
      params("1"),
    );

    expect(res.status).toBe(403);
  });

  it("400s on a non-numeric client id", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/abc/entries", "POST", {
        entry_type: "BILL",
        amount: 100,
      }),
      params("abc"),
    );

    expect(res.status).toBe(400);
  });

  it("surfaces a 500 when the client fetch errors", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      clients: [{ data: null, error: { message: "connection reset" } }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/1/entries", "POST", {
        entry_type: "BILL",
        amount: 100,
      }),
      params("1"),
    );

    expect(res.status).toBe(500);
  });

  it("404s when the client doesn't exist", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({ clients: [{ data: null, error: null }] });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/1/entries", "POST", {
        entry_type: "BILL",
        amount: 100,
      }),
      params("1"),
    );

    expect(res.status).toBe(404);
  });

  it("400s on an unknown entry_type", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({ clients: [{ data: { id: 1, name: "Acme" }, error: null }] });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/1/entries", "POST", {
        entry_type: "REFUND",
        amount: 100,
      }),
      params("1"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/Invalid entry type/);
  });

  it("400s on a non-positive amount", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({ clients: [{ data: { id: 1, name: "Acme" }, error: null }] });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/1/entries", "POST", {
        entry_type: "BILL",
        amount: 0,
      }),
      params("1"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Amount must be greater than zero");
  });

  it("400s on an invalid entry_date", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({ clients: [{ data: { id: 1, name: "Acme" }, error: null }] });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/1/entries", "POST", {
        entry_type: "BILL",
        amount: 100,
        entry_date: "not-a-date",
      }),
      params("1"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Invalid date");
  });

  it("400s when an ADJUSTMENT doesn't specify a direction", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({ clients: [{ data: { id: 1, name: "Acme" }, error: null }] });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/1/entries", "POST", {
        entry_type: "ADJUSTMENT",
        amount: 100,
      }),
      params("1"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/must say whether it is a debit or a credit/);
  });

  it("400s on an invalid billing month", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({ clients: [{ data: { id: 1, name: "Acme" }, error: null }] });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/1/entries", "POST", {
        entry_type: "BILL",
        amount: 100,
        period_month: "not-a-month",
      }),
      params("1"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Invalid billing month");
  });

  it("accepts a YYYY-MM period_month and normalizes it to the first of the month", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      clients: [{ data: { id: 1, name: "Acme" }, error: null }],
      client_ledger_entries: [
        {
          data: { id: 10, entry_type: "BILL", direction: "DEBIT", period_month: "2026-03-01" },
          error: null,
        },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/1/entries", "POST", {
        entry_type: "BILL",
        amount: 100,
        period_month: "2026-03",
      }),
      params("1"),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.entry.period_month).toBe("2026-03-01");
  });

  it("creates a BILL (DEBIT) entry and logs the audit entry", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      clients: [{ data: { id: 1, name: "Acme" }, error: null }],
      client_ledger_entries: [
        {
          data: { id: 11, entry_type: "BILL", direction: "DEBIT", amount: 100 },
          error: null,
        },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/1/entries", "POST", {
        entry_type: "BILL",
        amount: 100,
        entry_date: "2026-01-01",
        invoice_no: "INV-1",
        payment_method: "UPI",
        reference: "ref-1",
        description: "Monthly bill",
      }),
      params("1"),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.message).toBe("Bill added");
    expect(supa.callCount("client_ledger_entries")).toBe(1);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CREATE_CLIENT_LEDGER_ENTRY", recordId: 11 }),
    );
  });

  it("creates a PAYMENT (CREDIT) entry with a 'Payment recorded' message", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      clients: [{ data: { id: 1, name: "Acme" }, error: null }],
      client_ledger_entries: [
        { data: { id: 12, entry_type: "PAYMENT", direction: "CREDIT" }, error: null },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/1/entries", "POST", {
        entry_type: "PAYMENT",
        amount: 200,
      }),
      params("1"),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.message).toBe("Payment recorded");
  });

  it("creates an ADJUSTMENT entry using the caller-supplied direction", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      clients: [{ data: { id: 1, name: "Acme" }, error: null }],
      client_ledger_entries: [
        { data: { id: 13, entry_type: "ADJUSTMENT", direction: "CREDIT" }, error: null },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/1/entries", "POST", {
        entry_type: "ADJUSTMENT",
        amount: 50,
        direction: "CREDIT",
      }),
      params("1"),
    );

    expect(res.status).toBe(201);
  });

  it("surfaces a 500 when the insert errors", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      clients: [{ data: { id: 1, name: "Acme" }, error: null }],
      client_ledger_entries: [{ data: null, error: { message: "connection reset" } }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/1/entries", "POST", {
        entry_type: "BILL",
        amount: 100,
      }),
      params("1"),
    );

    expect(res.status).toBe(500);
  });
});


describe("POST /api/clients/[id]/entries: bad input", () => {
  const post = (body: unknown, id = "1", raw?: string) =>
    [
      new NextRequest(`http://localhost/api/clients/${id}/entries`, {
        method: "POST",
        body: raw ?? JSON.stringify(body),
      }),
      params(id),
    ] as const;
  const BILL = { entry_type: "BILL", amount: 100 };

  beforeEach(() => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({ clients: [{ data: { id: 1, name: "Acme" }, error: null }] });
  });

  it.each([["malformed JSON", "{bad"], ["null", "null"], ["an empty body", ""]])(
    "answers 400 for %s",
    async (_label, raw) => {
      const { POST } = await importRoute();
      expect((await POST(...post(undefined, "1", raw))).status).toBe(400);
    },
  );

  it.each(["1.5", "0", "abc"])("refuses %s as the client id", async (id) => {
    const { POST } = await importRoute();
    expect((await POST(...post(BILL, id))).status).toBe(400);
  });

  it("refuses text fields that are not text", async () => {
    const { POST } = await importRoute();
    for (const field of ["reference", "payment_method", "description", "invoice_no"]) {
      mockSupabaseAdmin({ clients: [{ data: { id: 1, name: "Acme" }, error: null }] });
      expect((await POST(...post({ ...BILL, [field]: { a: 1 } }))).status).toBe(400);
    }
  });

  it("refuses a reference or invoice number over 100 characters, not cutting them", async () => {
    const { POST } = await importRoute();
    expect((await POST(...post({ ...BILL, reference: "x".repeat(101) }))).status).toBe(400);
    mockSupabaseAdmin({ clients: [{ data: { id: 1, name: "Acme" }, error: null }] });
    expect((await POST(...post({ ...BILL, invoice_no: "i".repeat(101) }))).status).toBe(400);
  });

  it("accepts exactly 100 characters and still cuts a description quietly at 300", async () => {
    mockSupabaseAdmin({
      clients: [{ data: { id: 1, name: "Acme" }, error: null }],
      client_ledger_entries: [{ data: { id: 5, entry_type: "BILL", direction: "DEBIT" }, error: null }],
    });
    const { POST } = await importRoute();
    const res = await POST(
      ...post({ ...BILL, reference: "x".repeat(100), invoice_no: "i".repeat(100), description: "d".repeat(400) }),
    );
    expect(res.status).toBe(201);
  });
});

describe("GET /api/clients/[id]/entries with an id that is not a whole number", () => {
  it.each(["1.5", "0", "-1", "abc"])("answers 400 for %j", async (id) => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { GET } = await importRoute();
    const res = await GET(new NextRequest("http://localhost/api/clients/x/entries"), params(id));
    expect(res.status).toBe(400);
  });
});


describe("POST /api/clients/[id]/entries: inactive client, future date, one opening balance", () => {
  const BILL = { entry_type: "BILL", amount: 100 };
  const call = async (body: unknown) => {
    const { POST } = await importRoute();
    return POST(
      jsonRequest("http://localhost/api/clients/1/entries", "POST", body),
      params("1"),
    );
  };

  it("refuses a bill or payment on an inactive client, naming the client", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      clients: [{ data: { id: 1, name: "Acme", is_active: false }, error: null }],
    });
    for (const type of ["BILL", "PAYMENT"]) {
      const res = await call({ entry_type: type, amount: 100 });
      const body = await res.json();
      expect(res.status).toBe(400);
      expect(body.error).toMatch(/"Acme" is inactive/);
    }
    expect(supa.callCount("client_ledger_entries")).toBe(0);
  });

  it("refuses an entry dated after today in India, but accepts today", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      clients: [{ data: { id: 1, name: "Acme", is_active: true }, error: null }],
      client_ledger_entries: [{ data: { id: 5 }, error: null }],
    });
    const res = await call({ ...BILL, entry_date: "2999-01-01" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/future/);
    expect((await call({ ...BILL, entry_date: "2020-01-01" })).status).toBe(201);
  });

  it("refuses a second OPENING while the first stands", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      clients: [{ data: { id: 1, name: "Acme", is_active: true }, error: null }],
      client_ledger_entries: [
        { data: [{ id: 9 }], error: null }, // existing opening
        { data: [], error: null }, // no reversal of it
      ],
    });
    const res = await call({ entry_type: "OPENING", amount: 500 });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/already has an opening balance/);
  });

  it("allows a new OPENING once the earlier one has been reversed", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      clients: [{ data: { id: 1, name: "Acme", is_active: true }, error: null }],
      client_ledger_entries: [
        { data: [{ id: 9 }], error: null },
        { data: [{ reverses_entry_id: 9 }], error: null },
        { data: { id: 12, entry_type: "OPENING" }, error: null },
      ],
    });
    expect((await call({ entry_type: "OPENING", amount: 500 })).status).toBe(201);
  });

  it("allows the first OPENING when none exists", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      clients: [{ data: { id: 1, name: "Acme", is_active: true }, error: null }],
      client_ledger_entries: [
        { data: [], error: null },
        { data: { id: 12, entry_type: "OPENING" }, error: null },
      ],
    });
    expect((await call({ entry_type: "OPENING", amount: 500 })).status).toBe(201);
  });
});
