import { type Page, type Request } from "@playwright/test";
import type {
  Client,
  ClientBalance,
  ClientContact,
  ClientDeployment,
  LedgerEntry,
} from "@/components/clientsPage/clientsPage.types";

export const CLIENT_ID = 501;
export const CLIENT_NAME = "Mock Logistics Client";

export type MockOptions = Record<string, never>;

export type MockApi = {
  requests: Request[];
  payloads: Array<{ url: string; method: string; body: unknown }>;
};

export function successfulJson(data: unknown) {
  return { success: true, data };
}

function emptyBalance(clientId: number): ClientBalance {
  return {
    client_id: clientId,
    total_billed: 0,
    total_paid: 0,
    outstanding: 0,
    advance_amount: 0,
    last_payment_date: null,
    last_entry_date: null,
    oldest_unpaid_date: null,
    entry_count: 0,
  };
}

function clientFixture(overrides: Partial<Client> = {}): Client {
  return {
    id: CLIENT_ID,
    name: CLIENT_NAME,
    client_type: "VENDOR",
    location: "Chennai",
    address: null,
    gst_number: null,
    notes: null,
    is_active: true,
    party_kind: "COMPANY",
    entity_id: null,
    entities: null,
    receiving_account_id: null,
    bank_accounts: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    balance: emptyBalance(CLIENT_ID),
    deployment_mix: {},
    ...overrides,
  };
}

/**
 * In-memory store for one client's ledger/contacts/deployments, mutated by the
 * route handlers below so the UI's reads reflect its own writes within a test
 * — a created client is then findable via GET ?search=, a bill raises the
 * balance, a reversal nets it back out, etc.
 */
class ClientsStore {
  clients = new Map<number, Client>([[CLIENT_ID, clientFixture()]]);
  entries = new Map<number, LedgerEntry[]>([[CLIENT_ID, []]]);
  contacts = new Map<number, ClientContact[]>([[CLIENT_ID, []]]);
  deployments = new Map<number, ClientDeployment[]>([[CLIENT_ID, []]]);
  nextClientId = CLIENT_ID + 1;
  nextEntryId = 1;
  nextContactId = 1;
  nextDeploymentId = 1;

  private recomputeBalance(clientId: number) {
    const client = this.clients.get(clientId);
    if (!client) return;
    const entries = this.entries.get(clientId) ?? [];
    const reversedIds = new Set(
      entries.map((e) => e.reverses_entry_id).filter((v): v is number => v != null),
    );
    let totalBilled = 0;
    let totalPaid = 0;
    let outstanding = 0;
    let liveCount = 0;
    for (const entry of entries) {
      const counts = entry.reverses_entry_id == null && !reversedIds.has(entry.id);
      if (!counts) continue;
      liveCount += 1;
      const signed = entry.direction === "DEBIT" ? entry.amount : -entry.amount;
      outstanding += signed;
      if (entry.entry_type === "BILL" || (entry.entry_type === "OPENING" && entry.direction === "DEBIT")) {
        totalBilled += entry.amount;
      }
      if (entry.entry_type === "PAYMENT") {
        totalPaid += entry.amount;
      }
    }
    client.balance = {
      client_id: clientId,
      total_billed: totalBilled,
      total_paid: totalPaid,
      outstanding: outstanding > 0 ? outstanding : 0,
      advance_amount: outstanding < 0 ? -outstanding : 0,
      last_payment_date: client.balance.last_payment_date,
      last_entry_date: client.balance.last_entry_date,
      oldest_unpaid_date: client.balance.oldest_unpaid_date,
      entry_count: liveCount,
    };
  }

