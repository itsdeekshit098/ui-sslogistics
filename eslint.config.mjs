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
    // Build output of the isolated mocked-e2e dev server (playwright.config.ts
    // webServer, E2E_MOCK_AUTH=true) — generated chunks, not source.
    ".next-mock-e2e/**",
  ]),
  {
    // Everything outside the UI library reaches it through a component's own
    // folder entry (`@ui/components/button`), never a file inside it.
    // `@ui/components/button/button.styles` would couple callers to internals.
    files: ["src/**/*.{ts,tsx}", "test/**/*.{ts,tsx}", "e2e/**/*.ts"],
    ignores: ["src/ui/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@ui/components/*/*", "@ui/patterns/*/*"],
              message:
                "Import a component from its folder entry (e.g. @ui/components/button), not a file inside it.",
            },
          ],
        },
      ],
    },
  },
  {
    // The UI library is built to be liftable into its own package, so it must
    // not import app code.
    files: ["src/ui/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/*"],
              message:
                "src/ui must not import app code. Pass the value in as a prop, or move the helper into src/ui/utils or src/ui/hooks.",
            },
          ],
        },
      ],
    },
  },
  {
    // Components in the library style themselves in `*.styles.ts`
    // (styled-components): no inline `style`, no class-name strings.
    // (A caller's own `className` / `style` is passed through as a prop or a
    // spread, never written here; the few dynamic values — a tooltip's
    // position, a progress bar's width — are set as CSS custom properties with
    // `.attrs` in the styles file.)
    files: ["src/ui/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXAttribute[name.name='style']",
          message:
            "No inline styles in src/ui. Put the rule in the component's *.styles.ts (a dynamic value goes through a CSS custom property set with .attrs).",
        },
        {
          selector:
            "JSXAttribute[name.name='className'][value.type='Literal'], JSXAttribute[name.name='className'] > JSXExpressionContainer > TemplateLiteral",
          message:
            "No class-name strings in src/ui. Style with styled-components in *.styles.ts.",
        },
      ],
    },
  },
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
