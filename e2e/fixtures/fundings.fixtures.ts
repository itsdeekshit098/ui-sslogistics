import { type Page, type Request } from "@playwright/test";
import { successfulJson, failJson } from "./mockEnvelope";

/**
 * Mocked-API fixtures for the Private Fundings suite, mirroring
 * salaries.fixtures.ts's conventions: an in-memory store keyed by funding id
 * so creates/reads/mutations stay consistent within one test, served through
 * page.route() instead of a real Supabase-backed Next.js API.
 */

export const LENDER_ID = 501;
export const LENDER_NAME = "Mock Funder Ramesh";
export const FUNDING_ID = 701;

export type MockOptions = {
  /** Seed an OPEN funding (id FUNDING_ID) with ₹1,00,000 principal at 2%/month
   * borrowed on 2026-06-10, as the detail-page suite needs. */
  seedFunding?: boolean;
};

export type MockApi = {
  requests: Request[];
  payloads: Array<{ url: string; method: string; body: unknown }>;
};

export interface MockFundingEntry {
  id: number;
  funding_id: number;
  entry_type: "PRINCIPAL_TAKEN" | "PRINCIPAL_REPAID" | "INTEREST_PAID" | "ADJUSTMENT";
  amount: number;
  entry_date: string;
  payment_method: string | null;
  reference: string | null;
  description: string | null;
  reverses_entry_id: number | null;
  created_at: string;
  is_reversed: boolean;
  is_reversal: boolean;
}

export interface MockFundingRate {
  id: number;
  funding_id: number;
  roi: number | null;
  roi_basis: "MONTHLY" | "ANNUAL" | null;
  fixed_interest_amount: number | null;
  effective_from: string;
  note: string | null;
  created_at: string;
}

export interface MockFunding {
  id: number;
  funder_id: number | null;
  borrower_entity_id: number | null;
  counterparty_entity_id: number | null;
  direction: "BORROWED" | "LENT";
  linked_loan_id: number | null;
  interest_mode: "PERCENT" | "FIXED";
  interest_due_day: number | null;
  start_date: string;
  status: "OPEN" | "SETTLED";
  settled_on: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
  lenders: { id: number; name: string; lender_kind: string; phone: string | null } | null;
  borrower: { id: number; name: string; entity_kind: string } | null;
  counterparty: { id: number; name: string; entity_kind: string } | null;
  loans: null;
}

