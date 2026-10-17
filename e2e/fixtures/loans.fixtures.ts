import { type Page, type Request } from "@playwright/test";

/**
 * Mock fixtures for the Loans module (/admin/loans, loan detail, New Loan
 * modal). Mirrors the conventions in salaries.fixtures.ts: builder
 * functions for the fixture shapes, and an installLoansMocks() that wires
 * page.route("**\/api/**") to an in-memory, mutable store so creates,
 * payments and reversals made during a test are reflected in later reads
 * within that same test.
 */

export const ENTITY_ID = 501;
export const ENTITY_NAME = "Mock Borrower Co";
export const LENDER_ID = 601;
export const LENDER_NAME = "Mock Lender Finance";

export type MockApi = {
  requests: Request[];
  payloads: Array<{ url: string; method: string; body: unknown }>;
};

export function successfulJson(data: unknown) {
  return { success: true, data };
}

function fail(error: string) {
  return { success: false, error };
}

export type LoanFixture = {
  id: number;
  loan_type: string;
  borrower_entity_id: number;
  lender_id: number | null;
  loan_number: string | null;
  vehicle_id: number | null;
  principal_amount: number;
  start_date: string;
  first_emi_date: string;
  emi_amount: number;
  emi_day_of_month: number;
  total_installments: number;
  outstanding_override: number | null;
  status: string;
  notes: string | null;
  created_at: string;
};

