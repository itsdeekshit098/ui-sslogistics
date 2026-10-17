import { type Page, type Request } from "@playwright/test";

/**
 * Fully-mocked fixtures for the entities/lenders/lookup-options e2e spec.
 * Mirrors the conventions in salaries.fixtures.ts: an in-memory mutable
 * store behind page.route(), no real backend, no login.
 */

export type EntityRow = {
  id: number;
  name: string;
  entity_kind: "FIRM" | "PERSON";
  relationship: "INTERNAL" | "EXTERNAL";
  proprietor_entity_id: number | null;
  proprietor_name: string | null;
  phone: string | null;
  email: string | null;
  pan: string | null;
  gst_number: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type LenderRow = {
  id: number;
  name: string;
  lender_kind: "INSTITUTION" | "PRIVATE";
  phone: string | null;
  contact_person: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
};

export type LoanRow = {
  id: number;
  loan_type: string;
  borrower_entity_id: number;
  lender_id: number | null;
};

export type FundingRow = {
  id: number;
  direction: "BORROWED" | "LENT";
  funder_id: number | null;
};

export type LookupOption = {
  id: number;
  category: string;
  value: string;
  label: string;
  sort_order: number;
  is_active: boolean;
  is_system: boolean;
};

export type MockApi = {
  requests: Request[];
  payloads: Array<{ url: string; method: string; body: unknown }>;
};

export function successfulJson(data: unknown, message = "Success") {
  return { success: true, data, message };
}

function failJson(error: string, code?: string) {
  return { success: false, error, ...(code ? { code } : {}) };
}

function slugifyValue(label: string): string {
  return label
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

/**
 * Installs page.route() interception for every API call the
 * entities-lenders-lookups spec needs: entities, lenders, loans, fundings
 * and lookup_options (loan_type category). State is in-memory and mutates
 * across requests within one test so the two delete-guard scenarios behave
 * like the real backend (blocked while referenced, succeeds once the
 * referencing row is gone).
 */
export async function installEntitiesMocks(page: Page): Promise<MockApi> {
  const requests: Request[] = [];
  const payloads: MockApi["payloads"] = [];

  const entities = new Map<number, EntityRow>();
  const lenders = new Map<number, LenderRow>();
  const loans = new Map<number, LoanRow>();
  const fundings = new Map<number, FundingRow>();
  const lookupOptions = new Map<number, LookupOption>([
    [
      1,
      {
        id: 1,
        category: "loan_type",
        value: "PERSONAL",
        label: "Personal Loan",
        sort_order: 0,
        is_active: true,
        is_system: true,
      },
    ],
  ]);

  let nextEntityId = 1000;
  let nextLenderId = 2000;
  let nextLoanId = 3000;
  let nextFundingId = 4000;
  let nextLookupId = 5000;

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

    // ─── auth ───
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

    // ─── entities ───
    if (path === "/api/entities" && method === "GET") {
      const search = url.searchParams.get("search")?.trim().toLowerCase() ?? "";
      let rows = [...entities.values()];
      if (search) rows = rows.filter((row) => row.name.toLowerCase().includes(search));
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(successfulJson({ data: rows, total: rows.length })),
      });
    }

    if (path === "/api/entities" && method === "POST") {
      const values = body as Record<string, unknown>;
      const name = typeof values.name === "string" ? values.name.trim() : "";
      if (!name) {
        return route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify(failJson("Name is required")),
        });
      }
      const id = nextEntityId++;
      const now = new Date().toISOString();
      const entity: EntityRow = {
        id,
        name,
        entity_kind: (values.entity_kind as EntityRow["entity_kind"]) ?? "PERSON",
        relationship: (values.relationship as EntityRow["relationship"]) ?? "INTERNAL",
        proprietor_entity_id: null,
        proprietor_name: null,
        phone: null,
        email: null,
        pan: null,
        gst_number: null,
        address: null,
        notes: null,
        is_active: true,
        created_at: now,
        updated_at: now,
      };
      entities.set(id, entity);
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(successfulJson({ entity }, "Entity added")),
      });
    }

    if (path === "/api/entities" && method === "DELETE") {
      const id = Number(url.searchParams.get("id"));
      const entity = entities.get(id);
      if (!entity) {
        return route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify(failJson("Entity not found")),
        });
      }
      const referencingLoans = [...loans.values()].filter(
        (loan) => loan.borrower_entity_id === id,
      ).length;
      if (referencingLoans > 0) {
        return route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify(
            failJson(
              `Cannot delete "${entity.name}" because ${referencingLoans} loan(s) are in its name.`,
            ),
          ),
        });
      }
      entities.delete(id);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(successfulJson(null, "Entity deleted")),
      });
    }

    // ─── lenders ───
    if (path === "/api/lenders" && method === "GET") {
      const rows = [...lenders.values()].filter((row) => row.is_active);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(successfulJson({ data: rows })),
      });
    }

    if (path === "/api/lenders" && method === "POST") {
      const values = body as Record<string, unknown>;
      const name = typeof values.name === "string" ? values.name.trim() : "";
      if (!name) {
        return route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify(failJson("Lender name is required")),
        });
      }
      const id = nextLenderId++;
      const lender: LenderRow = {
        id,
        name,
        lender_kind: (values.lender_kind as LenderRow["lender_kind"]) ?? "INSTITUTION",
        phone: null,
        contact_person: null,
        notes: null,
        is_active: true,
        created_at: new Date().toISOString(),
      };
      lenders.set(id, lender);
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(successfulJson({ lender }, "Lender added")),
      });
    }

    if (path === "/api/lenders" && method === "DELETE") {
      const id = Number(url.searchParams.get("id"));
      const lender = lenders.get(id);
      if (!lender) {
        return route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify(failJson("Lender not found")),
        });
      }
      const loanCount = [...loans.values()].filter((loan) => loan.lender_id === id).length;
      const fundingCount = [...fundings.values()].filter(
        (funding) => funding.funder_id === id,
      ).length;
      if (loanCount > 0 || fundingCount > 0) {
        const parts: string[] = [];
        if (loanCount) parts.push(`${loanCount} loan(s)`);
        if (fundingCount) parts.push(`${fundingCount} funding(s)`);
        return route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify(
            failJson(
              `Cannot delete "${lender.name}" because ${parts.join(" and ")} reference it. Turn it off instead to hide it from new records.`,
            ),
          ),
        });
      }
      lenders.delete(id);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(successfulJson(null, "Lender deleted")),
      });
    }

    // ─── loans (only what's needed to create/delete a referencing loan) ───
    if (path === "/api/loans" && method === "POST") {
      const values = body as Record<string, unknown>;
      const id = nextLoanId++;
      const loan: LoanRow = {
        id,
        loan_type: String(values.loan_type ?? "PERSONAL"),
        borrower_entity_id: Number(values.borrower_entity_id),
        lender_id: values.lender_id != null ? Number(values.lender_id) : null,
      };
      loans.set(id, loan);
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(successfulJson({ loan: { id } }, "Loan added")),
      });
    }

    if (path === "/api/loans" && method === "DELETE") {
      const id = Number(url.searchParams.get("id"));
      loans.delete(id);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(successfulJson(null, "Loan deleted")),
      });
    }

    // ─── fundings (only what's needed for the lender-delete-guard scenario) ───
    if (path === "/api/fundings" && method === "POST") {
      const values = body as Record<string, unknown>;
      const id = nextFundingId++;
      const funding: FundingRow = {
        id,
        direction: (values.direction as FundingRow["direction"]) ?? "BORROWED",
        funder_id: values.funder_id != null ? Number(values.funder_id) : null,
      };
      fundings.set(id, funding);
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(successfulJson({ funding: { id } }, "Funding added")),
      });
    }

    if (path === "/api/fundings" && method === "DELETE") {
      const id = Number(url.searchParams.get("id"));
      fundings.delete(id);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(successfulJson(null, "Funding deleted")),
      });
    }

    // ─── lookup_options (Dropdown Lists → Loan Types) ───
    if (path === "/api/lookups" && method === "GET") {
      const category = url.searchParams.get("category") ?? "";
      const includeInactive = url.searchParams.get("include_inactive") === "true";
      let rows = [...lookupOptions.values()].filter((row) => row.category === category);
      if (!includeInactive) rows = rows.filter((row) => row.is_active);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(successfulJson({ data: rows })),
      });
    }

    if (path === "/api/lookups" && method === "POST") {
      const values = body as Record<string, unknown>;
      const category = String(values.category ?? "");
      const label = typeof values.label === "string" ? values.label.trim() : "";
      if (!category || !label) {
        return route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify(failJson(!category ? "category is required" : "Label is required")),
        });
      }
      const value = typeof values.value === "string" && values.value ? values.value : slugifyValue(label);
      const duplicate = [...lookupOptions.values()].some(
        (row) => row.category === category && row.value === value,
      );
      if (duplicate) {
        return route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify(failJson("This option already exists in the list")),
        });
      }
      const id = nextLookupId++;
      const option: LookupOption = {
        id,
        category,
        value,
        label,
        sort_order: lookupOptions.size,
        is_active: true,
        is_system: false,
      };
      lookupOptions.set(id, option);
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(successfulJson({ option }, "Option added")),
      });
    }

    if (path === "/api/lookups" && method === "PUT") {
      const values = body as Record<string, unknown>;
      const id = Number(values.id);
      const option = lookupOptions.get(id);
      if (!option) {
        return route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify(failJson("Option not found")),
        });
      }
      if (values.label !== undefined) option.label = String(values.label).trim();
      if (values.sort_order !== undefined) option.sort_order = Number(values.sort_order);
      if (values.is_active !== undefined) option.is_active = Boolean(values.is_active);
      lookupOptions.set(id, option);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(successfulJson({ option }, "Option updated")),
      });
    }

    if (path === "/api/lookups" && method === "DELETE") {
      const id = Number(url.searchParams.get("id"));
      const option = lookupOptions.get(id);
      if (!option) {
        return route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify(failJson("Option not found")),
        });
      }
      if (option.is_system) {
        return route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify(
            failJson(
              `"${option.label}" is a built-in option and cannot be deleted. Turn it off instead to hide it from new records.`,
            ),
          ),
        });
      }
      lookupOptions.delete(id);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(successfulJson(null, "Option deleted")),
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
