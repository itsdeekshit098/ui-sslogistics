import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

// Unit tests only — pure logic and mocked-boundary route handlers.
// Cypress (cypress/) remains the e2e suite; this does not replace it.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    // `test/` mirrors `src/`'s structure and holds all colocated-by-feature
    // route/unit tests; `src/**/*.test.ts` stays included for any test still
    // living next to its source file (e.g. work in progress elsewhere).
    include: [
      "test/**/*.test.ts",
      "test/**/*.test.tsx",
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      // Scoped to the money modules (loans/fundings/clients/entities/lenders/
      // lookups) — the highest-risk API surface per CLAUDE.md. The rest of the
      // app has no coverage target yet, so it's excluded rather than dragging
      // the numbers here down to something meaningless.
      include: [
        "src/app/api/loans/**/*.ts",
        "src/app/api/fundings/**/*.ts",
        "src/app/api/clients/**/*.ts",
        "src/app/api/entities/**/*.ts",
        "src/app/api/lenders/**/*.ts",
        "src/app/api/lookups/**/*.ts",
      ],
      exclude: ["**/*.test.ts", "**/*.test.tsx"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      "@test": path.resolve(import.meta.dirname, "./test/support"),
    },
  },
});