export function lenderFixture(overrides: Partial<{ id: number; name: string }> = {}) {
  return {
    id: LENDER_ID,
    name: LENDER_NAME,
    lender_kind: "PRIVATE",
    phone: "9876500000",
    contact_person: null,
    notes: null,
    is_active: true,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function fundingFixture(overrides: Partial<MockFunding> = {}): MockFunding {
  return {
    id: FUNDING_ID,
    funder_id: LENDER_ID,
    borrower_entity_id: null,
    counterparty_entity_id: null,
    direction: "BORROWED",
    linked_loan_id: null,
    interest_mode: "PERCENT",
    interest_due_day: null,
    start_date: "2026-06-10",
    status: "OPEN",
    settled_on: null,
    notes: null,
    created_at: "2026-06-10T00:00:00.000Z",
    updated_at: null,
    lenders: { id: LENDER_ID, name: LENDER_NAME, lender_kind: "PRIVATE", phone: "9876500000" },
    borrower: null,
    counterparty: null,
    loans: null,
    ...overrides,
  };
}

/**
 * Minimal re-implementation of the day-prorated simple-interest engine in
 * fundings.utils.ts, scoped to exactly the shapes this suite seeds (one
 * PERCENT-mode funding, a single rate in force at a time). It is not a
 * faithful port of computeFunding's month-bucketed, day-by-day loop — see
 * the final report for exactly where it diverges — but it reproduces the
 * same totals for the entries/rates this store ever holds, which is what the
 * detail page actually renders.
 */
function computeMock(
  entries: MockFundingEntry[],
  rates: MockFundingRate[],
  interestMode: "PERCENT" | "FIXED",
  asOf = "2026-06-10",
) {
  const live = entries.filter(
    (e) => e.reverses_entry_id == null && !entries.some((r) => r.reverses_entry_id === e.id),
  );
  const principalTaken = live
    .filter((e) => e.entry_type === "PRINCIPAL_TAKEN")
    .reduce((s, e) => s + e.amount, 0);
  const principalRepaid = live
    .filter((e) => e.entry_type === "PRINCIPAL_REPAID")
    .reduce((s, e) => s + e.amount, 0);
  const adjustments = live
    .filter((e) => e.entry_type === "ADJUSTMENT")
    .reduce((s, e) => s + e.amount, 0);
  const interestPaid = live
    .filter((e) => e.entry_type === "INTEREST_PAID")
    .reduce((s, e) => s + e.amount, 0);
  const principalOutstanding = Math.max(principalTaken - principalRepaid - adjustments, 0);

  const sortedRates = [...rates].sort((a, b) => a.effective_from.localeCompare(b.effective_from));
  const currentRate = sortedRates.filter((r) => r.effective_from <= asOf).pop() ?? null;
  const monthlyRatePct =
    currentRate?.roi == null
      ? 0
      : currentRate.roi_basis === "ANNUAL"
        ? currentRate.roi / 12
        : currentRate.roi;
  const monthlyInterest =
    interestMode === "FIXED"
      ? Number(currentRate?.fixed_interest_amount ?? 0)
      : (principalOutstanding * monthlyRatePct) / 100;

  // Simplified day-prorated accrual: days since the first PRINCIPAL_TAKEN
  // entry, charged at the rate in force "today" (asOf) on the principal
  // outstanding "today" — good enough for the fixtures this suite seeds
  // (one opening principal, at most one rate change), not a general port.
  const firstTaken = live.find((e) => e.entry_type === "PRINCIPAL_TAKEN");
  let accrued = 0;
  if (firstTaken) {
    const start = new Date(firstTaken.entry_date);
    const end = new Date(asOf);
    const days = Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000));
    accrued = (principalOutstanding * (monthlyRatePct / 100) * days) / 30;
  }

  return {
    principal_taken: principalTaken,
    principal_repaid: principalRepaid,
    principal_outstanding: principalOutstanding,
    interest_accrued: Math.round(accrued * 100) / 100,
    interest_paid: Math.round(interestPaid * 100) / 100,
    interest_due: Math.round((accrued - interestPaid) * 100) / 100,
    monthly_interest: Math.round(monthlyInterest * 100) / 100,
    total_due: Math.round((principalOutstanding + accrued - interestPaid) * 100) / 100,
    monthly_breakdown: [] as unknown[],
  };
}

