import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // Chai's BDD assertions (`expect(x).to.eq(y)`) are bare expression
    // statements by construction — the rule exists to catch accidental
    // no-ops elsewhere, not this idiom, which is how every Cypress/Chai
    // assertion in this suite is written.
    files: ["cypress/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unused-expressions": "off",
    },
  },
]);

export default eslintConfig;
