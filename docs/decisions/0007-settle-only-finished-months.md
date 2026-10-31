# 0007 — A salary month can be settled only after it ends

- **Status:** Accepted
- **Date:** 2026-10-31
- **Area:** salaries — `POST /api/driver-salaries/[driverId]/settle`, `salaryDriverModal.tsx`, Flutter `salary_driver_sheet.dart`

## Situation

"Mark paid" was allowed while a month was still running. Settling locks the month's entries and rates ([0004](0004-settled-month-is-locked.md)), but attendance stays editable, so an absence or leave marked after an early settlement changed the computed pay with nothing recording the difference. The sheet showed "Attendance has changed since this was settled", but only an admin who noticed and pressed Undo would fix it.

## Options considered

1. **Allow it, rely on the warning.** Supports paying early (salary day on the 28th, a driver leaving mid-month), but the difference is lost if nobody acts.
2. **Allow it, add a "carry ₹X into next month" button** on the drift warning, using the same carry-forward entry settling already makes.
3. **Allow settling only once the month is over.**

## Decision

Option 3. The product owner confirmed drivers are paid for a month **after it ends**, so there is no real case for settling a running month. The server refuses the current month and later with "A month can be settled once it is over" (400). The web and the Flutter app disable "Mark paid" while `is_provisional` is true, with the hint "You can settle this month once it is over." The cut-off is the same one `is_provisional` uses: the month's last day in India time.

## Consequences

- A settled month's figure was computed from a complete month, so early-settlement drift can't happen.
- **Paying a driver mid-month** (for example, someone leaving) is recorded as an **advance** for that month, and the month is settled after it ends; the advance is already part of the pay rule.
- Drift can still appear if attendance for a finished, settled month is corrected later. That case is unchanged: the sheet shows it, and Undo then settle again fixes it.
- If the business ever starts paying before month-end, revisit this: option 2 is the next step, not removing the check.

## Where it shows up

`src/app/api/driver-salaries/[driverId]/settle/route.ts` · `test/app/api/driver-salaries/settle-route.test.ts` (current month refused; 1 July IST allows June) · [salaries feature page](../features/salaries.md) · [.claude/rules/attendance-and-salaries.md](../../.claude/rules/attendance-and-salaries.md)
