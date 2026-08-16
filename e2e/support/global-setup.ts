import { chromium, request, type FullConfig } from "@playwright/test";
import fs from "fs";
import path from "path";
import { generateRunPrefix } from "./run-id";
import { humanFill } from "./human";

/**
 * Logs in exactly once for the whole run and saves the resulting cookies to
 * e2e/.auth/admin.json, which every test's browser context loads via
 * `use.storageState` in playwright.config.ts.
 *
 * This account allows only one concurrent session (the 2-session allowance in
 * `revoke_old_user_sessions` is scoped to role === "admin", not superadmin —
 * see e2e/README.md). If each test file logged in independently, running them
 * in parallel would have them revoke each other's sessions mid-suite. Logging
 * in once here and sharing the resulting storageState sidesteps that
 * entirely — no test file should ever call the login endpoint itself.
 */
export default async function globalSetup(config: FullConfig) {
  // Fresh prefix for this run — done first and unconditionally, so a stale
  // file left by a prior interrupted run never leaks into this one.
  generateRunPrefix();

  const baseURL = config.projects[0].use.baseURL as string;
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "E2E_EMAIL / E2E_PASSWORD are not set. Copy .env.e2e.local.example to " +
        ".env.e2e.local and fill in an admin-or-superadmin account.",
    );
  }

  const authDir = path.resolve(__dirname, "../.auth");
  fs.mkdirSync(authDir, { recursive: true });
  const storagePath = path.join(authDir, "admin.json");

  // Through the real login form, not the API directly — this is the one path
  // worth exercising as UI rather than a shortcut, since a login regression
  // would otherwise be invisible to the entire suite.
  // Own launch, separate from config's `use.launchOptions` (which only
  // applies to per-test contexts) — SLOWMO is threaded through by hand so
  // login is paced consistently with the rest of a watch-mode run.
  const browser = await chromium.launch({
    headless: !process.env.SLOWMO,
    slowMo: process.env.SLOWMO ? Number(process.env.SLOWMO) : 0,
  });
  const page = await browser.newPage({ baseURL });
  await page.goto("/login");
  await humanFill(page.getByLabel("Email address"), email);
  await humanFill(page.getByLabel("Password", { exact: true }), password);
  await page.getByRole("button", { name: "Sign in to Operations Portal" }).click();
  await page.waitForURL(/\/admin/, { timeout: 15_000 });
  await page.context().storageState({ path: storagePath });
  await browser.close();

  // Confirm the session actually carries admin/superadmin privileges before
  // the suite runs 80+ tests assuming it does — a driver-role account (this
  // exact mistake happened once already) would otherwise fail every money-
  // module test with a confusing wall of 403s instead of one clear message.
  const api = await request.newContext({ baseURL, storageState: storagePath });
  const res = await api.get("/api/auth/session");
  const body = await res.json();
  const role = body?.data?.role;
  await api.dispose();

  if (role !== "admin" && role !== "superadmin") {
    throw new Error(
      `E2E account has role "${role}", which cannot access the money modules ` +
        `(loans/fundings/clients require admin or superadmin, GET included). ` +
        `Point .env.e2e.local at an admin-or-superadmin account.`,
    );
  }
}
