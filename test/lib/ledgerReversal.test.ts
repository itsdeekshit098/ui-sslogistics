import { describe, it, expect, beforeEach } from "vitest";
import { mockSupabaseAdmin } from "@test/supabaseMock";
import { reverseLedgerEntry } from "@/lib/ledgerReversal";

const BASE_OPTS = {
  table: "loan_payments",
  reversesColumn: "reverses_payment_id",
  ownerColumn: "loan_id",
  ownerId: 10,
  entryId: 5,
  selectColumns: "*",
  notFoundMessage: "Payment not found",
  ownerMismatchMessage: "That payment belongs to a different loan",
  alreadyReversedMessage: "This payment has already been reversed",
  buildInsertRow: (original: Record<string, unknown>) => ({
    loan_id: original.loan_id,
    amount: -(original.amount as number),
    reverses_payment_id: original.id,
  }),
};

describe("reverseLedgerEntry", () => {
  beforeEach(() => {});

  it("404s when the original entry does not exist", async () => {
    mockSupabaseAdmin({
      loan_payments: [{ data: null, error: null }],
    });

    const result = await reverseLedgerEntry(BASE_OPTS);

    expect(result.reversal).toBeUndefined();
    expect(result.response?.status).toBe(404);
  });

  it("surfaces a 500 when the original-entry fetch errors", async () => {
    mockSupabaseAdmin({
      loan_payments: [{ data: null, error: { message: "timeout" } }],
    });

    const result = await reverseLedgerEntry(BASE_OPTS);

    expect(result.response?.status).toBe(500);
  });

  it("400s when the entry belongs to a different owner", async () => {
    mockSupabaseAdmin({
      loan_payments: [
        { data: { id: 5, loan_id: 999, amount: 100, reverses_payment_id: null }, error: null },
      ],
    });

    const result = await reverseLedgerEntry(BASE_OPTS);

    expect(result.response?.status).toBe(400);
    const body = await result.response?.json();
    expect(body.error).toBe(BASE_OPTS.ownerMismatchMessage);
  });

  it("400s when attempting to reverse an entry that is itself a reversal", async () => {
    mockSupabaseAdmin({
      loan_payments: [
        { data: { id: 5, loan_id: 10, amount: 100, reverses_payment_id: 1 }, error: null },
      ],
    });

    const result = await reverseLedgerEntry(BASE_OPTS);

    expect(result.response?.status).toBe(400);
    const body = await result.response?.json();
    expect(body.error).toBe("A reversal cannot itself be reversed");
  });

  it("409s when the entry has already been reversed by another row", async () => {
    mockSupabaseAdmin({
      loan_payments: [
        { data: { id: 5, loan_id: 10, amount: 100, reverses_payment_id: null }, error: null },
        { data: { id: 99 }, error: null }, // existing reversal found
      ],
    });

    const result = await reverseLedgerEntry(BASE_OPTS);

    expect(result.response?.status).toBe(409);
  });

  it("inserts the reversal row built by buildInsertRow when nothing blocks it", async () => {
    const supa = mockSupabaseAdmin({
      loan_payments: [
        { data: { id: 5, loan_id: 10, amount: 100, reverses_payment_id: null }, error: null },
        { data: null, error: null }, // no existing reversal
        { data: { id: 6, loan_id: 10, amount: -100, reverses_payment_id: 5 }, error: null }, // insert
      ],
    });

    const result = await reverseLedgerEntry(BASE_OPTS);

    expect(result.response).toBeUndefined();
    expect(result.reversal).toEqual(
      expect.objectContaining({ id: 6, amount: -100, reverses_payment_id: 5 }),
    );
    expect(supa.callCount("loan_payments")).toBe(3);
  });

  it("surfaces a 500 on a generic insert error", async () => {
    mockSupabaseAdmin({
      loan_payments: [
        { data: { id: 5, loan_id: 10, amount: 100, reverses_payment_id: null }, error: null },
        { data: null, error: null },
        { data: null, error: { message: "disk full" } },
      ],
    });

    const result = await reverseLedgerEntry(BASE_OPTS);

    expect(result.response?.status).toBe(500);
  });

  it("maps a unique-constraint violation on insert to the already-reversed 409 (concurrent double reversal)", async () => {
    mockSupabaseAdmin({
      loan_payments: [
        { data: { id: 5, loan_id: 10, amount: 100, reverses_payment_id: null }, error: null },
        { data: null, error: null }, // up-front check passes (race window)
        { data: null, error: { code: "23505" } }, // but the partial unique index catches it
      ],
    });

    const result = await reverseLedgerEntry(BASE_OPTS);

    expect(result.response?.status).toBe(409);
    const body = await result.response?.json();
    expect(body.error).toBe(BASE_OPTS.alreadyReversedMessage);
  });
});
