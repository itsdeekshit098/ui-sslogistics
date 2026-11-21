---
name: frontend-implementation
description: Build or change a screen in ui-sslogistics (page, list, modal, form, sheet, component) the way this codebase expects. Covers the shared primitives, Tailwind/CVA and theme tokens, the max-md phone layout that mirrors Flutter, roles, the API envelope, money and IST dates, test ids, tests, visual checks and docs. Use whenever a .tsx under src/components or src/app is created or meaningfully changed.
argument-hint: <module or component> <what to build or change>
---

# Frontend implementation: $ARGUMENTS

<!--
WHAT THIS FILE IS: a skill, meaning a checklist Claude follows when it builds or changes UI.
HOW TO RUN IT: `/frontend-implementation clients "add a GST filter"`, or just ask for UI work. The
  description lets Claude load it on its own.
WHY IT EXISTS: a screen here is "done" only when it uses the shared primitives, works for every role,
  looks right at 390px in light and dark, leaves desktop pixels alone, and shows the server's figures
  without recomputing them. Past bugs came from skipping one of these.
KEEP IN SYNC: every component, helper and path named below must exist. Update this file when one moves.
-->

## 0. Read before writing

1. The area's rule: `.claude/rules/phone-layout.md` always, plus the module's own rule (`attendance-and-salaries.md`, `database-and-money.md`, `record-deletion.md`).
2. `docs/features/<module>.md` (what each role sees today), `docs/known-issues.md` and any `Open` decision in `docs/decisions/`. Ask about an Open decision; don't settle it yourself.
3. The API route the screen calls (`src/app/api/<module>/route.ts`): its auth level, its query params, and the exact response shape. Read it; don't guess field names.
4. For phone work, the matching Flutter screen in `../mobile_sslogistics/lib/features/<module>/`.
5. A model to copy. Match its shape before inventing one:

| Building | Copy |
|---|---|
| List page: search, pagination, row actions, delete confirm | `src/components/driversPage/driversPage.tsx` |
| List with its own phone card | `src/components/loansPage/` (`DataTable` `mobileCard`) |
| Form modal: field errors, linked pickers, create vs edit | `src/components/clientModal/clientModal.tsx` |
| Detail page with a ledger and entry modals | `src/components/clientDetailPage/`, `src/components/loanDetailPage/` |
| Different phone and desktop trees | `src/components/attendancePage/` (`useIsMobile`) |

## 1. Structure

- `src/app/admin/<route>/page.tsx` stays a thin wrapper: `export default function Page() { return <XPage />; }`.
- Feature code goes in `src/components/<camelCase>/`: `<name>.tsx`, `<name>.types.ts`, `index.ts` (`export *`), plus `<name>.utils.ts` for pure logic (it gets unit-tested) and `<name>.constants.ts` if needed. Files and folders are camelCase; component exports are PascalCase.
- `"use client"` only where hooks or handlers are needed.
- Load modals and other heavy children that open on demand with `next/dynamic` and `{ ssr: false }`, as `DriversPage` does.
- A new page also needs `PAGE_ROLE_MAP` in `src/lib/routePermissions.ts` and an entry in `src/components/layout/navConfig.ts`, with an `accent` colour, because `PageFab` and the phone drawer read it.

## 2. Use the primitives, don't hand-roll

Everything below lives in `src/components/ui/` unless noted. Each already carries its phone look as `max-md:` classes, so using it gets the Flutter layout for free.

| Need | Use |
|---|---|
| Title, description, main action | `PageHeader` (`primaryAction` with a `testId`) |
| Table / phone card list | `DataTable`. Set `ColumnDef.mobile` to place a column in the phone card (`title`, `subtitle`, `trailing`, `field`, `footer`, `hidden`); `rowActions` take a per-row `testId` and `mobileOnly` |
| Paging | `Pagination` (server-side, see §4) |
| Loading / error / empty | `PageLoadingSkeleton`, `ErrorState` (with `onRetry`), `EmptyState` (with an action) |
| Dialog / phone sheet | `Modal` + `ModalContent/Header/Title/Description/Body/Footer`; `BottomSheet` for phone-only sheets; `FilterDrawer` for filters |
| Destructive confirm | `ConfirmModal` from `@/components/confirmModal` |
| Choice chips / tabs | `SegmentedControl`, `Tabs` |
| Summary strip | `StatCard` (on phones the parent becomes a scrolling strip) |
| Status | `Badge` |
| Phone "create" button | `PageFab` (takes the module accent from `navConfig`) |
| Pickers | `Typeahead`, `@/components/lookupSelect` |
| Rupees | `Money` (tabular digits, `tone`), or `formatCurrency` / `formatCurrencyPrecise` from `src/lib/format.ts` |
| Icons | `@/components/ui/icon` only. There is no icon library dependency; add a new shape there if one is missing |
| Form controls | `Input`, `Label`, `Textarea`, `Select`, `Button` (CVA variants) |
| Shared class strings | `src/lib/designTokens.ts` (`PAGE_CONTAINER`, `MODAL_GRID`, `ERROR_BANNER`, …) |

If a primitive is almost right, extend it with a prop. Don't fork it inside a feature folder, and run its test in `test/components/ui/` after the change.

## 3. Styling