export async function installFundingsMocks(page: Page, options: MockOptions = {}): Promise<MockApi> {
  const requests: Request[] = [];
  const payloads: MockApi["payloads"] = [];

  const lenders = [lenderFixture()];
  const fundings = new Map<number, MockFunding>();
  const entriesByFunding = new Map<number, MockFundingEntry[]>();
  const ratesByFunding = new Map<number, MockFundingRate[]>();

  let nextFundingId = FUNDING_ID + 1;
  let nextEntryId = 1;
  let nextRateId = 1;

  const seedOne = (id: number, startDate = "2026-06-10") => {
    fundings.set(id, fundingFixture({ id, start_date: startDate }));
    entriesByFunding.set(id, [
      {
        id: nextEntryId++,
        funding_id: id,
        entry_type: "PRINCIPAL_TAKEN",
        amount: 100000,
        entry_date: startDate,
        payment_method: null,
        reference: null,
        description: "Amount borrowed",
        reverses_entry_id: null,
        created_at: `${startDate}T00:00:00.000Z`,
        is_reversed: false,
        is_reversal: false,
      },
    ]);
    ratesByFunding.set(id, [
      {
        id: nextRateId++,
        funding_id: id,
        roi: 2,
        roi_basis: "MONTHLY",
        fixed_interest_amount: null,
        effective_from: startDate,
        note: "Opening rate",
        created_at: `${startDate}T00:00:00.000Z`,
      },
    ]);
  };

  if (options.seedFunding) seedOne(FUNDING_ID);

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

    if (path === "/api/auth/session" && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          successfulJson({
            id: "mock-user",
            email: "mock@example.test",
            role: "admin",
            displayName: "Mock Admin",
          }),
        ),
      });
    }

    if (path === "/api/lenders" && method === "GET") {
      const kind = url.searchParams.get("lender_kind");
      const list = kind ? lenders.filter((l) => l.lender_kind === kind) : lenders;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(successfulJson({ data: list })),
      });
    }

    if (path === "/api/entities" && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(successfulJson({ data: [], total: 0 })),
      });
    }

    if (path === "/api/fundings" && method === "GET") {
      const direction = url.searchParams.get("direction");
      let list = [...fundings.values()];
      if (direction) list = list.filter((f) => f.direction === direction);
      const withComputed = list.map((f) => {
        const entries = entriesByFunding.get(f.id) ?? [];
        const rates = ratesByFunding.get(f.id) ?? [];
        const computed = computeMock(entries, rates, f.interest_mode, f.start_date >= "2026-06-10" ? f.start_date : undefined);
        return {
          ...f,
          computed,
          current_rate: rates.length > 0 ? rates[rates.length - 1] : null,
        };
      });
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(successfulJson({ data: withComputed, total: withComputed.length })),
      });
    }

    if (path === "/api/fundings" && method === "POST") {
      const values = body as Record<string, unknown>;
      const id = nextFundingId++;
      const funderId = values.funder_id != null ? Number(values.funder_id) : null;
      const lender = funderId ? lenders.find((l) => l.id === funderId) ?? null : null;
      const funding = fundingFixture({
        id,
        funder_id: funderId,
        counterparty_entity_id:
          values.counterparty_entity_id != null ? Number(values.counterparty_entity_id) : null,
        borrower_entity_id:
          values.borrower_entity_id != null ? Number(values.borrower_entity_id) : null,
        direction: (values.direction as "BORROWED" | "LENT") ?? "BORROWED",
        interest_mode: (values.interest_mode as "PERCENT" | "FIXED") ?? "PERCENT",
        interest_due_day:
          values.interest_due_day != null ? Number(values.interest_due_day) : null,
        start_date: String(values.start_date ?? "2026-06-10"),
        notes: values.notes ? String(values.notes) : null,
        lenders: lender
          ? { id: lender.id, name: lender.name, lender_kind: lender.lender_kind, phone: lender.phone }
          : null,
      });
      fundings.set(id, funding);

      const entryId = nextEntryId++;
      entriesByFunding.set(id, [
        {
          id: entryId,
          funding_id: id,
          entry_type: "PRINCIPAL_TAKEN",
          amount: Number(values.amount),
          entry_date: String(values.start_date ?? "2026-06-10"),
          payment_method: null,
          reference: null,
          description: funding.direction === "LENT" ? "Amount lent" : "Amount borrowed",
          reverses_entry_id: null,
          created_at: new Date().toISOString(),
          is_reversed: false,
          is_reversal: false,
        },
      ]);
      ratesByFunding.set(id, [
        {
          id: nextRateId++,
          funding_id: id,
          roi: values.roi != null ? Number(values.roi) : null,
          roi_basis: (values.roi_basis as "MONTHLY" | "ANNUAL" | null) ?? null,
          fixed_interest_amount:
            values.fixed_interest_amount != null ? Number(values.fixed_interest_amount) : null,
          effective_from: String(values.start_date ?? "2026-06-10"),
          note: "Opening rate",
          created_at: new Date().toISOString(),
        },
      ]);

      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(successfulJson({ funding: { id } }, "Funding added")),
      });
    }

    if (path === "/api/fundings" && method === "DELETE") {
      const id = Number(url.searchParams.get("id"));
      fundings.delete(id);
      entriesByFunding.delete(id);
      ratesByFunding.delete(id);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(successfulJson(null, "Funding deleted")),
      });
    }

    const detailMatch = path.match(/^\/api\/fundings\/(\d+)$/);
    if (detailMatch && method === "GET") {
      const id = Number(detailMatch[1]);
      const funding = fundings.get(id);
      if (!funding) {
        return route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify(failJson("Funding not found")),
        });
      }
      const entries = entriesByFunding.get(id) ?? [];
      const rates = ratesByFunding.get(id) ?? [];
      // "Today" for accrual purposes — enough days after the seeded
      // start_date (2026-06-10) that interest_due is a real positive
      // number, so the "Pay Interest" modal's prefilled amount passes its
      // own >0 validation instead of silently failing to close.
      const computed = computeMock(entries, rates, funding.interest_mode, "2026-07-10");
      // Newest first, same ordering the real route returns.
      const sortedEntries = [...entries].sort(
        (a, b) => b.entry_date.localeCompare(a.entry_date) || b.id - a.id,
      );
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          successfulJson({
            funding,
            rates,
            entries: sortedEntries,
            computed,
          }),
        ),
      });
    }

    const entriesMatch = path.match(/^\/api\/fundings\/(\d+)\/entries$/);
    if (entriesMatch && method === "POST") {
      const id = Number(entriesMatch[1]);
      const values = body as Record<string, unknown>;
      const entry: MockFundingEntry = {
        id: nextEntryId++,
        funding_id: id,
        entry_type: values.entry_type as MockFundingEntry["entry_type"],
        amount: Number(values.amount),
        entry_date: String(values.entry_date ?? "2026-06-10"),
        payment_method: values.payment_method ? String(values.payment_method) : null,
        reference: values.reference ? String(values.reference) : null,
        description: values.description ? String(values.description) : null,
        reverses_entry_id: null,
        created_at: new Date().toISOString(),
        is_reversed: false,
        is_reversal: false,
      };
      const list = entriesByFunding.get(id) ?? [];
      list.push(entry);
      entriesByFunding.set(id, list);
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(successfulJson({ entry }, "Entry recorded")),
      });
    }

    const reverseMatch = path.match(/^\/api\/fundings\/(\d+)\/entries\/(\d+)\/reverse$/);
    if (reverseMatch && method === "POST") {
      const id = Number(reverseMatch[1]);
      const entryId = Number(reverseMatch[2]);
      const list = entriesByFunding.get(id) ?? [];
      const original = list.find((e) => e.id === entryId);
      if (!original) {
        return route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify(failJson("Entry not found")),
        });
      }
      if (original.is_reversed || list.some((e) => e.reverses_entry_id === entryId)) {
        return route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify(failJson("This entry has already been reversed")),
        });
      }
      const reversal: MockFundingEntry = {
        id: nextEntryId++,
        funding_id: id,
        entry_type: original.entry_type,
        amount: original.amount,
        entry_date: new Date().toISOString().slice(0, 10),
        payment_method: null,
        reference: null,
        description: `Reversal of #${entryId}`,
        reverses_entry_id: entryId,
        created_at: new Date().toISOString(),
        is_reversed: false,
        is_reversal: true,
      };
      original.is_reversed = true;
      list.push(reversal);
      entriesByFunding.set(id, list);
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(successfulJson({ entry: reversal }, "Entry reversed")),
      });
    }

    const ratesMatch = path.match(/^\/api\/fundings\/(\d+)\/rates$/);
    if (ratesMatch && method === "POST") {
      const id = Number(ratesMatch[1]);
      const values = body as Record<string, unknown>;
      const funding = fundings.get(id);
      const existing = ratesByFunding.get(id) ?? [];
      if (existing.some((r) => r.effective_from === String(values.effective_from))) {
        return route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify(failJson("A rate already takes effect on that date")),
        });
      }
      const rate: MockFundingRate = {
        id: nextRateId++,
        funding_id: id,
        roi: values.roi != null ? Number(values.roi) : null,
        roi_basis: (values.roi_basis as "MONTHLY" | "ANNUAL" | null) ?? null,
        fixed_interest_amount:
          values.fixed_interest_amount != null ? Number(values.fixed_interest_amount) : null,
        effective_from: String(values.effective_from),
        note: values.note ? String(values.note) : null,
        created_at: new Date().toISOString(),
      };
      existing.push(rate);
      ratesByFunding.set(id, existing);
      void funding;
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(successfulJson({ rate }, "Rate change recorded")),
      });
    }

    if (path.startsWith("/api/")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(successfulJson({})),
      });
    }

    throw new Error(`Unexpected non-API request passed to API mock: ${request.url()}`);
  });

  return { requests, payloads };
}
