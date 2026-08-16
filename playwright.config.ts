import { defineConfig, devices } from "@playwright/test";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, ".env.e2e.local") });

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

// A single browser session is authenticated once in global-setup and reused
// (via storageState) by every test file — see e2e/README.md for why: this
// account allows only one concurrent session, so each test logging in on its
// own would revoke every other test's session mid-run.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "e2e-report" }]],
  globalSetup: "./e2e/support/global-setup.ts",
  globalTeardown: "./e2e/support/global-teardown.ts",

  use: {
    baseURL,
    storageState: "e2e/.auth/admin.json",
    // Always on, not just on failure: this suite runs locally on demand
    // rather than in CI, so the point of a recording is being able to watch
    // back what a *passing* run actually did, not only diagnose a failure.
    trace: "on",
    screenshot: "on",
    video: "on",
    // Runs full-speed by default — a real user can't follow along with a
    // --headed browser at normal Playwright speed. Set SLOWMO (ms) to pace
    // every action for live watching, e.g. `npm run test:e2e:watch`.
    launchOptions: {
      slowMo: process.env.SLOWMO ? Number(process.env.SLOWMO) : 0,
    },
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
