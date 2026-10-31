# Live testing against the dev server

<!--
WHAT THIS FILE IS: a rule — project knowledge that Claude reads, not a program.
WHEN IT LOADS: EVERY session. It has no `paths:` list (no frontmatter), so Claude always knows how this
  project is tested and what has been tested — you never have to explain it again.
WHY: unit and mocked tests missed most of the real bugs; driving the real app found them. This file is the
  memory of that: the coverage table, the not-yet-covered list, open product questions, the six-point checklist
  and the how-to rules (never type a password, close extra tabs, keep calls under 45 s, ...).
KEEP IN SYNC: after testing a module, update its row in the table and the "not yet covered" list.
  /test-module does this as its last step.
-->

Unit and mocked e2e tests did not catch most of the bugs found by exercising the real app, so a module is not "tested" until it has also been driven live. When the user asks to test something, check this table first, test what is listed as not covered, and update the table when you finish.

| Area | Covered live (Oct 2026) | Outcome |
|---|---|---|
| Phone layout | ~20 pages at several widths, light and dark | Matches Flutter; see `docs/mobile-parity-handoff.md` |
| Vehicles | Add, edit, upload all six document types, dates, photos, delete gates | Several bugs fixed; 15 e2e tests in `e2e/features/vehicles/` |
| Attendance | Admin, staff and driver roles; desktop and phone; shift counts; per-trip drivers; export | Fixed duplicate shifts, stale shifts, phone chips; added shift-count warning |
| Salaries | Pay rule, rates, entries, reversals, settle/undo, per-trip, CSV, UI | 6 bugs fixed (per-trip settle, money limits, trip count, malformed JSON, ids) |
| Loans | Create, pay, reverse, waive/bounce, schedule edits, status changes, list filters, UI | 10 bugs fixed; part-paid late EMIs deliberately not handled ([0005](../../docs/decisions/0005-closed-loans-are-not-overdue.md)) |

**Not yet covered live:** Clients, Fundings (borrowed and lent), Drivers, Trips and trip bookings, Diesel (the one module drivers can write to), Repair records, Warranty, Technicians, Firms & Owners, Bank accounts, Activity log, Sessions, Settings, the EMI auto-settle script (`scripts/check-loan-emis.js`), the Flutter app. Suggested order: Clients and Fundings (money), then Drivers, Trips, Diesel.

**Confirmed bugs not yet fixed** are listed in `docs/known-issues.md` — read it before testing a module, and delete a row when you fix it. **Open product questions** live in `docs/decisions/` with status `Open` (loans: `0006`) — ask the user; don't decide.

What to check in every module:

1. **Create, edit, delete** through the real form: required-field errors, valid save, the list and totals update.
2. **Validation by API:** empty, zero, negative, `1e20`, 3-decimal money, `1.5` as an id, malformed JSON, future and impossible dates, another record's id.
3. **Money modules:** partial, full and over-payment; reversal (twice, a reversal of a reversal, wrong owner); a settled/closed record's locks; derived totals agree on the list, detail, summary, CSV and dashboard.
4. **Roles:** admin, staff, driver (disabled controls *and* 403 on a hand-made request); unauthenticated.
5. **Phone layout** at 390px, and anything that only appears on hover (Mark Paid and Reverse do; check touch).
6. **Cleanup and report:** reverse or close test data, say what permanent rows remain, list bugs fixed, bugs left, and questions.

How to do it:

- **Real clicks for flows, direct API calls for rules.** Click through the actual screens (forms, dialogs, the phone layout at 390px), then probe the API from the page with `fetch` for edges the UI can't produce: empty, negative, zero, `1e20`, 3-decimal amounts, `1.5` as an id, malformed JSON, a future date, another record's id, a repeated or reversed action.
- **Test each role.** Admin, staff and driver behave differently; check that controls are disabled *and* that the server answers 403 to a hand-made request.
- **Check totals, not just the row.** After any money change, confirm the sheet, the portfolio summary, the CSV export and the "overdue"/"needs attention" figures all agree.
- **Use clearly named test data** (`ZZ-E2E-…`), use a spare record rather than a real one, and reverse or close what you create. Ledgers are append-only and cannot be deleted, so every test payment, entry or setting leaves a permanent row; say so in the report.
- **Never type a password.** The user signs in in the Chrome window; the session times out after 15 minutes idle, so be ready to ask again.
- **Close other app tabs/windows first.** Each page holds SSE streams and Chrome allows six connections per host, so a few open windows make API calls queue for 40+ seconds and look like a hang.
- **Keep each browser call under ~45 s** (split loops), and re-define any `window.` helper after a page reload.
- **Fixes need a test at each layer:** a unit test for the rule, then re-run the live probe that found it. Add a `sql/NN_*.sql` file (and say it must be applied by hand) when the cause is a view or constraint, and re-test live once the user has applied it.
- **Recurring bug classes to look for in every module:** no upper limit or paise check on money; `Number(x)` accepting `1.5`/`""` as an id (use `parseId`); `req.json()` throwing a 500 (use `readJsonObject`); dates taken from UTC instead of India (`todayInIndia()`); a filter applied after pagination; a PostgREST `.or()` string built from user text; status or derived views disagreeing with each other.
