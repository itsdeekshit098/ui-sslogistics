# End-to-end tests (Playwright)

Real browser, real login, real Supabase-backed dev database — this is not
the mocked route-handler suite in `test/` (`npm run test`). Use these when
you need proof a flow actually works end to end; use `test/` for everything
else, since it's orders of magnitude faster and doesn't touch real data.

## One-time setup

```bash
cp .env.e2e.local.example .env.e2e.local
# fill in E2E_EMAIL / E2E_PASSWORD — an admin or superadmin account
npx playwright install chromium
```

## Running

```bash
npm run test:e2e          # headless, starts/reuses the dev server automatically
npm run test:e2e:ui       # Playwright's interactive UI mode — best for writing/debugging
npm run test:e2e:report   # open the HTML report from the last run
```

## Before you touch this: the single-session gotcha

The account this suite logs in as can hold **one session at a time**,
period — unless its `app_metadata.role` is exactly `"admin"`, in which case
`revoke_old_user_sessions` (see `sql/24_admin_two_sessions.sql`) allows two.
**Superadmin does not get that allowance.** Logging in anywhere else with the
same account (your own browser tab, the mobile app, a second local run)
silently signs out whichever session was already active.

Consequence for how this suite is built: **only `e2e/support/global-setup.ts`
is allowed to call the login endpoint.** It logs in exactly once per run and
saves the resulting cookies to `e2e/.auth/admin.json`
(gitignored), which every test's browser context loads via
`use.storageState` in `playwright.config.ts`. Tests run fully parallel
across files because they all share that one already-authenticated session —
never add a second `POST /api/auth/login` call anywhere in a spec, or you'll
invalidate every other test's session mid-run and get a wall of confusing
401s that have nothing to do with whatever you were actually testing.

If you need a *different* role in a test (e.g. asserting a `staff` account
can't reach a money-module page), open an incognito-equivalent context with
its own `storageState: undefined}` and log that one in by hand inside the
test — just know it will kick the shared admin session out for the rest of
the run, so put role/permission tests last or in their own project.

## Test data hygiene

Every record a test creates must carry `RUN_PREFIX` (from
`e2e/support/run-id.ts`, via the `testLabel()` helper) somewhere
identifiable — an entity/lender/client's `name`, a loan's `loan_number`, a
funding's `notes`. Two reasons:

1. It's how you tell your own test's rows apart from real dev data when
   debugging in Supabase directly.
2. `global-teardown.ts` greps for `RUN_PREFIX` across loans/fundings/clients/
   entities/lenders after the run and deletes anything that matches — a
   safety net for tests that fail before their own cleanup runs. It is *not*
   a substitute for each spec cleaning up after itself in `test.afterEach`;
   it's what catches what that missed.

This suite runs against the real dev Supabase project (same one the app's
`.env.local` points at) — there is no ephemeral/disposable test database.
Treat every write as something a human could see in the admin UI a minute
later.

## Layout

```
e2e/
  support/
    global-setup.ts     # the one and only login, saves storageState
    global-teardown.ts  # sweeps up anything RUN_PREFIX-tagged that survived
    run-id.ts           # RUN_PREFIX + testLabel() helper
  loans.spec.ts
  fundings.spec.ts
  clients.spec.ts
  entities-lenders-lookups.spec.ts
  pages-smoke.spec.ts   # renders every admin page once, asserts no console errors
```
