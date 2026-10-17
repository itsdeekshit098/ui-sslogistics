import { type Page, type Request } from "@playwright/test";
import type {
  SalaryDriverDetail,
  SalaryEntry,
  SalaryRow,
  SalarySheet,
} from "@/components/salariesPage/salariesPage.types";
import { successfulJson } from "./mockEnvelope";

export const DRIVER_ID = 101;
export const UNSALARIED_DRIVER_ID = 102;
export const TODAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
export const CURRENT_MONTH = TODAY.slice(0, 7);
export const INITIAL_MONTH = "2026-06";

export type MockOptions = {
  failListOnce?: boolean;
  failDetailOnce?: boolean;
  failNextMutation?: string;
  failExport?: boolean;
  emptySheet?: boolean;
};

export type MockApi = {
  requests: Request[];
  payloads: Array<{ url: string; method: string; body: unknown }>;
};

export function salaryRow(overrides: Partial<SalaryRow> = {}): SalaryRow {
  return {
    driver_id: DRIVER_ID,
    name: "Ravi Kumar",
    place: "Chennai",
    is_active: true,
    monthly_salary: 30000,
    days_present: 28,
    absent_days: 2,
    leave_days: 0,
    unmarked_days: 0,
    unpaid_days: 2,
    attendance_cut: 2000,
    advances: 0,
    deductions: 0,
    net_pay: 28000,
    carry_forward_in: 0,
    is_settled: false,
    ...overrides,
  };
}

export function sheetFixture(month: string, rows: SalaryRow[] = [salaryRow()]): SalarySheet {
  const salaried = rows.filter((row) => row.monthly_salary != null);
  return {
    month,
    today: TODAY,
    days_in_month: 30,
    is_provisional: month === CURRENT_MONTH,
    drivers: rows,
    totals: {
      monthly_salary: salaried.reduce((sum, row) => sum + (row.monthly_salary ?? 0), 0),
      attendance_cut: salaried.reduce((sum, row) => sum + row.attendance_cut, 0),
      advances: salaried.reduce((sum, row) => sum + row.advances, 0),
      deductions: salaried.reduce((sum, row) => sum + row.deductions, 0),
      net_pay: salaried.reduce((sum, row) => sum + (row.net_pay ?? 0), 0),
      drivers_without_salary: rows.filter((row) => row.monthly_salary == null).length,
    },
  };
}

