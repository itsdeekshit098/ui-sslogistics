import type { Page } from "@playwright/test";

/**
 * `page.request` is a standalone APIRequestContext — it talks to the network
 * directly from Node, not through the page's own browser network stack, so
 * `page.route()` (which only intercepts requests the page itself makes) never
 * sees those calls. Every "raw API" call a mocked spec needs to make outside
 * of clicking through the UI must instead run as a real `fetch()` *inside*
 * the page via `page.evaluate`, which the browser does dispatch through the
 * page's own routes — the one thing `page.route()` actually intercepts.
 *
 * A `page.goto()` (to any mocked page) must happen before this is called, so
 * there is a document for the fetch to run in and the route handler is
 * already installed on that page's context.
 */
export async function apiFetch(
  page: Page,
  url: string,
  init?: { method?: string; data?: unknown },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test helper: callers parse arbitrary API envelopes
): Promise<{ ok: boolean; status: number; json: () => Promise<any>; text: () => Promise<string> }> {
  const result = await page.evaluate(
    async ({ url, method, data }) => {
      const res = await fetch(url, {
        method: method ?? "GET",
        headers: data !== undefined ? { "Content-Type": "application/json" } : undefined,
        body: data !== undefined ? JSON.stringify(data) : undefined,
      });
      const text = await res.text();
      return { ok: res.ok, status: res.status, text };
    },
    { url, method: init?.method, data: init?.data },
  );
  return {
    ok: result.ok,
    status: result.status,
    text: async () => result.text,
    json: async () => JSON.parse(result.text),
  };
}
