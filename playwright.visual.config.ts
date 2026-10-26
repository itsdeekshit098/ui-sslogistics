import { defineConfig, devices } from "@playwright/test";

/**
 * Screenshot capture for layout work — not part of `npm run test:e2e`.
 * Same mocked dev server as playwright.config.ts. See e2e-visual/README.md.
 */
const baseURL = "http://localhost:3100";

export default defineConfig({
  testDir: "./e2e-visual",
  fullyParallel: true,
  reporter: [["list"]],
  outputDir: "visual-snapshots/.results",
  snapshotPathTemplate: "visual-snapshots/desktop-baseline/{arg}{ext}",
  expect: { toHaveScreenshot: { maxDiffPixels: 0, animations: "disabled" } },

  use: { baseURL },

  projects: [
    {
      name: "mobile-light",
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 }, colorScheme: "light" },
    },
    {
      name: "mobile-dark",
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 }, colorScheme: "dark" },
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, colorScheme: "light" },
    },
  ],

  webServer: {
    command:
      "E2E_MOCK_AUTH=true NEXT_DIST_DIR=.next-mock-e2e NEXT_TELEMETRY_DISABLED=1 npm run dev -- --port 3100",
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