  createClient(fields: Record<string, unknown>): Client {
    const id = this.nextClientId++;
    const client = clientFixture({
      id,
      name: String(fields.name ?? ""),
      client_type: String(fields.client_type ?? "VENDOR"),
      party_kind: (fields.party_kind as Client["party_kind"]) ?? "COMPANY",
      location: (fields.location as string | null) ?? null,
      address: (fields.address as string | null) ?? null,
      gst_number: (fields.gst_number as string | null) ?? null,
      notes: (fields.notes as string | null) ?? null,
      balance: emptyBalance(id),
    });
    this.clients.set(id, client);
    this.entries.set(id, []);
    this.contacts.set(id, []);
    this.deployments.set(id, []);
    return client;
  }

  addEntry(
    clientId: number,
    fields: {
      entry_type: LedgerEntry["entry_type"];
      direction: LedgerEntry["direction"];
      amount: number;
      entry_date: string;
      reverses_entry_id?: number | null;
      description?: string | null;
    },
  ): LedgerEntry {
    const entry: LedgerEntry = {
      id: this.nextEntryId++,
      client_id: clientId,
      entry_type: fields.entry_type,
      direction: fields.direction,
      amount: fields.amount,
      entry_date: fields.entry_date,
      invoice_no: null,
      period_month: null,
      payment_method: null,
      reference: null,
      description: fields.description ?? null,
      reverses_entry_id: fields.reverses_entry_id ?? null,
      running_balance: 0,
      is_reversed: false,
      is_reversal: fields.reverses_entry_id != null,
      attachment_count: 0,
      created_at: new Date().toISOString(),
    };
    const list = this.entries.get(clientId) ?? [];
    list.push(entry);
    this.entries.set(clientId, list);

    if (fields.entry_type === "PAYMENT") {
      const client = this.clients.get(clientId);
      if (client) client.balance.last_payment_date = fields.entry_date;
    }

    this.recomputeBalance(clientId);
    return entry;
  }

  reverseEntry(clientId: number, entryId: number): LedgerEntry | null {
    const list = this.entries.get(clientId) ?? [];
    const original = list.find((e) => e.id === entryId);
    if (!original || original.is_reversed) return null;
    original.is_reversed = true;
    const reversal = this.addEntry(clientId, {
      entry_type: "ADJUSTMENT",
      direction: original.direction === "DEBIT" ? "CREDIT" : "DEBIT",
      amount: original.amount,
      entry_date: new Date().toISOString().slice(0, 10),
      reverses_entry_id: entryId,
      description: `Reversal of #${entryId}`,
    });
    return reversal;
  }

  addContact(clientId: number, fields: Partial<ClientContact>): ClientContact {
    const contact: ClientContact = {
      id: this.nextContactId++,
      client_id: clientId,
      name: String(fields.name ?? ""),
      role: fields.role ?? null,
      designation: fields.designation ?? null,
      phone: fields.phone ?? null,
      alt_phone: fields.alt_phone ?? null,
      email: fields.email ?? null,
      notes: fields.notes ?? null,
      is_primary: Boolean(fields.is_primary),
    };
    const list = this.contacts.get(clientId) ?? [];
    list.push(contact);
    this.contacts.set(clientId, list);
    return contact;
  }

  addDeployment(clientId: number, fields: Record<string, unknown>): ClientDeployment {
    const deployment: ClientDeployment = {
      id: this.nextDeploymentId++,
      client_id: clientId,
      vehicle_id: null,
      quantity: Number(fields.quantity ?? 1),
      vehicle_type: String(fields.vehicle_type ?? ""),
      seating_capacity: (fields.seating_capacity as number | null) ?? null,
      truck_type: (fields.truck_type as string | null) ?? null,
      container_length: (fields.container_length as string | null) ?? null,
      axle_type: (fields.axle_type as string | null) ?? null,
      container_body_type: (fields.container_body_type as string | null) ?? null,
      monthly_rate: (fields.monthly_rate as number | null) ?? null,
      start_date: (fields.start_date as string | null) ?? null,
      end_date: (fields.end_date as string | null) ?? null,
      is_active: true,
      notes: (fields.notes as string | null) ?? null,
      vehicles: null,
    };
    const list = this.deployments.get(clientId) ?? [];
    list.push(deployment);
    this.deployments.set(clientId, list);

    const client = this.clients.get(clientId);
    if (client) {
      const mix = { ...client.deployment_mix };
      mix[deployment.vehicle_type] = (mix[deployment.vehicle_type] ?? 0) + deployment.quantity;
      client.deployment_mix = mix;
    }

    return deployment;
  }

