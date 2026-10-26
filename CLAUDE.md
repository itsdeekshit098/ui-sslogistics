# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev             # dev server on http://localhost:3000
npm run build           # production build
npm run lint            # eslint
npm run typecheck       # tsc --noEmit
npm run test            # vitest run (unit/integration)
npm run test:watch      # vitest watch mode
npm run test:coverage   # vitest with coverage
npm run test:e2e        # playwright e2e
npm run test:e2e:ui     # playwright e2e, interactive UI
```

Run a single Vitest file with `npx vitest run path/to/file.test.ts`, a single Playwright spec with `npx playwright test e2e/<name>.spec.ts`. The husky `pre-commit` hook runs `lint && typecheck && build && test && test:e2e` — every commit is gated on the full suite, so a commit that succeeds has already passed unit and e2e tests.

## What this app is

Next.js (App Router, TypeScript, React 19) operations portal for SS Logistics, backed by Supabase (auth + Postgres). It is also the **API server for the Flutter mobile app** (`../mobile_sslogistics`) — API changes must keep the mobile client in mind (see root `../CLAUDE.md` for the shared contract).

## Auth architecture (read before touching anything auth-related)

- Supabase **cookie sessions** via `@supabase/ssr`; no bearer tokens. The browser/mobile Supabase keys never reach the client — login goes through `POST /api/auth/login`.
- `src/utils/supabase/middleware.ts` runs on every request: refreshes the session, and short-circuits unauthenticated `/api/*` requests with 401 + `code: "SESSION_INVALID"` **before route handlers execute**. Page requests redirect to `/login`; role-gated `/admin/*` pages are enforced here via `src/lib/routePermissions.ts` (longest-prefix match; roles: `admin | staff | driver`).
- Route handlers additionally call `requireUserAuth` / `requireAdminAuth` / `requireStrictAdminAuth` / `requireSuperAdminAuth` from `src/lib/auth.ts`, which throw `"UNAUTHORIZED..."` / `"FORBIDDEN..."` errors that `handleApiError` (`src/lib/apiResponse.ts`) maps to 401 (`SESSION_INVALID`) / 403. `requireSuperAdminAuth` gates the handful of routes even an admin shouldn't hit alone — session management (`/api/admin/sessions`), maintenance mode and min-app-version (`/api/admin/settings/*`), and activity-log purge.
- **Session-cap enforcement**: login calls the Supabase RPC `revoke_old_user_sessions`, which keeps only the newest session per user — except admin accounts (`app_metadata.role === "admin"`), which are allowed 2 concurrent sessions (e.g. web + mobile at once). The role check lives inside the RPC itself; see `sql/24_admin_two_sessions.sql` for the current definition (must be applied to Supabase manually — there is no migration runner). Admin session management (`/api/admin/sessions`) uses RPCs `get_active_sessions` and `revoke_user_sessions`, which remain role-agnostic.
- Client-side auth state lives in `src/context/AuthContext.tsx` (fetches `/api/auth/session` on mount and on tab-refocus, throttled 15s). `src/app/admin/layout.tsx` redirects to `/login?reason=session_expired` the moment the session disappears; the login page shows an explanatory banner for that query param. Preserve this behavior when changing auth flows.
- Sign-out endpoint is `POST /api/auth/signout` (not `/logout`); the mobile app depends on this path.

## API conventions

- Always respond via `apiSuccess()` / `apiError()` from `src/lib/apiResponse.ts` — clients (including mobile) parse the `{ success, data | error }` envelope, plus optional `code` for machine-readable errors.
- Wrap handlers in try/catch ending in `return handleApiError(err)`; never leak internal error details.
- Validate inputs manually in the handler with explicit type/range checks (no zod).
- `supabaseAdmin` (service-role client, `src/lib/supabase.ts`) is server-only. RLS stays enabled; role checks use `user.app_metadata.role` (never `user_metadata` — users can edit that themselves).
- Mutations write audit entries via `src/lib/activityLog.ts`; add a new `AuditAction` literal there in the same change that adds a new mutating route (e.g. `CREATE_SPECIALIZATION`, `CREATE_REPAIR_ISSUE`) — a lookup-style POST that skips this is a bug, not a style choice. Low-stakes, self-service, own-record writes (marking your own notification read, registering/unregistering your own push token) are the one accepted exception.

## Structure conventions (from agents.md, where still accurate)

- Feature components live in `src/components/<camelCaseName>/` with `componentName.tsx`, `componentName.types.ts`, `index.ts` (plus optional `.constants.ts`, `.utils.ts`, `.hooks.ts`). Generic reusable primitives live in `src/components/ui/`.
- Folders and file names are camelCase; React component exports are PascalCase.
- Keep business logic out of route handlers where practical (`src/services/`, `src/lib/`).

**Note:** `agents.md` also bans Tailwind and external UI primitives and calls for `.style.ts` files, but the codebase mostly uses Tailwind CSS 4, Radix UI primitives, and CVA (shadcn-style `src/components/ui/`). Follow the existing code, not that section of agents.md — except that ~24 older components (several modals, `homePage`, `warrantyPage`, `sessionsPage`, and a few `src/components/ui/` primitives like `modal` and `tooltip`) still genuinely use a `componentName.style.ts` file of plain `CSSProperties` objects, imported as `import * as styles from "./componentName.style"`. These are live code, not dead leftovers — don't delete them on sight. New components should use Tailwind/CVA; migrating an existing `.style.ts` component to Tailwind is a deliberate refactor, not a drive-by cleanup.

## Phone layout (mirrors the Flutter app)

Below `md` (768px) the admin area is styled to match `../mobile_sslogistics`; desktop is untouched by any of it. Navigation is the Flutter-style navy drawer (`src/components/layout/mobileDrawer/`), opened from the app bar's menu button (`mobileTopBar`) or, on `/admin`, from the dashboard's own gradient header (`mobileDashboard`, via `useOpenMobileDrawer`). There is no bottom nav. Page lists come from `navConfig.ts`, the same source as the desktop Sidebar.

Phone-only shape and colour tokens live in `globals.css` as `--m-*` (card 16px, tile 18px, sheet 20px, control 12px, hero/drawer gradients), plus phone dark surfaces on the Flutter slate scale. Shared primitives carry their phone look as `max-md:` classes: `StatCard` becomes the summary-strip tile (any parent of `.ss-stat-card` lays out as a scrolling strip), `Tabs`/`SegmentedControl` become selectable chips, `Badge` a pill, `DataTable` cards the Flutter list card, modals and `BottomSheet` the Flutter form sheet, `PageFab` takes the module colour from `navConfig` (`accent`). `DataTable`'s `mobileCard` prop replaces a phone card's body when a list needs its own layout (Loans uses it). Restyle a phone screen by comparing it with the matching Flutter screen, and keep every change phone-scoped.

Work in progress on this (branch `feat/mobile-web-parity`): state, what's unchecked, and how to preview phone widths in Chrome are in `docs/mobile-parity-handoff.md` — open it only when continuing that work.

`npm run visual:baseline` / `npm run visual:compare` (`e2e-visual/`) screenshot every admin page at 390px (light and dark) and fail on any desktop pixel change. Run baseline before layout work and compare after.

## Database

Schema changes are recorded as SQL files in `sql/`, numbered sequentially (`sql/NN_description.sql`, currently up to `50_driver_salary_settlement.sql`), and applied to Supabase manually — there is no migration runner. Each file carries a `--` header explaining *why* and a commented-out `-- DOWN` rollback section. New tables get `enable row level security` with **no policies** (deny-all for anon; all access is service-role via API routes).

### Money modules (loans, fundings, clients)

Three rules hold across all of them, and breaking any one reintroduces a bug the current design exists to prevent:

- **Derived money is never stored.** Loan outstanding comes from the `loan_balances` view, installment status from `loan_installment_state`, client receivables from `client_balances`. Funding interest is computed per request by `src/app/api/fundings/fundings.utils.ts`. Neither web nor mobile may recompute these — they display what the server returns. (`loans.outstanding_override` is the one exception, and only to match a lender's own statement.)
- **Ledgers are append-only.** `loan_payments`, `funding_entries` and `client_ledger_entries` are never edited or deleted. A mistake is corrected by inserting a row whose `reverses_*_id` points at the original; the views exclude *both* rows, so the pair nets to zero and the history stays auditable. A partial unique index on `reverses_*_id` makes a double-reversal a 409.
- **Every method is `requireStrictAdminAuth()`, GET included** — unlike most feature routes, which let staff read.

The loans list (`GET /api/loans`) takes `sort=ending_soon` (default: active loans first, the one whose last EMI is nearest on top, closed loans last) or `sort=newest` (the web page and the Flutter loans list both send it, so the two agree on order). The last EMI date (`final_due_date`) and the remaining count (`installments_left`) come from the `loan_balances` view, so "ending soon" loads every matching loan, merges balances, sorts and slices the page in the route — the same approach as the fundings list — instead of ordering in SQL.

`entities` is the single master of firms and people. It replaced `vehicle_owners`; `vehicles.owner_entity_id` is the real FK, while `owner_name` / `owner_type` survive as trigger-maintained mirrors so existing readers (the vehicles API, `get_vehicles_summary`, the Flutter app) keep working. `/api/vehicle-owners` is now a thin adapter over `entities`. Unlike the other money-module routes, `/api/entities` GET and POST are intentionally `requireAdminAuth` (not strict) — staff need to read/add entities to pick a borrower or owner elsewhere in the app — while its `PUT`/`DELETE` stay `requireStrictAdminAuth()`. This is a deliberate carve-out (see the inline comment on the route), not a bug to fix.

Label-only dropdown lists (loan types, client types, contact roles, payment methods) live in `lookup_options` and are edited at runtime through `<LookupSelect>`'s "+ Add new" footer or Settings → Dropdown Lists. **Do not add new Postgres enums for these** — `vehicle_type` and friends already demonstrate the cost (defined in the DB, in `vehicles.types.ts`, and in the API validation array, all needing a coordinated deploy).

`bank_accounts` (`sql/34`) holds SS Logistics's own bank accounts (holder is an `entities` row), so a loan can record which account its EMI mandate debits (`loans.debit_account_id`). Like the money modules, `/api/bank-accounts` is `requireStrictAdminAuth` on every method, GET included, and `DELETE` is blocked while any loan or client still references the account.

`attachments` (`sql/38`) is a shared files-per-record table used by vehicles, client ledger entries and loans via three mutually-exclusive nullable FKs (`vehicle_id` / `client_entry_id` / `loan_id`, enforced by a CHECK, each `ON DELETE CASCADE`). Files live in a private Supabase Storage bucket under random-UUID paths; `/api/attachments/view` streams them back through the app's own domain rather than a signed storage URL. Auth follows the owner: vehicle attachments are `requireAdminAuth` (images only), client/loan attachments are `requireStrictAdminAuth` including on read (images, PDF, and plain text).

### Deleting a vehicle

A vehicle delete has to pass two gates, in this order:

1. **Nothing still points at it.** `DELETE /api/vehicles` counts rows in `repair_records`, `warranty`, `repair_parts`, `external_trips`, `diesel_records`, `trip_bookings` and `loans`, and answers 400 with one message listing everything attached ("…still has 6 repair records and 1 loan"). A table that doesn't exist is skipped, not treated as an error. See the standing rule under "Deleting a driver" below — it applies here too: any new `references vehicles(id)` table must be added to this check in the same change that creates it.
2. **The row is unlocked.** `vehicles.allow_permanent_delete` must be `true`. The database enforces this itself and rejects the delete otherwise; the column and its enforcement predate the files in `sql/`, so they are not recorded there. Nothing in the web or mobile UI can set the flag — it is flipped by hand in the Supabase SQL editor, per vehicle, immediately before deleting:

   ```sql
   -- change the id to the vehicle being deleted
   UPDATE vehicles
   SET allow_permanent_delete = TRUE
   WHERE id = 35;
   ```

   Then delete from the Vehicles page as usual. While the flag is false the API answers 400 with `code: "VEHICLE_DELETE_LOCKED"` rather than letting the database's refusal surface as a 500.

There is currently no UI toggle for the flag and the API never sets it. The delete also removes the vehicle's documents and photos from storage, which a raw `DELETE FROM vehicles` in SQL would leave orphaned, so prefer the page over deleting in SQL.

### Deleting a driver

`DELETE /api/drivers` (`src/app/api/drivers/route.ts`) counts rows in every table that references `driver_id`, and answers 400 with one message naming what's attached ("Cannot delete driver because they are linked to 12 attendance record(s). Deactivate them instead.") — nothing is deleted while anything is attached. A table that doesn't exist yet is skipped, not treated as an error, same as the vehicle delete.

**The checked tables, kept in sync with `sql/` by hand:** `external_trips`, `trip_bookings`, `driver_attendance`, `driver_salary_rates`, `driver_salary_entries`, `driver_salary_settlements`, `driver_shift_counts`.

**Standing rule:** any new table with a `driver_id bigint references drivers(id)` column must be added to `dependentChecks` in that route in the same change that creates the table. The foreign key means an unguarded delete still fails safely (Postgres refuses it) rather than orphaning rows, but it surfaces as a raw 500 instead of the friendly message, which is the bug this rule exists to prevent. The same applies to vehicles — see below — and to any future `references drivers(id)` / `references vehicles(id)` table.

In practice, almost no driver can actually be deleted once they've been used anywhere (marked attendance, paid a salary, had their shift count set, booked on a trip). **Deactivate is the real workflow**; delete only clears out a driver who was added by mistake and never touched.

Adding a driver also warns on near-duplicates: `src/lib/similarName.ts` compares the new name/license against existing active drivers, and `AddDriverModal` surfaces a non-blocking warning (not an error — a genuine duplicate name is still legal, e.g. two different people). `sql/49_drivers_normalized_name_unique.sql` backs this with a normalized-name uniqueness constraint at the database level for exact collisions after normalization (case/whitespace), which *does* block the insert — the two are different lines of defense: client-side similarity warning (soft) vs. DB-level exact-normalized uniqueness (hard).

### Shifts per driver

Not every driver runs all three shifts. `driver_shift_counts` (`sql/48_add_driver_shift_counts.sql`) holds how many a driver runs — 1, 2 or 3, meaning the **first N of A, B, C** — and, like a salary rate, a change applies from a month onward so earlier months keep the count they were marked against. A driver with no row runs three.

That number is what a **full day** means for them, and so what full pay means: a two-shift driver who works A and B is on a full day and loses nothing. Pay is never divided by shift count — only Absent and Leave cut a day's pay (see "Driver salaries" below). Every driver on `/api/driver-attendance` carries `shift_count`, the attendance page offers only that driver's shifts (via `shiftCountModal.tsx`), and the save route rejects a shift the driver doesn't run rather than silently dropping it.

`GET /api/driver-attendance/shift-counts/[driverId]` (any logged-in role) returns the history; `POST` (admin/superadmin only) takes `{ shift_count, effective_month, note? }` and upserts — saving again for the same `effective_month` corrects that row rather than duplicating, same convention as salary rates.

### Driver attendance

`driver_attendance` holds one row per driver per day: three shift booleans (A, B, C) plus a status (`PRESENT` / `ABSENT` / `LEAVE`), with a check constraint that present means at least one shift and absent/leave means none. "Not marked" is the absence of a row — clearing a mark deletes it. Month totals (shifts, full days, absences, leave) are counted per request, never stored.

`/api/driver-attendance` serves both clients: `GET ?date=` (one day, every active driver, plus each driver's previous day for "copy yesterday"), `GET ?month=` (the register with totals) and `PUT` (only the changed drivers for one date, in one request; returns the day as stored). The write goes through the `save_driver_attendance` database function (`sql/46`) so the stores and the clears land together or not at all; until that function exists in a database the route falls back to two separate, non-atomic writes. On the wire a mark is `{ shifts: ["A","B"], status: "ABSENT" | "LEAVE" | null }` — present is implied by shifts. Reading is open to every role (`requireUserAuth()`), but marking is admin/superadmin only (`requireStrictAdminAuth()` on `PUT`) because the marks decide wages — staff and drivers get the same screens with every control disabled, driven by the `editable` flag in the day response. Nobody can mark a future date. `GET /api/driver-attendance/export?month=` returns the month as a CSV for wages (totals first, then one column per day) and is admin-only too. "Today" is IST, computed by the server and returned as `today`, and the server alone decides what is editable. The one thing the clients add: a screen left open past midnight moves its own "today" *forward* to the device's IST date (never back), so "next day" isn't stuck disabled until a reload.

The page (`src/components/attendancePage/`) mounts a different layout below `md`: desktop spells out Full day · A B C · Absent · Leave per row, phones use a tick + three-cell shift block + "more" menu so a row stays one line. Both are sized for 30–40 drivers: client-side search by name/place, counts that double as filters, and a register that scrolls inside its own box with the day header and driver column pinned.

### Driver salaries

Salaries follow the money modules' three rules: nothing derived is stored, the ledger is append-only with reversals, and every method — GET included — is `requireStrictAdminAuth()` (attendance is readable by every role; what it works out to in rupees is not).

A month's pay is computed per request in `src/app/api/driver-salaries/driver-salaries.utils.ts` (`computePay`), from three inputs:

- `driver_salary_rates` — the monthly salary and the month it applies from (`effective_from`, always the 1st). The salary for a month is the latest rate on or before it, so a raise never rewrites earlier months. Saving again for the *same* starting month corrects that row in place (a typo fix); everything else is a new row.
- `driver_attendance` — days marked Absent or Leave.
- `driver_salary_entries` — `ADVANCE` and `DEDUCTION` rows against a `period_month`, append-only; a mistake is cancelled by a row with `reverses_entry_id`, and both drop out of the totals.

The rule: day's pay = monthly salary ÷ calendar days in that month; attendance cut = day's pay × (absent + leave days), rounded to the rupee and capped at the salary; net = salary − cut − advances − deductions (it may go negative). Leave is unpaid like absent. A day with any shift worked is a paid day regardless of how many shifts, and a day with **no mark at all is paid** — only an explicit Absent/Leave costs pay — but the sheet reports `unmarked_days` so gaps are visible. A month that hasn't finished is flagged `is_provisional`.

Routes: `GET /api/driver-salaries?month=` (the sheet + totals), `GET /api/driver-salaries/export?month=` (CSV), `GET /api/driver-salaries/[driverId]?month=` (one driver's line, rate history and entries), `POST …/[driverId]/rates`, `POST …/[driverId]/entries`, `POST …/[driverId]/entries/[entryId]/reverse`, `POST …/[driverId]/settle`, `DELETE …/[driverId]/settle/[settlementId]`. The page is `/admin/salaries` (`src/components/salariesPage/`), admin/superadmin only. A driver with salary rows can no longer be deleted, only deactivated.

#### Settling a month

Settling records what was actually paid for a month (`driver_salary_settlements`, `sql/50`) — a fact separate from the computed `net_pay`, not another derived figure. `POST …/[driverId]/settle` takes `{ period_month, amount_paid, note? }`; if `amount_paid` differs from the computed `net_pay`, the gap becomes an ordinary `driver_salary_entries` row (`ADVANCE` if overpaid, `DEDUCTION` if underpaid) dated into *next* month and tagged `settlement_id`, so the existing pay rule picks it up automatically — no new money-derivation logic. `DELETE …/[driverId]/settle/[settlementId]` undoes it: reverses that carry-forward entry (if any), clears its `settlement_id`, then deletes the settlement row. Both writes go through single-transaction database functions (`settle_driver_salary` / `unsettle_driver_salary`, `sql/50`) — the same all-or-nothing pattern as `save_driver_attendance` (`sql/46`) — with a non-atomic three-write fallback while those functions don't exist in a database yet, same convention as attendance.

A settled month is locked: `POST …/entries`, `POST …/rates`, and reversing any entry dated into that month all 409. `POST …/rates` checks more than just the starting month being settled — since a rate applies from its starting month forward (`salaryForMonth` picks the latest rate on or before each month), it refuses the write if the driver has *any* settlement on or after the starting month, so a raise backdated before a settled month can't silently change what that month was paid against. A carry-forward entry can only be undone by unsettling the settlement that made it — the reverse route refuses it directly. Settling month M is refused with a 409 if M+1 is already settled (the carry-forward would silently change a month already closed out), and unsettling mirrors that check in reverse. Attendance marks are not gated by settlement — correcting one for a settled month still works, since attendance is a separate module — so a settled driver's live `net_pay` can still drift from `net_pay_computed`; the modal surfaces that drift rather than hiding it.

### Activity log retention

`activity_log` is append-only except for one path: `DELETE /api/activity-log?before=<iso>`, superadmin-only, driven by the "Clear Old Logs" button on `/admin/activity-log`. The server refuses any cutoff newer than `MIN_RETENTION_DAYS` (60), the UI runs a `?dryRun=true` count before the real delete, and the purge writes its own `PURGE_ACTIVITY_LOG` entry *after* deleting so the record of it survives. Deleting here does not break the money audit trail — `loan_payments`, `funding_entries` and `client_ledger_entries` each carry their own `created_by`, and reversals stay on the ledger permanently.

## Scheduled jobs

Daily GitHub Actions in `.github/workflows/`, each running a standalone CommonJS script from `scripts/` that talks to Supabase directly with the service-role key (they do not go through Next.js). `check-loan-emis.js` warns a day before each EMI, nags at 1/7/15/30 days overdue, and flags a loan reaching its final installment; it dedupes against the `notifications` table by `type` + metadata before sending, so a re-run can't double-notify.

Before any of that, the same script **auto-settles** every EMI whose due date has passed with nothing logged against it (`autoSettleOverdueEmis`): it inserts a real `loan_payments` row itself (`payment_method: 'AUTO'`, `paid_on` = the due date), on the assumption the mandate went through. This is a deliberate product decision, not a bug — it trades ledger accuracy for zero manual "mark paid" clicks, on the basis that a genuine miss gets caught externally (the lender chases it) rather than by the app. Consequences worth knowing before touching this code: `loan_balances.outstanding` and `loan_installment_state.status` will read as paid/settled for money that was only assumed, not confirmed; every auto-row is tagged and logged to `activity_log` (`CREATE_LOAN_PAYMENT`, `details.auto: true`) and shows its origin in the loan detail payment history (notes + `payment_method: "AUTO"`) precisely so a real miss can be found and reversed through the normal reversal endpoint — there is no automated un-settling. `BOUNCED` installments are deliberately excluded (that `manual_status` already means a mandate is *known* to have failed, so auto-paying over it would hide a confirmed problem). A `loan_emi_auto_settled` notification fires per auto-settled installment so admins still have visibility without needing to act.

## Maintenance mode and push notifications

`system_settings` (`sql/19`) is a singleton row (`maintenance_mode`, `maintenance_message`) with no dedicated write route in this codebase — it's flipped by hand in Supabase, and `GET /api/system/maintenance-stream` (no auth, must work pre-login) is an SSE stream polling it every second so clients react without reloading. `GET /api/system/app-version` is likewise unauthenticated, backing the minimum-app-version gate mentioned under auth architecture.

`device_push_tokens` (`sql/21`) stores one FCM token per `(user_id, token)` pair with a `platform`. `POST /api/notifications/register-device` (any logged-in role) reassigns a token away from any other user before upserting it for the caller, so a forced logout on shared/reused devices can't leave push notifications going to the wrong account; `DELETE ?token=` unregisters the caller's own token on sign-out.

## Error tracking (Sentry)

- `@sentry/nextjs` is initialized via `instrumentation.ts` (server/edge) and `instrumentation-client.ts` (browser), sharing options from `src/lib/sentry/options.ts`. `next.config.ts` is wrapped with `withSentryConfig` for source-map upload.
- **PII-safe by design**: `sendDefaultPii: false` plus a `beforeSend` scrubber strip cookies, auth headers, and request bodies before events leave the process — mirroring the no-PII contract in `src/lib/logger.ts`. User context attached via `src/lib/sentry/setUser.ts` is **id + role only**, never email.
- Capture happens at the app's existing error funnels rather than scattered call sites: the generic-500 branch of `handleApiError` (`src/lib/apiResponse.ts`, skips the expected `UNAUTHORIZED`/`FORBIDDEN`/`MAINTENANCE` cases) and the `error.tsx` / `admin/error.tsx` / `global-error.tsx` boundaries.
- Required env vars (see `.env.local`): `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ENVIRONMENT` / `NEXT_PUBLIC_SENTRY_ENVIRONMENT`. `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` are build-time only (source-map upload) — the build succeeds without them, just with unminified stack traces missing in Sentry.
- The Sentry tunnel route (`/monitoring`, set via `tunnelRoute` in `next.config.ts`) is listed in `MAINTENANCE_EXEMPT_PATHS` (`src/utils/supabase/middleware.ts`) so client error reports aren't blocked during maintenance mode.

