---
name: new-api-route
description: Add or extend an API route in ui-sslogistics the way this codebase expects — right auth level, validation helpers, response envelope, audit log, missing-table fallback, tests, and the Flutter contract. Use when creating a new route.ts or adding a method to one.
argument-hint: <route path, e.g. /api/diesel/[id]/reverse> <what it does>
---

# New API route: $ARGUMENTS

<!--
WHAT THIS FILE IS: a skill — a checklist Claude follows when it adds or extends an API route.
HOW TO RUN IT: `/new-api-route /api/diesel/[id]/reverse "reverse a diesel entry"`, or just ask Claude to
  add a route — the `description` in the frontmatter lets it load this on its own.
WHY IT EXISTS: a "complete" route here is more than the handler: the right auth level, validation helpers,
  an audit-log entry, a fallback if the SQL isn't applied yet, tests, and a check on the Flutter app.
  Past bugs came from skipping one of these; the checklist stops that.
KEEP IN SYNC: the helper names (parseId, readJsonObject, todayInIndia, ...) must exist in the code.
-->

Model it on an existing route that does something similar (a money route for money, `src/app/api/driver-attendance/shift-counts/[driverId]/route.ts` for a simple dated upsert). Read it first; match its shape.

## Checklist

1. **Auth** — first line of the handler:
   - `requireUserAuth()` — any signed-in role may read.
   - `requireAdminAuth()` — admin and staff.
   - `requireStrictAdminAuth()` — admin/superadmin only; **every** method of money routes (loans, fundings, clients, bank accounts, salaries), GET included.
   - `requireSuperAdminAuth()` — sessions, system settings, log purge.
   If a new page goes with it, add it to `src/lib/routePermissions.ts` and `navConfig.ts`.
2. **Input** — ids: integer > 0 (`parseId` in `src/app/api/loans/loans.utils.ts`); body: `readJsonObject(req)` from `src/lib/apiResponse.ts` (null → 400); money: a `moneyProblem`-style check (finite, > 0 unless zero is allowed, ≤ a stated max, ≤ 2 decimals); dates: a real-calendar-date check (`isValidDateString` in `loans.utils.ts`, `isValidDate` in `driver-attendance.utils.ts`), "today" from `todayInIndia()` (`src/lib/dateOnly.ts`), and refuse future dates where the thing can't have happened yet. Free text: trim and cap the length.
3. **Queries** — filter before paginating; build `.or()` only from validated integers or `escapeLike()` text; handle `PGRST205`/`42P01` if the table comes from a `sql/` file that may not be applied yet.
4. **Response** — `apiSuccess(data, message, status)` / `apiError(message, status, code?)`; wrap in `try { … } catch (err) { return handleApiError(err); }`; `serverError(error)` for Supabase errors (never return `error.message` to the client).
5. **Audit** — add an `AuditAction` literal in `src/lib/activityLog.ts` and call `logActivity` inside `after(async () => …)`. Only own-record self-service writes skip this.
6. **Tests** — `test/app/api/<same path>/route.test.ts`: auth (401/403 per role), each validation branch, the happy path, and the database-error path. Follow the mocking style of the neighbouring tests.
7. **Mobile** — if the Flutter app will call it, note the request/response shape for `../mobile_sslogistics` and run the **mobile-contract-checker** agent when changing an existing route.
8. **Docs** — if the route carries a rule others must know (a lock, a derived figure, a delete gate), add it to the matching `.claude/rules/` file.

Finish with `npx vitest run test/app/api/<path>` and `npm run typecheck`.
