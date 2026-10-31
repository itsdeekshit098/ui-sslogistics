# Changelog

What changed for a user or an operator, newest first. One line each — the *how* is in the commit, the *why* is in [decisions/](decisions/README.md), the *current behaviour* is in [features/](features/README.md). `/ship` adds a line here for each change.

## Unreleased (branch `feat/mobile-web-parity`, not yet pushed)

- **Loans:** money amounts have an upper limit and at most two decimals; future-dated and pre-start payments are rejected; closed loans no longer show as overdue; a loan's closing date is recorded; the payment dialog shows its error where you can see it; the list shows "No loans match" with a Clear filters button. ([0005](decisions/0005-closed-loans-are-not-overdue.md))
- **Salaries:** a driver's per-trip pay rate can no longer be read by staff or driver accounts (the pay-type history is admin-only, like every salary read); per-trip drivers can be settled correctly; money amounts and trip counts are range-checked; a future month's trip count is refused; malformed requests and non-integer ids answer 400 instead of 500.
- **Salaries:** a month can only be marked paid once it is over, on the web and in the app — drivers are paid after the month ends, and settling early locked a month whose absences could still change. ([0007](decisions/0007-settle-only-finished-months.md))
- **Clients, Fundings, Trip bookings:** entries dated "today" with no date given now use India time instead of UTC, so one made between midnight and 05:30 IST is no longer dated a day early.
- **Project setup:** `.claude/` rules, agents, skills and hooks; `docs/decisions/` and `docs/features/`. CLAUDE.md is now an index.

## Committed on this branch, not yet released

- **Attendance** (`c609efd`): a repeated shift is rejected ([0002](decisions/0002-reject-duplicate-shifts.md)); lowering a driver's shift count warns about days already marked and leaves them for review ([0003](decisions/0003-shift-count-change-warns-not-rewrites.md)); stale shifts show correctly; the phone filter chips no longer overflow.
- **Vehicles:** document dates and validation fixed; end-to-end tests added.
- **Phone layout:** the admin area matches the Flutter app below 768px.
