# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # dev server on http://localhost:3000
npm run build      # production build
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
```

There is no test suite. Verify changes with `npm run typecheck` and `npm run lint`.

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

Schema changes are recorded as SQL files in `sql/` (e.g. `sql/2026-07-02_restore_get_vehicles_summary.sql`) and applied to Supabase manually — there is no migration runner.