- Use Tailwind 4 with `cn()` from `@/lib/utils`, and CVA for variants. Don't add a new `.style.ts` file. Leave the existing ones alone unless the task is the migration.
- Use theme tokens only (`bg-card`, `text-muted-foreground`, `border-border`, `text-destructive`, `text-success-subtle-foreground`, `--m-*` for phone shapes). Raw hex is allowed only for the module `accent` from `navConfig`. Every screen must read well in **dark mode**: the `.dark` variant is set from `globals.css`, so check it there.
- **Phone is `max-md:` and desktop pixels never change.** Put phone styling in `max-md:` classes on the element. Use `useIsMobile()` only when the two layouts are genuinely different trees, and keep the `md:hidden`/`max-md:hidden` classes so nothing flashes before hydration. The server render assumes desktop.
- Phone targets the Flutter look: 16px cards, 20px sheets, 12px controls, chips instead of tabs, and no bottom nav. When the Flutter screen and the web phone screen differ, follow Flutter.
- Anything shown only on hover (row actions, Mark Paid, Reverse) must also be reachable by touch, either in the card's "⋯" sheet (`mobileOnly`) or always visible on phones.

## 4. Data and the API

- Responses are `{ success, data, message }` / `{ success: false, error, code? }`. Read `json.data`. On a non-OK response, show `json.error`. Never show a raw exception message.
- Filtering, search and sorting go **to the server** as query params. Never filter rows on the client after paginating. Debounce search at 300 ms, reset to page 1 when a filter changes, and clear the request with the input.
- Refetch after a mutation rather than patching local state by hand, unless the screen saves a batch (attendance sends one `PUT` of the changed rows).
- **Don't compute derived figures on the client.** Show the server's totals, net pay, outstanding, overdue and `today`. If the screen needs a number the API doesn't return, add it to the route (`/new-api-route`) and run the **mobile-contract-checker** agent.
- A 401 with `code: "SESSION_INVALID"` is already handled by `AuthContext` and the admin layout. Don't add a second redirect.

## 5. Roles

- Read the role with `useAuth()` and use `canEdit`, `isAdmin` and `isSuperAdmin` from `src/lib/routePermissions.ts`. When the API returns a flag such as `editable`, use the flag rather than the role.
- Hide create/edit/delete controls a role can't use, or disable them with a reason. The UI is a convenience; the route's `require*Auth` is the real guard, so never relax it to make the UI simpler.
- Money screens (loans, fundings, clients, bank accounts, salaries) are admin/superadmin only, reads included, so their entry points stay hidden from staff and drivers.

## 6. Money, dates and forms

- Display money with `Money` or `formatCurrency`. Inputs accept at most 2 decimals and stay at or below the route's stated maximum.
- Date-only strings (`YYYY-MM-DD`) are displayed with `formatDate` / `formatDateCompact` / `formatMonth`, never `new Date(str).toLocaleDateString()`, which shifts by a day. For a default "today", use `todayInIndia()` from `src/lib/dateOnly.ts`. `todayString()` in `format.ts` is UTC and reads yesterday before 05:30 IST.
- Forms keep a `fieldErrors: Record<string, string>` shown under each field, plus one `submitError` from the server's `error`. Client checks mirror the server's (required fields, maxLength constants exported from the module's `.types.ts`, money limits). The server stays the source of truth.
- While saving, disable submit and block close (`if (!loading) onClose()`). Trim text, and send `null` for empty optionals.
- Handle the route's machine codes where it has them, for example `409 SIMILAR_DRIVER_EXISTS` → confirm and resend.
- Destructive actions go through `ConfirmModal` and show the server's refusal reason. Delete gates live on the server (`record-deletion.md`).

## 7. Accessibility and test hooks

- Every input has a `Label` with `htmlFor`. Icon-only buttons have an `aria-label`. Dialogs have a `ModalTitle`.
- Use `data-testid` as `<module>-<thing>-<kind>` (`drivers-add-btn`, `drivers-search-input`) and a per-row `` (row) => `edit-btn-${row.id}` `` for row actions. Mocked e2e specs and `e2e/pages/` page objects depend on them, so don't rename existing ones casually.
- Respect the lint rules in place. For example, `react-hooks/set-state-in-effect` is only disabled with a reason in a comment, as in `PageFab`.

## 8. Tests

- Pure logic in `<name>.utils.ts` gets a test in `test/components/<name>/<name>.utils.test.ts`.
- A changed primitive gets its test in `test/components/ui/<name>.test.tsx` updated.
- A new flow gets a mocked Playwright spec in `e2e/features/<module>/`, with fixtures and `installXMocks(page)` in `e2e/fixtures/` (see `e2e/README.md`). Cover the role variants that change what is on screen.
- Layout work: run `npm run visual:baseline` **before** you start and `npm run visual:compare` after. Any desktop diff is a bug.

## 9. Verify, then document

1. Run `npm run typecheck`, `npm run lint`, and `npx vitest run` on the touched test files, plus `npx playwright test e2e/features/<module>` if a spec exists.
2. Look at it in the real app (`/run`, or the live-testing method): desktop, and 390px in light and dark. Click every new control. For a role-dependent screen, check each role. A screen isn't done until it has been seen.
3. Update `docs/features/<module>.md` (what each role sees, desktop and phone) and add one line to `docs/CHANGELOG.md` for a user-visible change. If you added a `--m-*` token or changed how a primitive behaves on phones, update `.claude/rules/phone-layout.md`. If a real design choice was made, run `/record-decision`.
4. If the phone screen changed, say whether the Flutter screen needs the same change. The two must stay alike.

Report what changed, what was verified and how, and anything left unchecked (for example, roles you couldn't sign in as).