export function initialDetail(month = INITIAL_MONTH): SalaryDriverDetail {
  return {
    month,
    days_in_month: 30,
    is_provisional: false,
    row: salaryRow(),
    rates: [
      {
        id: 1,
        driver_id: DRIVER_ID,
        monthly_salary: 30000,
        effective_from: "2026-01-01",
        note: null,
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ],
    entries: [],
    settlement: null,
  };
}

export function unsalariedDetail(month = INITIAL_MONTH): SalaryDriverDetail {
  return {
    ...initialDetail(month),
    row: salaryRow({
      driver_id: UNSALARIED_DRIVER_ID,
      name: "Meena Iyer",
      place: "Coimbatore",
      monthly_salary: null,
      attendance_cut: 0,
      net_pay: null,
      days_present: 0,
      absent_days: 0,
      unpaid_days: 0,
    }),
    rates: [],
  };
}

export function rowFor(detail: SalaryDriverDetail): SalaryRow {
  return { ...detail.row };
}

export async function installSalaryMocks(page: Page, options: MockOptions = {}): Promise<MockApi> {
  const requests: Request[] = [];
  const payloads: MockApi["payloads"] = [];
  const details = new Map<number, SalaryDriverDetail>([
    [DRIVER_ID, initialDetail()],
    [UNSALARIED_DRIVER_ID, unsalariedDetail()],
  ]);
  let failListOnce = options.failListOnce ?? false;
  let failedDetailAttempts = options.failDetailOnce ? 2 : 0;
  let failNextMutation = options.failNextMutation ?? null;
  let nextEntryId = 20;
  let nextSettlementId = 30;

  const fail = (message: string) => ({
    success: false,
    error: message,
  });

  const updateSheetRow = (driverId: number) => {
    const detail = details.get(driverId);
    if (!detail) return;
    const index = sheetRows.findIndex((row) => row.driver_id === driverId);
    if (index >= 0) sheetRows[index] = rowFor(detail);
  };

  const sheetRows = options.emptySheet
    ? []
    : [
        salaryRow(),
        salaryRow({
          driver_id: UNSALARIED_DRIVER_ID,
          name: "Meena Iyer",
          place: "Coimbatore",
          monthly_salary: null,
          attendance_cut: 0,
          net_pay: null,
          days_present: 0,
          absent_days: 0,
          unpaid_days: 0,
        }),
        salaryRow({
          driver_id: 103,
          name: "Arun Das",
          place: "Chennai",
          is_active: false,
          is_settled: true,
          advances: 3000,
          net_pay: 25000,
        }),
      ];

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

    if (path === "/api/driver-salaries" && method === "GET") {
      if (failListOnce) {
        failListOnce = false;
        return route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify(fail("Mock salary sheet error")),
        });
      }
      const requestedMonth = url.searchParams.get("month") ?? INITIAL_MONTH;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(successfulJson(sheetFixture(requestedMonth, sheetRows))),
      });
    }

    if (path === "/api/driver-salaries/export" && method === "GET") {
      if (options.failExport) {
        return route.fulfill({ status: 500, body: "Mock export error" });
      }
      return route.fulfill({
        status: 200,
        contentType: "text/csv",
        headers: { "content-disposition": "attachment; filename=salary-mock.csv" },
        body: "Driver,Monthly Salary,Net Pay\nRavi Kumar,30000,28000\n",
      });
    }

    const detailMatch = path.match(/^\/api\/driver-salaries\/(\d+)$/);
    if (detailMatch && method === "GET") {
      if (failedDetailAttempts > 0) {
        failedDetailAttempts -= 1;
        return route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify(fail("Mock driver detail error")),
        });
      }
      const driverId = Number(detailMatch[1]);
      const detail = details.get(driverId);
      if (!detail) {
        return route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify(fail("Driver not found")),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(successfulJson({ ...detail, month: url.searchParams.get("month") ?? detail.month })),
      });
    }

    const ratesMatch = path.match(/^\/api\/driver-salaries\/(\d+)\/rates$/);
    const entriesMatch = path.match(/^\/api\/driver-salaries\/(\d+)\/entries$/);
    const settleMatch = path.match(/^\/api\/driver-salaries\/(\d+)\/settle$/);
    const reverseMatch = path.match(
      /^\/api\/driver-salaries\/(\d+)\/entries\/(\d+)\/reverse$/,
    );
    const undoSettleMatch = path.match(
      /^\/api\/driver-salaries\/(\d+)\/settle\/(\d+)$/,
    );
    const isMutation =
      method === "POST" &&
      (ratesMatch || entriesMatch || settleMatch || reverseMatch);
    const isUndo = method === "DELETE" && undoSettleMatch;

    if (isMutation || isUndo) {
      const expectedFailure = failNextMutation;
      if (expectedFailure && path.includes(expectedFailure)) {
        failNextMutation = null;
        return route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify(fail("Mock save rejected")),
        });
      }
    }

    if (ratesMatch && method === "POST") {
      const detail = details.get(Number(ratesMatch[1]));
      const values = body as { monthly_salary: number; effective_month: string };
      if (detail) {
        detail.row.monthly_salary = values.monthly_salary;
        detail.row.net_pay =
          values.monthly_salary - detail.row.attendance_cut - detail.row.advances - detail.row.deductions;
        detail.rates.unshift({
          id: nextEntryId++,
          driver_id: detail.row.driver_id,
          monthly_salary: values.monthly_salary,
          effective_from: `${values.effective_month}-01`,
          note: null,
          created_at: new Date().toISOString(),
        });
        updateSheetRow(detail.row.driver_id);
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(successfulJson({})),
      });
    }

    if (entriesMatch && method === "POST") {
      const detail = details.get(Number(entriesMatch[1]));
      const values = body as {
        entry_type: SalaryEntry["entry_type"];
        amount: number;
        entry_date: string;
        period_month: string;
        description: string | null;
      };
      if (detail) {
        const entry: SalaryEntry = {
          id: nextEntryId++,
          driver_id: detail.row.driver_id,
          entry_type: values.entry_type,
          amount: values.amount,
          entry_date: values.entry_date,
          period_month: `${values.period_month}-01`,
          description: values.description,
          reverses_entry_id: null,
          created_at: new Date().toISOString(),
          is_reversed: false,
          is_reversal: false,
          is_carry_forward: false,
        };
        detail.entries.unshift(entry);
        if (entry.entry_type === "ADVANCE") detail.row.advances += entry.amount;
        else detail.row.deductions += entry.amount;
        detail.row.net_pay =
          (detail.row.monthly_salary ?? 0) -
          detail.row.attendance_cut -
          detail.row.advances -
          detail.row.deductions;
        updateSheetRow(detail.row.driver_id);
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(successfulJson({})),
      });
    }

    if (reverseMatch && method === "POST") {
      const detail = details.get(Number(reverseMatch[1]));
      const entryId = Number(reverseMatch[2]);
      const entry = detail?.entries.find((item) => item.id === entryId);
      if (detail && entry && !entry.is_reversed) {
        entry.is_reversed = true;
        detail.entries.unshift({
          ...entry,
          id: nextEntryId++,
          reverses_entry_id: entry.id,
          is_reversed: false,
          is_reversal: true,
          created_at: new Date().toISOString(),
        });
        if (entry.entry_type === "ADVANCE") detail.row.advances -= entry.amount;
        else detail.row.deductions -= entry.amount;
        detail.row.net_pay =
          (detail.row.monthly_salary ?? 0) -
          detail.row.attendance_cut -
          detail.row.advances -
          detail.row.deductions;
        updateSheetRow(detail.row.driver_id);
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(successfulJson({})),
      });
    }

    if (settleMatch && method === "POST") {
      const detail = details.get(Number(settleMatch[1]));
      const values = body as { period_month: string; amount_paid: number; note: string | null };
      if (detail) {
        const netPay = detail.row.net_pay ?? 0;
        detail.settlement = {
          id: nextSettlementId++,
          period_month: `${values.period_month}-01`,
          net_pay_computed: netPay,
          amount_paid: values.amount_paid,
          note: values.note,
          carry_forward: values.amount_paid - netPay,
          carry_forward_entry_id: null,
          created_at: new Date().toISOString(),
        };
        detail.row.is_settled = true;
        updateSheetRow(detail.row.driver_id);
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(successfulJson({})),
      });
    }

    if (undoSettleMatch && method === "DELETE") {
      const detail = details.get(Number(undoSettleMatch[1]));
      if (detail) {
        detail.settlement = null;
        detail.row.is_settled = false;
        updateSheetRow(detail.row.driver_id);
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(successfulJson({})),
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