export function loanFixture(overrides: Partial<LoanFixture> = {}): LoanFixture {
  return {
    id: 9001,
    loan_type: "PERSONAL",
    borrower_entity_id: ENTITY_ID,
    lender_id: LENDER_ID,
    loan_number: null,
    vehicle_id: null,
    principal_amount: 200000,
    start_date: "2026-01-01",
    first_emi_date: "2026-02-05",
    emi_amount: 20000,
    emi_day_of_month: 5,
    total_installments: 4,
    outstanding_override: null,
    status: "ACTIVE",
    notes: null,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function entityRef(id: number, name: string) {
  return { id, name, entity_kind: "COMPANY", relationship: "EXTERNAL" };
}

function lenderRef(id: number, name: string) {
  return { id, name, lender_kind: "INSTITUTION" };
}

type InstallmentState = {
  id: number;
  loan_id: number;
  installment_no: number;
  due_date: string;
  amount_due: number;
  amount_paid: number;
  amount_remaining: number;
  status: "PENDING" | "PAID" | "WAIVED";
  manual_status: string | null;
};

type PaymentRow = {
  id: number;
  loan_id: number;
  installment_id: number | null;
  payment_type: string;
  amount: number;
  paid_on: string;
  reverses_payment_id: number | null;
  created_at: string;
};

function buildInstallments(loan: LoanFixture): InstallmentState[] {
  const rows: InstallmentState[] = [];
  const first = new Date(`${loan.first_emi_date}T00:00:00Z`);
  for (let i = 0; i < loan.total_installments; i += 1) {
    const due = new Date(first);
    due.setUTCMonth(due.getUTCMonth() + i);
    rows.push({
      id: loan.id * 100 + i + 1,
      loan_id: loan.id,
      installment_no: i + 1,
      due_date: due.toISOString().slice(0, 10),
      amount_due: loan.emi_amount,
      amount_paid: 0,
      amount_remaining: loan.emi_amount,
      status: "PENDING",
      manual_status: null,
    });
  }
  return rows;
}

function computeBalance(loan: LoanFixture, installments: InstallmentState[], payments: PaymentRow[]) {
  const totalPayable = installments.reduce((s, i) => s + i.amount_due, 0);
  const totalPaid = installments.reduce((s, i) => s + i.amount_paid, 0);
  const installmentsPaid = installments.filter((i) => i.status === "PAID").length;
  const unpaid = installments.filter((i) => i.status !== "PAID");
  const nextDue = unpaid[0];
  return {
    loan_id: loan.id,
    total_payable: totalPayable,
    total_paid: totalPaid,
    total_charges: 0,
    outstanding: totalPayable - totalPaid,
    installments_paid: installmentsPaid,
    installments_left: installments.length - installmentsPaid,
    next_due_date: nextDue ? nextDue.due_date : null,
    next_due_amount: nextDue ? nextDue.amount_remaining : null,
    overdue_count: 0,
    overdue_amount: 0,
    final_due_date: installments.length > 0 ? installments[installments.length - 1].due_date : null,
    last_payment_date: payments.length > 0 ? payments[0].paid_on : null,
  };
}

export type MockOptions = Record<string, never>;

export async function installLoansMocks(page: Page, _options: MockOptions = {}): Promise<MockApi> {
  const requests: Request[] = [];
  const payloads: MockApi["payloads"] = [];

  const entities = new Map<number, { id: number; name: string }>([
    [ENTITY_ID, { id: ENTITY_ID, name: ENTITY_NAME }],
  ]);
  const lenders = new Map<number, { id: number; name: string }>([
    [LENDER_ID, { id: LENDER_ID, name: LENDER_NAME }],
  ]);
  const loans = new Map<number, LoanFixture>();
  const installments = new Map<number, InstallmentState[]>();
  const payments = new Map<number, PaymentRow[]>();
  const fundingRefs = new Map<number, number>(); // loanId -> funding count (blocks delete)

  let nextLoanId = 9001;
  let nextPaymentId = 1;

  function seedLoan(loan: LoanFixture) {
    loans.set(loan.id, loan);
    installments.set(loan.id, buildInstallments(loan));
    payments.set(loan.id, []);
  }

  function loanRow(loan: LoanFixture) {
    const inst = installments.get(loan.id) ?? [];
    const pays = payments.get(loan.id) ?? [];
    return {
      ...loan,
      entities: entityRef(loan.borrower_entity_id, entities.get(loan.borrower_entity_id)?.name ?? "Unknown"),
      lenders: loan.lender_id ? lenderRef(loan.lender_id, lenders.get(loan.lender_id)?.name ?? "Unknown") : null,
      vehicles: null,
      bank_accounts: null,
      balance: computeBalance(loan, inst, pays),
    };
  }

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    requests.push(request);
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    let body: unknown = null;
    if (method !== "GET" && method !== "DELETE") {
      try {
        body = request.postDataJSON();
      } catch {
        body = request.postData();
      }
    }
    payloads.push({ url: `${path}${url.search}`, method, body });

    const json = (data: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });

    if (path === "/api/auth/session" && method === "GET") {
      return json(successfulJson({ id: "mock-user", email: "mock@example.test", role: "admin", displayName: "Mock Admin" }));
    }

    // ── Entities typeahead ──
    if (path === "/api/entities" && method === "GET") {
      const search = (url.searchParams.get("search") ?? "").toLowerCase();
      const rows = [...entities.values()].filter((e) => !search || e.name.toLowerCase().includes(search));
      return json(successfulJson({ data: rows.map((e) => entityRef(e.id, e.name)), total: rows.length }));
    }

    // ── Lenders typeahead ──
    if (path === "/api/lenders" && method === "GET") {
      const rows = [...lenders.values()];
      return json(successfulJson({ data: rows.map((l) => lenderRef(l.id, l.name)), total: rows.length }));
    }

    if (path === "/api/bank-accounts" && method === "GET") {
      return json(successfulJson({ data: [], total: 0 }));
    }

    if (path === "/api/vehicles" && method === "GET") {
      return json(successfulJson({ data: [], total: 0 }));
    }

    if (path === "/api/lookups" && method === "GET") {
      const category = url.searchParams.get("category");
      if (category === "loan_type") {
        return json(
          successfulJson({
            data: [{ id: 1, category, label: "Vehicle Loan", value: "Vehicle Loan", is_active: true, sort_order: 0 }],
          }),
        );
      }
      return json(successfulJson({ data: [] }));
    }

    // ── Loans list ──
    if (path === "/api/loans" && method === "GET") {
      const rows = [...loans.values()].map(loanRow);
      const includeSummary = url.searchParams.get("include_summary") === "true";
      const summary = includeSummary
        ? {
            totalOutstanding: rows.reduce((s, r) => s + (r.balance?.outstanding ?? 0), 0),
            totalMonthlyEmi: rows.reduce((s, r) => s + (r.emi_amount ?? 0), 0),
            dueThisMonth: 0,
            overdueCount: 0,
            overdueAmount: 0,
            activeLoans: rows.filter((r) => r.status === "ACTIVE").length,
            openFundings: 0,
            fundingPrincipalOutstanding: 0,
          }
        : undefined;
      return json(successfulJson({ data: rows, total: rows.length, summary }));
    }

    // ── Loans create ──
    if (path === "/api/loans" && method === "POST") {
      const b = body as Record<string, unknown>;
      if (!b.loan_type) return json(fail("Loan type is required"), 400);
      if (!b.borrower_entity_id) return json(fail("Borrower is required"), 400);
      if (typeof b.principal_amount !== "number" || b.principal_amount <= 0) {
        return json(fail("Principal amount must be a positive number"), 400);
      }
      if (!b.start_date) return json(fail("Start date is required"), 400);
      if (!b.first_emi_date) return json(fail("First EMI date is required"), 400);
      if (typeof b.emi_amount !== "number" || b.emi_amount <= 0) {
        return json(fail("Enter the EMI amount"), 400);
      }
      const day = Number(b.emi_day_of_month);
      if (!Number.isInteger(day) || day < 1 || day > 31) {
        return json(fail("EMI day must be between 1 and 31"), 400);
      }
      if (!b.total_installments) return json(fail("Enter the number of installments"), 400);
      if (typeof b.start_date === "string" && typeof b.first_emi_date === "string" && b.first_emi_date < b.start_date) {
        return json(fail("First EMI cannot be before the start date"), 400);
      }

      const id = nextLoanId++;
      const loan = loanFixture({
        id,
        loan_type: String(b.loan_type),
        borrower_entity_id: Number(b.borrower_entity_id),
        lender_id: b.lender_id != null ? Number(b.lender_id) : null,
        loan_number: b.loan_number ? String(b.loan_number) : null,
        principal_amount: Number(b.principal_amount),
        start_date: String(b.start_date),
        first_emi_date: String(b.first_emi_date),
        emi_amount: Number(b.emi_amount),
        emi_day_of_month: day,
        total_installments: Number(b.total_installments),
      });
      seedLoan(loan);
      return json(successfulJson({ loan: { id } }), 201);
    }

    // ── Loan update (schedule-shaping edits) ──
    if (path === "/api/loans" && method === "PUT") {
      const b = body as Record<string, unknown>;
      const id = Number(b.id);
      const loan = loans.get(id);
      if (!loan) return json(fail("Loan not found"), 404);
      if (b.emi_amount != null) loan.emi_amount = Number(b.emi_amount);
      loans.set(id, loan);

      // Rebuild unpaid installments with the new EMI amount, keeping
      // genuinely-paid (non-reversed) ones untouched — mirrors
      // getProtectedInstallmentIds in the real route.
      const pays = payments.get(id) ?? [];
      const reversedIds = new Set(pays.map((p) => p.reverses_payment_id).filter((x): x is number => x != null));
      const protectedInstallmentIds = new Set(
        pays
          .filter((p) => p.reverses_payment_id == null && !reversedIds.has(p.id) && p.installment_id != null)
          .filter((p) => {
            // Only protected if that payment itself wasn't later reversed.
            const wasReversed = pays.some((other) => other.reverses_payment_id === p.id);
            return !wasReversed;
          })
          .map((p) => p.installment_id as number),
      );
      const current = installments.get(id) ?? [];
      const rebuilt = current.map((inst) =>
        protectedInstallmentIds.has(inst.id) ? inst : { ...inst, amount_due: loan.emi_amount, amount_remaining: loan.emi_amount - inst.amount_paid },
      );
      installments.set(id, rebuilt);
      return json(successfulJson({ loan: { id } }));
    }

    // ── Loan delete ──
    if (path === "/api/loans" && method === "DELETE") {
      const id = Number(url.searchParams.get("id"));
      const fundingCount = fundingRefs.get(id) ?? 0;
      if (fundingCount > 0) {
        return json(fail(`Cannot delete this loan because ${fundingCount} private funding(s) are linked to it. Unlink those first.`), 400);
      }
      loans.delete(id);
      installments.delete(id);
      payments.delete(id);
      return json(successfulJson(null));
    }

    // ── Loan detail ──
    const detailMatch = path.match(/^\/api\/loans\/(\d+)$/);
    if (detailMatch && method === "GET") {
      const id = Number(detailMatch[1]);
      const loan = loans.get(id);
      if (!loan) return json(fail("Loan not found"), 404);
      const inst = installments.get(id) ?? [];
      const pays = payments.get(id) ?? [];
      const reversedIds = new Set(pays.map((p) => p.reverses_payment_id).filter((x): x is number => x != null));
      const paymentsWithState = pays.map((p) => ({
        ...p,
        is_reversed: reversedIds.has(p.id),
        is_reversal: p.reverses_payment_id != null,
      }));
      return json(
        successfulJson({
          loan: loanRow(loan),
          balance: computeBalance(loan, inst, pays),
          installments: inst,
          payments: paymentsWithState,
        }),
      );
    }

    // ── Record a payment ──
    const paymentsMatch = path.match(/^\/api\/loans\/(\d+)\/payments$/);
    if (paymentsMatch && method === "POST") {
      const loanId = Number(paymentsMatch[1]);
      const loan = loans.get(loanId);
      if (!loan) return json(fail("Loan not found"), 404);
      const b = body as Record<string, unknown>;
      const amount = Number(b.amount);
      const installmentId = b.installment_id != null ? Number(b.installment_id) : null;

      if (installmentId != null) {
        const inst = (installments.get(loanId) ?? []).find((i) => i.id === installmentId);
        if (!inst) return json(fail("Installment not found"), 404);
        if (inst.status === "PAID") return json(fail("This installment is already fully paid"), 409);
        inst.amount_paid += amount;
        inst.amount_remaining = Math.max(0, inst.amount_due - inst.amount_paid);
        if (inst.amount_remaining <= 0) inst.status = "PAID";
      }

      const payment: PaymentRow = {
        id: nextPaymentId++,
        loan_id: loanId,
        installment_id: installmentId,
        payment_type: String(b.payment_type ?? "EMI"),
        amount,
        paid_on: String(b.paid_on ?? "2026-01-01"),
        reverses_payment_id: null,
        created_at: new Date().toISOString(),
      };
      const list = payments.get(loanId) ?? [];
      list.unshift(payment);
      payments.set(loanId, list);
      return json(successfulJson({ payment }), 201);
    }

    // ── Reverse a payment ──
    const reverseMatch = path.match(/^\/api\/loans\/(\d+)\/payments\/(\d+)\/reverse$/);
    if (reverseMatch && method === "POST") {
      const loanId = Number(reverseMatch[1]);
      const paymentId = Number(reverseMatch[2]);
      const list = payments.get(loanId) ?? [];
      const original = list.find((p) => p.id === paymentId);
      if (!original) return json(fail("Payment not found"), 404);

      if (original.installment_id != null) {
        const inst = (installments.get(loanId) ?? []).find((i) => i.id === original.installment_id);
        if (inst) {
          inst.amount_paid = Math.max(0, inst.amount_paid - original.amount);
          inst.amount_remaining = inst.amount_due - inst.amount_paid;
          inst.status = inst.amount_remaining > 0 ? "PENDING" : "PAID";
        }
      }

      const reversal: PaymentRow = {
        id: nextPaymentId++,
        loan_id: loanId,
        installment_id: original.installment_id,
        payment_type: original.payment_type,
        amount: original.amount,
        paid_on: new Date().toISOString().slice(0, 10),
        reverses_payment_id: paymentId,
        created_at: new Date().toISOString(),
      };
      list.unshift(reversal);
      payments.set(loanId, list);
      return json(successfulJson({ payment: reversal }), 201);
    }

    if (path.startsWith("/api/")) {
      return json(successfulJson({}));
    }

    throw new Error(`Unexpected non-API request passed to API mock: ${request.url()}`);
  });

  return { requests, payloads };
}
