# Live testing against the dev server

<!--
WHAT THIS FILE IS: a rule — project knowledge that Claude reads, not a program.
WHEN IT LOADS: EVERY session. It has no `paths:` list (no frontmatter), so Claude always knows how this
  project is tested and what has been tested — you never have to explain it again.
WHY: unit and mocked tests missed most of the real bugs; driving the real app found them. This file is the
  memory of that: the coverage table, the not-yet-covered list, open product questions, the seven-point checklist
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
| Attendance + Salaries, again (Nov 2026; admin only) | Day marking through the buttons (full day, absent, per-trip driver's Present), save, the unsaved-changes prompt, Day↔Month switch, shift-count modal (3→2 with the stale-shift warning), salary modal, Add advance with the new money input (odd keystrokes, ₹1,512.34) and the two-step Reverse; ~250 API probes on attendance PUT/GET, shift counts, rates, entries, reverse, pay type, trip count, settle, unsettle; hand-checked pay (₹30,000, 2 absent + 1 leave → ₹24,500; per-trip 12 × ₹50 = ₹600); settle exact/short/over, locks on a settled month, ordering rules; both CSV exports vs the sheet and register; deactivating a driver; delete blocked by records; 390px attendance and salaries | 3 bugs fixed: malformed/empty JSON gave 500 on attendance PUT and shift-count POST; shifts per day accepted the text `"2"` and `true` (stored as 1); the start month of a shift count, rate or pay type accepted 2999 and 1900. Staff/driver roles not tested. |
| Loans | Create, pay, reverse, waive/bounce, schedule edits, status changes, list filters, UI | 10 bugs fixed; part-paid late EMIs deliberately not handled ([0005](../../docs/decisions/0005-closed-loans-are-not-overdue.md)) |
| Loans, again (Nov 2026, after the UI-library move) | New/Edit Loan and Record Payment with the new date picker and money/number inputs, in real Chrome; part payment, reversal (twice, of a reversal, wrong loan), 14 payment and 7 edit API probes; summary, rows and calendar totals; 390px width; cleaned up by deleting the test loan | 1 bug fixed (stale "required" errors on prefilled date fields); the 31 Jan → 28 Feb first-EMI prefill confirmed; paise shown rounded is logged in known-issues |
| Fundings (Nov 2026; borrowed and lent) | New funding (empty save, typing odd characters, percent and lent), Pay Interest, Repay Principal (incl. over-repayment), Borrow-More API, Change Rate (too high, valid), reverse through the UI; interest checked against hand arithmetic (backdated entries, reversals, a mid-life rate change: all matched to the paisa); ~110 API probes on every route; list summary vs rows vs detail vs the loans summary (lent excluded); Flutter models; 390px; unauthenticated 401 on all 8 methods; cleaned up by reversing and settling the three test fundings | 7 bugs fixed: malformed JSON/null/empty body gave 500; decimal ids (`1.5`) and list filters (`funder_id=abc`) gave 500; a missing funder/loan/borrower on update gave 500; text fields accepted objects ("[object Object]") and a 5,000-character reference stretched the entries table to 40,000px; the funder's "required" message stayed after picking one; a too-high rate said "amount"; long unbroken text ran off the phone timeline. Open questions in [0010](../../docs/decisions/0010-open-funding-product-questions.md) |
| Clients (Nov 2026; admin only) | Add company and individual client (empty save, odd keystrokes, opening balance), edit, delete through the confirm dialog, Add Bill and Record Payment, reverse (double, of a reversal, wrong owner), contacts through the UI, deployments by API; ~150 API probes on every route; statement vs list vs summary totals; the "Owes money" filter and paging; 390px; unauthenticated 401; cleaned up by reversing the entries and marking the test client inactive | 9 bugs fixed: malformed JSON/null body and decimal ids gave 500 on every route; objects stored as "[object Object]" and unlimited text (a 5,000-character location, 3,000-character contact name); a string `"false"` switched `is_active`/`is_primary` on and `0` switched a client off; an unknown client type was accepted; a seating capacity or quantity of a billion was accepted; names differing only by case were accepted; an individual could be renamed away from their entity; the "Owes money" filter cut the page before filtering and counted everyone; a second client for one entity said "name already exists". Product questions answered and built ([0011](../../docs/decisions/0011-open-client-product-questions.md)): invalid opening balance refuses the create, delete blocked by contacts/vehicles, inactive clients take no entries, no future dates, one opening balance, Active switch |
| Drivers | Admin only so far (staff/driver roles pending); add/edit/deactivate/delete, duplicate-name and DL guards, search, phone layout (the "⋯" action sheet), effects on attendance/salaries/diesel pickers | 6 bugs fixed (malformed JSON, non-string/oversized name, `id` validation on PUT, `is_active` as a string, dead `/admin/drivers/new` page, punctuation-only search); see [drivers.md](../../docs/features/drivers.md) |

**Not yet covered live** (Fundings, Clients, Attendance and Salaries were driven live, admin only, staff/driver 403s not yet; the Clients documents panel and the vehicle-linked deployment form were not clicked): Trips and trip bookings, Diesel (the one module drivers can write to), Repair records, Warranty, Technicians, Firms & Owners, Bank accounts, Activity log, Sessions, Settings, the EMI auto-settle script (`scripts/check-loan-emis.js`), the Flutter app, and — for Drivers specifically — the staff/driver role checks. Suggested order: Trips, then Diesel.

**Confirmed bugs not yet fixed** are listed in `docs/known-issues.md` — read it before testing a module, and delete a row when you fix it. **Open product questions** live in `docs/decisions/` with status `Open` (loans: `0006`) — ask the user; don't decide.

What to check in every module:

1. **Create, edit, delete** through the real form: required-field errors, valid save, the list and totals update.
2. **Validation by API:** empty, zero, negative, `1e20`, 3-decimal money, `1.5` as an id, malformed JSON, future and impossible dates, another record's id.
3. **Money modules:** partial, full and over-payment; reversal (twice, a reversal of a reversal, wrong owner); a settled/closed record's locks; derived totals agree on the list, detail, summary, CSV and dashboard.
4. **Roles:** admin, staff, driver (disabled controls *and* 403 on a hand-made request); unauthenticated.
5. **Phone layout** at 390px, and anything that only appears on hover (Mark Paid and Reverse do; check touch).
6. **Effects on other modules:** where the same data shows up elsewhere (pickers, attendance, salaries, dashboard, the Flutter app on the same route), a change here must show there — or deliberately not.
7. **Cleanup and report:** reverse or close test data, say what permanent rows remain, list bugs fixed, bugs left, and questions; refresh the module's `docs/features/` page and `docs/known-issues.md`.

How to start one: `/test-module <module>` (or "test <module> live"). It studies the code, then shows a numbered test plan and **waits for the user's go-ahead** before touching the browser.

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
