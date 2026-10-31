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

## Project knowledge in `.claude/`

The detailed rules live in `.claude/rules/`. A rule with `paths:` loads by itself when a matching file is read; `live-testing.md` loads in every session. If you are planning work in an area before opening its files, read its rule first. The invariants that most often matter:

| Rule file | Covers | Never break |
|---|---|---|
| `database-and-money.md` | `sql/` conventions, loans, fundings, clients, entities, lookups, bank accounts, attachments | Derived money is never stored; ledgers are append-only with reversals; every money method is `requireStrictAdminAuth()`, GET included. SQL files are applied by hand; the latest number is recorded only in this rule file. |
| `attendance-and-salaries.md` | Attendance, shifts per driver, pay type, salaries, settling | Server computes every figure; "today" is IST; a settled month is locked; marking is admin-only. |
| `record-deletion.md` | Deleting vehicles and drivers | A new `references drivers(id)` / `vehicles(id)` table is added to the delete check in the same change. |
| `phone-layout.md` | The phone (`max-md:`) layout that mirrors Flutter | Phone changes stay phone-scoped; desktop pixels never change. |
| `platform-ops.md` | Activity log purge, GitHub Actions scripts (EMI auto-settle), maintenance mode, push tokens, Sentry | Auto-settle is a deliberate product decision; Sentry carries id + role, never email. |
| `live-testing.md` | What has been tested live, what hasn't, and how to test | A module isn't tested until it has been driven live. |

## Memory for later: what, why, and what it looks like

Rules in `.claude/rules/` say what is true *now*. Three more records keep the rest, so a developer (or a fresh chat) can understand a change months later:

- `docs/decisions/` — one short note per choice: situation, options rejected, what was chosen, what it costs. Check it before reversing something that looks wrong; add to it with `/record-decision`. Status `Open` means a product question the user hasn't answered — ask, don't decide.
- `docs/features/<module>.md` — what a person sees and can do on each screen, by role, desktop and phone, in words. **No screenshots are committed** (they bloat history and show real data); use `/screenshots` or `npm run visual:baseline`.
- `docs/CHANGELOG.md` — one line per user-visible change.

When you change a screen, a flow or a rule, update its feature page and add a decision if a real choice was made — in the same commit.

## Agents, skills and hooks

See `.claude/README.md` for the full map. In short:

- **Skills (slash commands):** `/test-module <name>` runs the live-test method on one module; `/new-api-route` adds a route the way this codebase expects; `/record-decision` writes down why a choice was made; `/screenshots <module>` captures screens into a git-ignored folder; `/ship` checks a change is ready and commits only when the user says so.
- **Subagents:** `live-tester`, `code-reviewer`, `migration-author`, `mobile-contract-checker`. Use them for long or independent work so their output stays out of the main conversation.
- **Hooks** (`.claude/settings.json`): edits to `.env*` files and `--no-verify` commits are blocked; editing a route or a `sql/` file adds reminders about the rules above; `git push` always asks first.
