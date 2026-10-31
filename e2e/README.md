# End-to-end tests (Playwright)

The whole suite is **fully mocked**: every `/api/**` call the browser makes
is intercepted by `page.route()` and answered from an in-memory fixture
store (`e2e/fixtures/*.ts`). There is no real login, no real Supabase, and
no record cleanup to run afterward — each test builds and tears down its own
fixture state just by starting and finishing.

```bash
npm run test:e2e          # headless, starts/reuses the dev server automatically
npm run test:e2e:ui       # Playwright's interactive UI mode — best for writing/debugging
npm run test:e2e:watch    # headed, slowed down (SLOWMO=750), one worker — for watching a run live
npm run test:e2e:report   # open the HTML report from the last run
```

No setup beyond `npx playwright install chromium` — there's no account to
create, no `.env.e2e.local` to fill in, and no dev Supabase project this
suite needs to reach.

## How it works

`playwright.config.ts` starts an isolated Next.js dev server on port 3100
(`.next-mock-e2e` build directory, so it never collides with a normal
`npm run dev` on 3000) with `E2E_MOCK_AUTH=true`. `src/proxy.ts` checks that
flag, `NODE_ENV === "development"`, and the absence of `VERCEL` (which
Vercel sets on every build/runtime it manages) before skipping the auth
middleware — three independent conditions, all required, so a production
build or a Vercel deployment can't accidentally enable the bypass even if one
env var were misconfigured. When all three hold, every route behaves as if a
session already exists, so the app renders straight through to the page
under test without a login screen in the way.

The actual API responses then come entirely from `page.route("**/api/**", ...)`
installed at the top of each test (or in a `beforeEach`), reading from and
writing to an in-memory store scoped to that one test. A create, a payment,
a reversal, a delete-guard check — the mock keeps just enough state to make
those operations behave like the real route handler would (see
`e2e/fixtures/salaries.fixtures.ts` or `e2e/fixtures/clients.fixtures.ts` for
the pattern: a `Map` per resource, builder functions for fixture rows, and
one `installXMocks(page, options?)` that wires it all up). Every response
uses the app's real envelope (`{success:true,data,message}` /
`{success:false,error}` — see `src/lib/apiResponse.ts`), and fixture shapes
are built by reading the actual route handler they stand in for, not
guessed.

Because each test installs its own mock, tests are fully independent and
run in parallel safely — there's no shared session, no shared database, and
nothing for one test's data to collide with another's.

### Raw API calls inside a test

A few specs need to hit an endpoint directly rather than through a UI flow
(seeding a second fixture, asserting a delete-guard's exact status code).
`page.request` — a separate `APIRequestContext` — is **not** an option here:
it talks to the network directly from Node and is never routed through
`page.route()`, so it would just fail (or hit a real network) against a
fully-mocked app with nothing real behind it. Use `apiFetch()` from
`e2e/support/apiFetch.ts` instead, which runs the call as a real `fetch()`
*inside* the page via `page.evaluate` — that's what the browser's own
network stack dispatches, and the one thing `page.route()` actually
intercepts. It needs a `page.goto()` to any mocked page first, so there's a
document for the fetch to run in and the route handler is already
installed.

## Layout

```text
e2e/
  support/
    apiFetch.ts     # fetch() via page.evaluate — the only way to hit a mocked
                     # endpoint directly from a test; page.request bypasses page.route()
    human.ts        # humanFill() — slow, per-character typing under SLOWMO
  fixtures/
    salaries.fixtures.ts   # mock-data builders + installSalaryMocks() for /admin/salaries
    loans.fixtures.ts      # installLoansMocks() for /admin/loans and loan detail
    fundings.fixtures.ts   # installFundingsMocks() for the Private Fundings tab
    clients.fixtures.ts    # installClientsMocks() for /admin/clients and client detail
    entities.fixtures.ts   # installEntitiesMocks() for entities/lenders/lookup-options
    trips.fixtures.ts      # installTripsMocks() for the trip-bookings API
    smoke.fixtures.ts      # installSmokeMocks() — broad catch-all for the smoke suite
  pages/
    loansPage.ts       # Page Object for /admin/loans
    fundingsPage.ts    # Page Object for the Private Fundings tab
    clientsPage.ts     # Page Object for /admin/clients
    entitiesPage.ts    # Page Object for /admin/entities
    salariesPage.ts    # page-interaction helpers for /admin/salaries
  features/
    loans/loans.spec.ts
    fundings/fundings.spec.ts
    clients/clients.spec.ts
    entities-lenders-lookups/entities-lenders-lookups.spec.ts
    trips/trips.spec.ts
    salaries/salaries-mocked.spec.ts
    smoke/pages-smoke.spec.ts   # renders every admin page once, asserts no console errors
```

## Writing a new mocked spec

1. Read the handler(s) it stands in for under `src/app/api/**/route.ts` so
   the fixture's field names and response envelope are accurate, not
   guessed.
2. Add (or extend) a fixtures file: builder functions for the fixture rows,
   plus `installXMocks(page, options?)` that installs one
   `page.route("**/api/**", ...)` and answers every path that resource's
   page can call, backed by an in-memory `Map` if the test needs state
   (creates, deletes, delete-guards) to persist across requests.
3. Write the spec against a Page Object where one already exists for that
   page; add one under `e2e/pages/` if not.
4. If the test needs a raw API call outside the UI flow, use `apiFetch()`
   (see above), not `page.request`.
5. **Never type a date into a date input by hard-coding digits** (`"16112025"`).
   Whether the field is day-first or month-first comes from the operating
   system — not Playwright's `locale`, not `--lang` — so a Mac in India and
   a Linux CI runner disagree, and the test passes on one and fails on the
   other. Use `typeDate(page, field, "2025-11-16")` from
   `e2e/support/dateInput.ts`, which asks the browser which order it uses.
   (`.fill("2025-11-16")` is also safe when per-key typing doesn't matter.)
6. Run the suite the way CI does before pushing: `CI=true npm run test:e2e`
   with the dummy Supabase variables from `.github/workflows/quality-checks.yml`.
   It can't catch an operating-system difference like the one above, so when
   CI fails and local passes, ask what the OS decides.

## What changed from the real-backend suite

This suite used to run against the real dev Supabase project with a real
logged-in session (`global-setup.ts`/`global-teardown.ts`, a shared
`storageState`, `RUN_PREFIX`-tagged test data swept up afterward). That has
been retired entirely — every spec is now mocked the same way the salary
page's suite always was. The trade-off: this suite can no longer catch a
regression in real Postgres constraint behavior, RLS, or the Supabase RPCs
themselves (`revoke_old_user_sessions`, `save_driver_attendance`, and so on)
— only in the route handlers' own logic, which the mocks reproduce by hand.
That gap is accepted; it is not something this suite is trying to cover.
