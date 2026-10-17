import { defineConfig, devices } from "@playwright/test";

/**
 * The whole e2e/ suite is fully mocked — see e2e/README.md. Every /api/**
 * call is intercepted by page.route() with in-memory fixture data
 * (e2e/fixtures/*.ts); there is no real login and no real Supabase. The dev
 * server runs on its own port (3100) with E2E_MOCK_AUTH=true and a separate
 * .next-mock-e2e build directory, so it never collides with a normal
 * `npm run dev` on 3000.
 */
const baseURL = "http://localhost:3100";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "e2e-report" }]],

  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // Runs full-speed by default. Set SLOWMO (ms) to pace every action for
    // live watching, e.g. `npm run test:e2e:watch`.
    launchOptions: {
      slowMo: process.env.SLOWMO ? Number(process.env.SLOWMO) : 0,
    },
  },

  webServer: {
    command:
      "E2E_MOCK_AUTH=true NEXT_DIST_DIR=.next-mock-e2e NEXT_TELEMETRY_DISABLED=1 npm run dev -- --port 3100",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
