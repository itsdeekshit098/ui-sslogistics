# Handoff: web phone layout matching the Flutter app

Read this to continue the work without re-exploring. Written 2026-10-26. The design rules themselves live in `CLAUDE.md` ("Phone layout"); this file is the state of the work and the traps.

## State

- Branch `feat/mobile-web-parity` (off `main`), 6 commits, **not pushed, no PR yet**. `git log origin/main..HEAD` lists them. Working tree clean.
- Goal: below `md` (768px) the web admin looks like `../mobile_sslogistics`. Desktop must stay pixel-identical (verified: 25/25 desktop screenshots unchanged).
- Every commit passed the husky gate (lint, typecheck, unit, e2e, build).
- Flutter side: edits are on disk only (`mobile_sslogistics` is not a git repo).

## Done (web)

- Navigation: Flutter-style navy drawer (`src/components/layout/mobileDrawer/`) replaces the bottom nav, section chips and More sheet (all deleted). App bar (`mobileTopBar`): back arrow, title, bell, menu. `/admin` has no app bar; the gradient hero in `mobileDashboard` carries the menu button (`useOpenMobileDrawer` context).
- Dashboard: gradient hero, "Needs attention" (overdue EMIs, expiring FC/insurance), "Quick Access" tiles with per-module colours (`accent` in `src/app/admin/page.tsx`).
- Phone tokens `--m-*` and phone dark surfaces at the end of `globals.css`. `--mobile-dock-*` variables are gone; use `--mobile-bottom-clearance`.
- Primitives restyled with `max-md:` classes: StatCard (summary strip), Tabs/SegmentedControl (chips), Badge (pill), Card, Input fill, DataTable cards, EmptyState, Pagination "Load more", modals/BottomSheet, PageFab (module colour from `navConfig` `accent`).
- DataTable gained an optional `mobileCard` prop; Loans uses it (`loansPage/loanMobileCard.tsx`).
- Attendance phone rows are per-driver cards. Banner wraps and filter chips shrink below 360px (commit `fa4ca52`).
- Tooling: `npm run visual:baseline` / `visual:compare` (`e2e-visual/`), phone e2e spec `e2e/features/smoke/mobile-layout.spec.ts`.

## Done (Flutter)

- "Needs attention" on the dashboard: `lib/features/dashboard/widgets/needs_attention_section.dart`, `providers/needs_attention_provider.dart`, wording identical to web. `/vehicles?fcStatus=` and `?insuranceStatus=` open pre-filtered (`app_router.dart`, `vehicles_screen.dart`). Test: `test/features/dashboard/needs_attention_test.dart`. `flutter test` passes (94).

## Verified against the real dev server (your dev Supabase)

Overflow: no sideways scroll on ~20 pages at 320/360/390/430, main pages at 767. Looked at in dark and light: dashboard, Loans (+detail), Salaries, Attendance, Trips, Clients, Drivers, Diesel, Repair Records. Interactions: drawer (scrolls), theme toggle, sign-out dialog, "+" form, filter sheet, bell.

Second round (all at 390, light and/or dark, real data): Warranty, Technicians, Firms & Owners, Bank Accounts, Activity Log, Sessions, Settings, client detail, funding detail, Salaries driver sheet, Attendance month view and row menu. All fine. At 768px the desktop layout (sidebar, normal stat cards, no phone chrome) is unchanged; at 767px it is the phone layout.

Known, left alone: one unreproduced glitch (Loans summary strip looked scrolled ~35px once at 320px; scroll was 0 on every retry). The client statement's "payment proof" icon button sits at an odd spot on some timeline rows (pre-existing cell in `clientDetailPage.tsx`, not touched by this work).

Notch / home bar / keyboard (checked without a physical phone): safe-area insets are handled for the app bar, drawer, dashboard hero, bottom sheets, modals, filter sheet and "+" (all `env(safe-area-inset-*)` or `--mobile-bottom-clearance`); the Attendance Save/Discard bar and "Saved" toast now use the same clearance (they were flush to the bottom edge). No form field is under 16px, so iPhone Safari will not zoom on focus (audited ~14 pages plus the Loan/Client/Driver/Vehicle/Technician forms). With the viewport shrunk to 420px tall (an Android keyboard that resizes the page), the form sheet, drawer and sign-out dialog stay on screen with their buttons visible. Body-less dialogs show one divider, not two.

Still impossible to verify without a device: real notch/home-bar rendering, and iOS keyboard behaviour (iOS overlays the keyboard instead of resizing, so a bottom sheet's footer buttons can sit under it until the keyboard closes). Android Chrome behaves like the 420px test only if the page opts in with `interactiveWidget: "resizes-content"` in the viewport export in `src/app/layout.tsx` (not set; default is overlay).

## Next steps

1. Push `feat/mobile-web-parity`, open the PR (Flutter changes are not in it; mention them).
2. Optional: touch-test on a real phone for the two items above.
3. Known intentional gaps vs Flutter: phone lists use "Load more", not numbered pages; the theme toggle lives in the drawer (the app has none); the Loans summary strip scrolls sideways (5 cards).

## How to check it in a browser (saves a lot of time)

- Dev server: `npm run dev`. Port 3000 may be taken by another project (a Maersk app); Next then uses 3002. Check the port in the output before testing.
- Chrome can't make a window narrower than about 500px. Use a **single** same-origin iframe instead: from any localhost page run `document.open(); document.write('<iframe name="f" src="/admin" style="width:390px;height:760px;border:0">'); document.close()`, then change `src` and `width` per page. The app allows same-origin framing (`X-Frame-Options: SAMEORIGIN`). Real media queries run inside the iframe.
- Do **not** open several frames or tabs of the app at once: each page keeps two SSE streams open, Chrome allows six connections per host, and the tab freezes. One frame at a time.
- Host the iframe on a page with no live connections: `/login` or `/privacy` (public). Hosting it on `/admin` freezes the tab for the same reason. If a tab freezes, close it, call `tabs_context_mcp` with `createIfEmpty`, and start a new one (a tab from `tabs_create_mcp` can land outside the group).
- The app signs out after 15 minutes idle (`/login?reason=idle_timeout`); a long pause between checks means the user has to sign in again.
- A handy helper to define on the host page: `go(path, width)` that sets the iframe `src`/width, waits for load plus 3.5s, then returns document/main overflow and any element past the right edge.
- Don't enter passwords for the user. They sign in themselves in the browser window. With two Chrome browsers connected, ask which one to use first.
- Scripted `.click()` on a modal opener shows a blue focus ring that a real tap does not. Use a real click to judge focus styling.
- Without a browser: the mocked suite (`E2E_MOCK_AUTH=true`, port 3100) is what `npm run visual:*` uses; it has little data, so stat strips and long lists are not exercised.
- Theme: testing toggled the user's dev browser to light. Leave the theme as you found it.

## Traps

- Tailwind v4 silently drops unknown classes. After adding classes, confirm they exist in the compiled CSS (fetch the dev CSS and search for the escaped class name).
- Any rule that sets a phone look must be phone-scoped (`max-md:` or `@media (max-width: 767px)`). The attendance chip row sets `[&>button]:px-0`, which beats `max-md:px-3.5`.
- `usePathname()` returns null in unit tests; `PageFab` guards for it.
- Phone-only element rules in `globals.css` (`input[placeholder^="Search"]`, `button[aria-label="Filters"]`) apply app-wide on phones, including inside modals.
- Desktop reference screenshots come from commit `ba22039`. If layout code changes legitimately on desktop, re-run `npm run visual:baseline`.
