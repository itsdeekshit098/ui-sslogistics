# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # dev server on http://localhost:3000
npm run build      # production build
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
```

There is no automated test suite. Verify changes with `npm run typecheck` and `npm run lint`.

## What this app is

Next.js (App Router, TypeScript, React 19) operations portal for SS Logistics, backed by Supabase (auth + Postgres). It is also the **API server for the Flutter mobile app** (`../mobile_sslogistics`) — API changes must keep the mobile client in mind (see root `../CLAUDE.md` for the shared contract).

## Auth architecture (read before touching anything auth-related)

- Supabase **cookie sessions** via `@supabase/ssr`; no bearer tokens. The browser/mobile Supabase keys never reach the client — login goes through `POST /api/auth/login`.
- `src/utils/supabase/middleware.ts` runs on every request: refreshes the session, and short-circuits unauthenticated `/api/*` requests with 401 + `code: "SESSION_INVALID"` **before route handlers execute**. Page requests redirect to `/login`; role-gated `/admin/*` pages are enforced here via `src/lib/routePermissions.ts` (longest-prefix match; roles: `admin | staff | driver`).
- Route handlers additionally call `requireUserAuth` / `requireAdminAuth` / `requireStrictAdminAuth` from `src/lib/auth.ts`, which throw `"UNAUTHORIZED..."` / `"FORBIDDEN..."` errors that `handleApiError` (`src/lib/apiResponse.ts`) maps to 401 (`SESSION_INVALID`) / 403.
- **Session-cap enforcement**: login calls the Supabase RPC `revoke_old_user_sessions`, which keeps only the newest session per user — except admin accounts (`app_metadata.role === "admin"`), which are allowed 2 concurrent sessions (e.g. web + mobile at once). The role check lives inside the RPC itself; see `sql/24_admin_two_sessions.sql` for the current definition (must be applied to Supabase manually — there is no migration runner). Admin session management (`/api/admin/sessions`) uses RPCs `get_active_sessions` and `revoke_user_sessions`, which remain role-agnostic.
- Client-side auth state lives in `src/context/AuthContext.tsx` (fetches `/api/auth/session` on mount and on tab-refocus, throttled 15s). `src/app/admin/layout.tsx` redirects to `/login?reason=session_expired` the moment the session disappears; the login page shows an explanatory banner for that query param. Preserve this behavior when changing auth flows.
- Sign-out endpoint is `POST /api/auth/signout` (not `/logout`); the mobile app depends on this path.

## API conventions

- Always respond via `apiSuccess()` / `apiError()` from `src/lib/apiResponse.ts` — clients (including mobile) parse the `{ success, data | error }` envelope, plus optional `code` for machine-readable errors.
- Wrap handlers in try/catch ending in `return handleApiError(err)`; never leak internal error details.
- Validate inputs manually in the handler with explicit type/range checks (no zod).
- `supabaseAdmin` (service-role client, `src/lib/supabase.ts`) is server-only. RLS stays enabled; role checks use `user.app_metadata.role` (never `user_metadata` — users can edit that themselves).
- Mutations write audit entries via `src/lib/activityLog.ts`.

## Structure conventions (from agents.md, where still accurate)

- Feature components live in `src/components/<camelCaseName>/` with `componentName.tsx`, `componentName.types.ts`, `index.ts` (plus optional `.constants.ts`, `.utils.ts`, `.hooks.ts`). Generic reusable primitives live in `src/components/ui/`.
- Folders and file names are camelCase; React component exports are PascalCase.
- Keep business logic out of route handlers where practical (`src/services/`, `src/lib/`).

**Note:** `agents.md` also bans Tailwind and external UI primitives, but the codebase actually uses Tailwind CSS 4, Radix UI primitives, and CVA (shadcn-style `src/components/ui/`). Follow the existing code, not that section of agents.md.

## Database

Schema changes are recorded as SQL files in `sql/`, numbered sequentially (`sql/NN_description.sql`, currently up to `39_activity_log_created_at_index.sql`), and applied to Supabase manually — there is no migration runner. Each file carries a `--` header explaining *why* and a commented-out `-- DOWN` rollback section. New tables get `enable row level security` with **no policies** (deny-all for anon; all access is service-role via API routes).

### Money modules (loans, fundings, clients)

Three rules hold across all of them, and breaking any one reintroduces a bug the current design exists to prevent:

- **Derived money is never stored.** Loan outstanding comes from the `loan_balances` view, installment status from `loan_installment_state`, client receivables from `client_balances`. Funding interest is computed per request by `src/app/api/fundings/fundings.utils.ts`. Neither web nor mobile may recompute these — they display what the server returns. (`loans.outstanding_override` is the one exception, and only to match a lender's own statement.)
- **Ledgers are append-only.** `loan_payments`, `funding_entries` and `client_ledger_entries` are never edited or deleted. A mistake is corrected by inserting a row whose `reverses_*_id` points at the original; the views exclude *both* rows, so the pair nets to zero and the history stays auditable. A partial unique index on `reverses_*_id` makes a double-reversal a 409.
- **Every method is `requireStrictAdminAuth()`, GET included** — unlike most feature routes, which let staff read.

`entities` is the single master of firms and people. It replaced `vehicle_owners`; `vehicles.owner_entity_id` is the real FK, while `owner_name` / `owner_type` survive as trigger-maintained mirrors so existing readers (the vehicles API, `get_vehicles_summary`, the Flutter app) keep working. `/api/vehicle-owners` is now a thin adapter over `entities`.

Label-only dropdown lists (loan types, client types, contact roles, payment methods) live in `lookup_options` and are edited at runtime through `<LookupSelect>`'s "+ Add new" footer or Settings → Dropdown Lists. **Do not add new Postgres enums for these** — `vehicle_type` and friends already demonstrate the cost (defined in the DB, in `vehicles.types.ts`, and in the API validation array, all needing a coordinated deploy).

### Activity log retention

`activity_log` is append-only except for one path: `DELETE /api/activity-log?before=<iso>`, superadmin-only, driven by the "Clear Old Logs" button on `/admin/activity-log`. The server refuses any cutoff newer than `MIN_RETENTION_DAYS` (60), the UI runs a `?dryRun=true` count before the real delete, and the purge writes its own `PURGE_ACTIVITY_LOG` entry *after* deleting so the record of it survives. Deleting here does not break the money audit trail — `loan_payments`, `funding_entries` and `client_ledger_entries` each carry their own `created_by`, and reversals stay on the ledger permanently.

## Scheduled jobs

Daily GitHub Actions in `.github/workflows/`, each running a standalone CommonJS script from `scripts/` that talks to Supabase directly with the service-role key (they do not go through Next.js). `check-loan-emis.js` warns a day before each EMI, nags at 1/7/15/30 days overdue, and flags a loan reaching its final installment; it dedupes against the `notifications` table by `type` + metadata before sending, so a re-run can't double-notify.

## Error tracking (Sentry)

- `@sentry/nextjs` is initialized via `instrumentation.ts` (server/edge) and `instrumentation-client.ts` (browser), sharing options from `src/lib/sentry/options.ts`. `next.config.ts` is wrapped with `withSentryConfig` for source-map upload.
- **PII-safe by design**: `sendDefaultPii: false` plus a `beforeSend` scrubber strip cookies, auth headers, and request bodies before events leave the process — mirroring the no-PII contract in `src/lib/logger.ts`. User context attached via `src/lib/sentry/setUser.ts` is **id + role only**, never email.
- Capture happens at the app's existing error funnels rather than scattered call sites: the generic-500 branch of `handleApiError` (`src/lib/apiResponse.ts`, skips the expected `UNAUTHORIZED`/`FORBIDDEN`/`MAINTENANCE` cases) and the `error.tsx` / `admin/error.tsx` / `global-error.tsx` boundaries.
- Required env vars (see `.env.local`): `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ENVIRONMENT` / `NEXT_PUBLIC_SENTRY_ENVIRONMENT`. `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` are build-time only (source-map upload) — the build succeeds without them, just with unminified stack traces missing in Sentry.
- The Sentry tunnel route (`/monitoring`, set via `tunnelRoute` in `next.config.ts`) is listed in `MAINTENANCE_EXEMPT_PATHS` (`src/utils/supabase/middleware.ts`) so client error reports aren't blocked during maintenance mode.

