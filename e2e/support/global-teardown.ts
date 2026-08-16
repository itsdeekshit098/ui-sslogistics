import { request, type FullConfig } from "@playwright/test";
import fs from "fs";
import path from "path";
import { getRunPrefix } from "./run-id";

/**
 * Deletes everything the suite created, identified by RUN_PREFIX in an
 * entity/lender/client's own `name` — a safety net on top of each spec's own
 * cleanup, for a test that fails mid-way (before its own afterEach runs).
 *
 * Finds RUN_PREFIX-tagged entities/lenders/clients via each list route's own
 * `search` param rather than paginating through everything and filtering
 * client-side: this dev database carries ~90 real clients and a comparable
 * number of entities, well past a single 50-row page, sorted by name (not by
 * recency) — a plain "first page" scan silently missed real leftovers during
 * this suite's own development. `search` filters server-side by name, so the
 * (always small) set of RUN_PREFIX rows is what comes back regardless of how
 * much real data sits around it.
 *
 * Loans/fundings don't have their own greppable RUN_PREFIX field (no
 * `name`), so they're found by walking outward from the entities/lenders
 * above via `borrower_entity_id` / `lender_id` / `funder_id` — the same
 * foreign keys the delete-guards themselves check — deleted first so the
 * guards don't block deleting the entity/lender that follows.
 */
export default async function globalTeardown(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL as string;
  const storagePath = path.resolve(__dirname, "../.auth/admin.json");
  if (!fs.existsSync(storagePath)) return; // setup never got far enough to log in

  const api = await request.newContext({ baseURL, storageState: storagePath });
  const RUN_PREFIX = getRunPrefix();
  const q = encodeURIComponent(RUN_PREFIX);

  async function listIds(url: string): Promise<number[]> {
    const res = await api.get(`${baseURL}${url}`);
    if (!res.ok()) return [];
    const body = await res.json();
    const rows: Array<{ id: number }> = body?.data?.data ?? [];
    return rows.map((r) => r.id);
  }

  async function deleteAll(urlFor: (id: number) => string, ids: number[]) {
    for (const id of ids) {
      await api.delete(`${baseURL}${urlFor(id)}`).catch(() => {});
    }
  }

  /**
   * A client a test failed mid-way through (bill posted, payment never
   * reached, or a deliberately-left advance) has a nonzero balance — the
   * delete guard 400s and the record silently survives every future sweep.
   * Reverse every live ledger entry first so delete actually succeeds.
   */
  async function settleClientLedger(clientId: number) {
    const res = await api.get(`${baseURL}/api/clients/${clientId}/entries`);
    if (!res.ok()) return;
    const body = await res.json();
    const entries: Array<{ id: number; is_reversed: boolean; is_reversal: boolean }> =
      body?.data?.data ?? [];
    for (const entry of entries) {
      if (entry.is_reversed || entry.is_reversal) continue;
      await api
        .post(`${baseURL}/api/clients/${clientId}/entries/${entry.id}/reverse`, { data: {} })
        .catch(() => {});
    }
  }

  const entityIds = await listIds(`/api/entities?search=${q}&page_size=100`);
  const lenderIds = await listIds(`/api/lenders?search=${q}&page_size=100`);
  const clientIds = await listIds(`/api/clients?search=${q}&page_size=100`);

  // Loans/fundings referencing a tagged entity or lender, found via the same
  // FK filters the delete-guards check — deleted before their parent.
  for (const entityId of entityIds) {
    const loanIds = await listIds(`/api/loans?borrower_entity_id=${entityId}&page_size=50`);
    await deleteAll((id) => `/api/loans?id=${id}`, loanIds);
  }
  for (const lenderId of lenderIds) {
    const loanIds = await listIds(`/api/loans?lender_id=${lenderId}&page_size=50`);
    await deleteAll((id) => `/api/loans?id=${id}`, loanIds);
    const fundingIds = await listIds(`/api/fundings?funder_id=${lenderId}&page_size=50`);
    await deleteAll((id) => `/api/fundings?id=${id}`, fundingIds);
  }

  for (const clientId of clientIds) await settleClientLedger(clientId);
  await deleteAll((id) => `/api/clients?id=${id}`, clientIds);
  await deleteAll((id) => `/api/entities?id=${id}`, entityIds);
  await deleteAll((id) => `/api/lenders?id=${id}`, lenderIds);

  const swept = entityIds.length + lenderIds.length + clientIds.length;
  if (swept > 0) {
    console.log(
      `[e2e teardown] safety-net swept ${swept} leftover record(s) tagged ${RUN_PREFIX} ` +
        `(entities=${entityIds.length} lenders=${lenderIds.length} clients=${clientIds.length}) — ` +
        `a test likely failed before its own cleanup ran.`,
    );
  }

  await api.dispose();
}