  deleteClient(clientId: number): { ok: true } | { ok: false; status: number; error: string } {
    const client = this.clients.get(clientId);
    if (!client) return { ok: false, status: 404, error: "Client not found" };
    if (Number(client.balance.outstanding) !== 0 || Number(client.balance.advance_amount) !== 0) {
      return {
        ok: false,
        status: 400,
        error: `Cannot delete "${client.name}" — their account is not settled. Mark them inactive instead to keep the statement.`,
      };
    }
    if (Number(client.balance.entry_count) > 0) {
      return {
        ok: false,
        status: 400,
        error: `Cannot delete "${client.name}" because their statement has ${client.balance.entry_count} entries. Mark them inactive instead.`,
      };
    }
    this.clients.delete(clientId);
    this.entries.delete(clientId);
    this.contacts.delete(clientId);
    this.deployments.delete(clientId);
    return { ok: true };
  }
}

export async function installClientsMocks(page: Page, _options: MockOptions = {}): Promise<MockApi> {
  const requests: Request[] = [];
  const payloads: MockApi["payloads"] = [];
  const store = new ClientsStore();

  const fail = (message: string) => ({ success: false, error: message });

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

    // ─── Clients list ───
    if (path === "/api/clients" && method === "GET") {
      const search = url.searchParams.get("search")?.trim().toLowerCase() ?? "";
      let rows = Array.from(store.clients.values());
      if (search) {
        rows = rows.filter((c) => c.name.toLowerCase().includes(search));
      }
      const hasDues = url.searchParams.get("has_dues") === "true";
      if (hasDues) rows = rows.filter((c) => Number(c.balance.outstanding) > 0);
      const includeSummary = url.searchParams.get("include_summary") === "true";
      const summary = includeSummary
        ? {
            totalClients: store.clients.size,
            activeClients: Array.from(store.clients.values()).filter((c) => c.is_active).length,
            totalOutstanding: Array.from(store.clients.values()).reduce(
              (sum, c) => sum + Math.max(0, Number(c.balance.outstanding)),
              0,
            ),
            totalAdvance: Array.from(store.clients.values()).reduce(
              (sum, c) => sum + Number(c.balance.advance_amount),
              0,
            ),
            clientsWithDues: Array.from(store.clients.values()).filter(
              (c) => Number(c.balance.outstanding) > 0,
            ).length,
          }
        : undefined;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(successfulJson({ data: rows, total: rows.length, summary })),
      });
    }

    if (path === "/api/clients" && method === "POST") {
      const fields = (body as Record<string, unknown>) ?? {};
      if (!String(fields.name ?? "").trim() && (fields.party_kind ?? "COMPANY") === "COMPANY") {
        return route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify(fail("Company name is required")),
        });
      }
      const client = store.createClient(fields);
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(successfulJson({ client })),
      });
    }

    if (path === "/api/clients" && method === "DELETE") {
      const id = Number(url.searchParams.get("id"));
      const result = store.deleteClient(id);
      if (!result.ok) {
        return route.fulfill({
          status: result.status,
          contentType: "application/json",
          body: JSON.stringify(fail(result.error)),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(successfulJson(null)),
      });
    }

    // ─── Client detail ───
    const detailMatch = path.match(/^\/api\/clients\/(\d+)$/);
    if (detailMatch && method === "GET") {
      const clientId = Number(detailMatch[1]);
      const client = store.clients.get(clientId);
      if (!client) {
        return route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify(fail("Client not found")),
        });
      }
      const contacts = store.contacts.get(clientId) ?? [];
      const deployments = store.deployments.get(clientId) ?? [];
      const fleetMix: Record<string, number> = {};
      for (const d of deployments) {
        if (!d.is_active) continue;
        fleetMix[d.vehicle_type] = (fleetMix[d.vehicle_type] ?? 0) + d.quantity;
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          successfulJson({
            client,
            balance: client.balance,
            contacts,
            deployments,
            fleet_mix: fleetMix,
          }),
        ),
      });
    }

    // ─── Ledger entries ───
    const entriesMatch = path.match(/^\/api\/clients\/(\d+)\/entries$/);
    if (entriesMatch && method === "GET") {
      const clientId = Number(entriesMatch[1]);
      const list = (store.entries.get(clientId) ?? []).slice().reverse();
      const client = store.clients.get(clientId);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          successfulJson({
            data: list.map((entry) => ({ ...entry })),
            total: list.length,
            closing_balance: client ? Number(client.balance.outstanding) - Number(client.balance.advance_amount) : 0,
          }),
        ),
      });
    }

    if (entriesMatch && method === "POST") {
      const clientId = Number(entriesMatch[1]);
      const client = store.clients.get(clientId);
      if (!client) {
        return route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify(fail("Client not found")),
        });
      }
      const fields = (body as Record<string, unknown>) ?? {};
      const entryType = String(fields.entry_type ?? "");
      const amount = Number(fields.amount);
      if (!(amount > 0)) {
        return route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify(fail("Amount must be greater than zero")),
        });
      }
      let direction: "DEBIT" | "CREDIT";
      if (entryType === "BILL" || entryType === "OPENING") direction = "DEBIT";
      else if (entryType === "PAYMENT") direction = "CREDIT";
      else direction = (fields.direction as "DEBIT" | "CREDIT") ?? "DEBIT";

      const entry = store.addEntry(clientId, {
        entry_type: entryType as LedgerEntry["entry_type"],
        direction,
        amount,
        entry_date: String(fields.entry_date ?? new Date().toISOString().slice(0, 10)),
        description: (fields.description as string | null) ?? null,
      });
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(successfulJson({ entry })),
      });
    }

    // ─── Reverse an entry ───
    const reverseMatch = path.match(/^\/api\/clients\/(\d+)\/entries\/(\d+)\/reverse$/);
    if (reverseMatch && method === "POST") {
      const clientId = Number(reverseMatch[1]);
      const entryId = Number(reverseMatch[2]);
      const reversal = store.reverseEntry(clientId, entryId);
      if (!reversal) {
        return route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify(fail("This entry has already been reversed")),
        });
      }
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(successfulJson({ entry: reversal })),
      });
    }

    // ─── Contacts ───
    const contactsMatch = path.match(/^\/api\/clients\/(\d+)\/contacts$/);
    if (contactsMatch && method === "GET") {
      const clientId = Number(contactsMatch[1]);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(successfulJson({ data: store.contacts.get(clientId) ?? [] })),
      });
    }
    if (contactsMatch && method === "POST") {
      const clientId = Number(contactsMatch[1]);
      const fields = (body as Record<string, unknown>) ?? {};
      if (!String(fields.name ?? "").trim()) {
        return route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify(fail("Contact name is required")),
        });
      }
      const contact = store.addContact(clientId, fields);
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(successfulJson({ contact })),
      });
    }

    // ─── Deployments ───
    const deploymentsMatch = path.match(/^\/api\/clients\/(\d+)\/deployments$/);
    if (deploymentsMatch && method === "GET") {
      const clientId = Number(deploymentsMatch[1]);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(successfulJson({ data: store.deployments.get(clientId) ?? [] })),
      });
    }
    if (deploymentsMatch && method === "POST") {
      const clientId = Number(deploymentsMatch[1]);
      const fields = (body as Record<string, unknown>) ?? {};
      const deployment = store.addDeployment(clientId, fields);
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(successfulJson({ deployment })),
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
