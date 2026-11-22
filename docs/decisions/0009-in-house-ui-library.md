# 0009 — The UI components are an in-house library in `src/ui`, styled with styled-components

- **Status:** Accepted
- **Date:** 2026-11-21
- **Area:** UI (`src/ui/`, `src/app/globals.css`, `eslint.config.mjs`, `tsconfig.json`, `e2e-visual/`)

## Situation

The shared components lived in `src/components/ui/` beside feature code and were styled four different ways: Tailwind classes merged with `cn`/`cva`, `style={}` objects in `.style.ts` files, `.ss-*` rules in `globals.css`, and Tailwind animation utilities. Folder layout and export style were inconsistent, a few names were misleading, and common needs (a date picker, a money field, a menu, a toast, an alert) were rebuilt by hand in feature code each time. The request was for one consistent, enterprise-grade library: a folder per component, its own CSS, no Tailwind and no inline styles inside it.

## Options considered

1. **Keep Tailwind + CVA (shadcn-style).** The status quo; rejected because it is what was asked to change, and because class strings in JSX are the thing that made components hard to read.
2. **A `packages/ui` workspace package.** The cleanest boundary, but the Flutter app cannot use React components, so no second consumer exists, and it would move the app to `apps/web` and change Vercel, husky, Playwright and CI. Rejected for now: `src/ui` gets a package's discipline instead (one entry point per component, a lint rule that stops it importing app code, its own tests and docs), so lifting it out later is a folder move.
3. **CSS Modules.** Build-time, works in server components, no library. Genuinely the lower-risk engine; rejected because named styled elements (`<Header>`, `<Title>`) were the stated reason for wanting this, and because this app is an authenticated portal where client-only components cost little.
4. **styled-components.** Chosen. It is in maintenance mode but supports React 19; every component becomes a client component (19 of 31 already were).

## Decision

The library lives in `src/ui/` (imported as `@ui/...`), each component a folder (`name.tsx`, `name.styles.ts`, `name.types.ts`, optional `name.utils.ts`, `index.ts`) with named exports only. It styles itself only in `*.styles.ts` with styled-components; ESLint forbids `style=`, class-name strings and imports of app code inside it. Tailwind keeps working in feature code.

How the two coexist is the part that is not obvious:

- **Library rules go in a CSS cascade layer, `ui`, declared between `base` and `utilities`** (first line of `globals.css`). A component's own styles beat Tailwind's preflight, but a Tailwind class a caller adds still beats the component. **A caller's `className` always wins over the component's own styling.**
- **`locked`** (`@layer utilities` with a doubled class) is used only where the old component set the value as an inline style, which no class could override (Spinner sizes, Modal, FilterDrawer). It keeps that priority without writing an inline style.
- **A caller's `className` is not always equivalent to the old behaviour.** Tailwind sorted a component's `sm:`/`max-md:` classes after a caller's plain class, so the component's media rule used to win; in the layer it loses. 81 call sites relied on that; each now carries the missing class explicitly (found by simulating the old `tailwind-merge`; see the guide).
- **Tokens are CSS variables** (`src/ui/tokens/tokens.css`); static scales are TypeScript constants that follow Tailwind's defaults so a converted component keeps its exact size.
- **Radix Select stays** (behaviour only); Radix Slot and Label were replaced and `class-variance-authority` removed.

## Consequences

- **Easy:** one place for every shared component, a design that survives Tailwind leaving feature code, tests that assert real CSS (`test/support/uiStyles.ts`), and screenshots (`npm run visual:compare`) that fail on one pixel.
- **Costs:** every component is a client component; styled-components is not growing; a caller who passes a conflicting class gets the caller's value. Phone rules sit in `@layer ui` too, so a caller's plain class beats them.
- **Check first if something looks wrong:** (1) line height: `text-*` sizes read `--tw-leading`, which `leading-tight|snug|relaxed|normal` set but `leading-none` does not (`text()` and `setLeading()` in `styles/mixins.ts` mirror this); (2) `-var(--x)` is not a valid CSS negative, use `calc(var(--x) * -1)`; (3) a media-conditional rule on the component that a caller's plain utility now overrides.
- **Not done yet** (see the guide's status table): moving feature screens onto the new components, replacing Radix Select, and re-expressing Button/Badge variants in the `variant`/`tone` vocabulary.

## Where it shows up

[docs/ui/README.md](../ui/README.md) · `src/ui/` · `eslint.config.mjs` (boundary rules) · `e2e-visual/README.md` · `test/ui/`
