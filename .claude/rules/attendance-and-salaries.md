---
paths:
  - "src/app/api/driver-attendance/**"
  - "src/app/api/driver-salaries/**"
  - "src/components/attendancePage/**"
  - "src/components/salariesPage/**"
  - "test/app/api/driver-attendance/**"
  - "test/app/api/driver-salaries/**"
  - "test/components/attendancePage/**"
  - "sql/*driver*"
  - "sql/*pay_type*"
---

# Driver attendance, shifts and salaries

<!--
WHAT THIS FILE IS: a rule — project knowledge that Claude reads, not a program.
WHEN IT LOADS: automatically when Claude reads the driver-attendance or driver-salaries routes, the attendance
  or salaries page components, their tests, or a sql/ file with "driver" or "pay_type" in its name.
WHY: wages are computed from attendance, so the rules are exact — pay = salary ÷ days in month, only Absent/Leave
  cut pay, an unmarked day is paid, a settled month is locked, "today" is IST, only admins can mark.
  The web and the Flutter app both display what the server computes; neither may recompute it.
EXAMPLE: before changing how absences are counted, read this — the change goes in driver-salaries.utils.ts only.
-->

## Shifts per driver

Not every driver runs all three shifts. `driver_shift_counts` (`sql/48_add_driver_shift_counts.sql`) holds how many a driver runs — 1, 2 or 3, meaning the **first N of A, B, C** — and, like a salary rate, a change applies from a month onward so earlier months keep the count they were marked against. A driver with no row runs three.

That number is what a **full day** means for them, and so what full pay means: a two-shift driver who works A and B is on a full day and loses nothing. Pay is never divided by shift count — only Absent and Leave cut a day's pay (see "Driver salaries" below). Every driver on `/api/driver-attendance` carries `shift_count`, the attendance page offers only that driver's shifts (via `shiftCountModal.tsx`), and the save route rejects a shift the driver doesn't run rather than silently dropping it.

`GET /api/driver-attendance/shift-counts/[driverId]` (any logged-in role) returns the history; `POST` (admin/superadmin only) takes `{ shift_count, effective_month, note? }` and upserts — saving again for the same `effective_month` corrects that row rather than duplicating, same convention as salary rates.

## Driver pay type: MONTHLY vs PER_TRIP

Not every driver is paid a monthly salary. `driver_pay_types` (`sql/51_add_holiday_status_and_pay_type.sql`) holds which model applies — `MONTHLY` (the original rule, `driver_salary_rates` as before) or `PER_TRIP` (a rate per trip, times however many trips the driver ran that month) — dated the same way as a salary rate or shift count: a switch applies from a month onward, so earlier months keep the pay model they were actually paid under. A driver with no row is `MONTHLY`. `rate_per_trip` is required and positive for `PER_TRIP` rows, null for `MONTHLY` rows.

Trip counts live in `driver_trip_counts`, one editable row per driver per month (`period_month`, `trip_count`) — a corrected-in-place fact like a salary rate or shift count, not an append-only ledger. These are entered by hand and are **not** derived from `external_trips` or `trip_bookings`, which don't reliably cover every trip-paid driver's work.

`GET/POST /api/driver-salaries/[driverId]/pay-type` and `GET/POST /api/driver-salaries/[driverId]/trip-count` are both `requireStrictAdminAuth()`, same as the rest of the salary module. A `PER_TRIP` driver's attendance screen has no shift buttons (their pay doesn't depend on which shift they drove), so pay *type* — never the rate — is also surfaced read-only through `/api/driver-attendance` for every role, driving which controls the attendance UI shows.

## Driver attendance

`driver_attendance` holds one row per driver per day: three shift booleans (A, B, C) plus a status (`PRESENT` / `ABSENT` / `LEAVE` / `HOLIDAY`), with a check constraint that absent/leave/holiday means no shifts, while present allows either shifts (the normal case) or none (a `PER_TRIP` driver, whose "present" day isn't tied to a shift). "Not marked" is the absence of a row — clearing a mark deletes it. Month totals (shifts, full days, absences, leave, holidays) are counted per request, never stored.

Holiday is a fourth status alongside Absent/Leave/Present: like Absent/Leave it means the driver didn't work that day (no shifts), but unlike them it's a **paid** day — some drivers serve a company that's closed on a given date, others don't, so holidays are marked per driver per day, not from one shared calendar.

`/api/driver-attendance` serves both clients: `GET ?date=` (one day, every active driver, plus each driver's previous day for "copy yesterday"), `GET ?month=` (the register with totals) and `PUT` (only the changed drivers for one date, in one request; returns the day as stored). The write goes through the `save_driver_attendance` database function (`sql/46`) so the stores and the clears land together or not at all; until that function exists in a database the route falls back to two separate, non-atomic writes. On the wire a mark is `{ shifts: ["A","B"], status: "ABSENT" | "LEAVE" | null }` — present is implied by shifts. Reading is open to every role (`requireUserAuth()`), but marking is admin/superadmin only (`requireStrictAdminAuth()` on `PUT`) because the marks decide wages — staff and drivers get the same screens with every control disabled, driven by the `editable` flag in the day response. Nobody can mark a future date. `GET /api/driver-attendance/export?month=` returns the month as a CSV for wages (totals first, then one column per day) and is admin-only too. "Today" is IST, computed by the server and returned as `today`, and the server alone decides what is editable. The one thing the clients add: a screen left open past midnight moves its own "today" *forward* to the device's IST date (never back), so "next day" isn't stuck disabled until a reload.

The page (`src/components/attendancePage/`) mounts a different layout below `md`: desktop spells out Full day · A B C · Absent · Leave per row, phones use a tick + three-cell shift block + "more" menu so a row stays one line. Both are sized for 30–40 drivers: client-side search by name/place, counts that double as filters, and a register that scrolls inside its own box with the day header and driver column pinned.

## Driver salaries

Salaries follow the money modules' three rules: nothing derived is stored, the ledger is append-only with reversals, and every method — GET included — is `requireStrictAdminAuth()` (attendance is readable by every role; what it works out to in rupees is not).

A month's pay is computed per request in `src/app/api/driver-salaries/driver-salaries.utils.ts` (`computePay`), from three inputs:

- `driver_salary_rates` — the monthly salary and the month it applies from (`effective_from`, always the 1st). The salary for a month is the latest rate on or before it, so a raise never rewrites earlier months. Saving again for the *same* starting month corrects that row in place (a typo fix); everything else is a new row.
- `driver_attendance` — days marked Absent or Leave.
- `driver_salary_entries` — `ADVANCE` and `DEDUCTION` rows against a `period_month`, append-only; a mistake is cancelled by a row with `reverses_entry_id`, and both drop out of the totals.

The rule for a `MONTHLY` driver: day's pay = monthly salary ÷ calendar days in that month; attendance cut = day's pay × (absent + leave days), rounded to the rupee and capped at the salary; net = salary − cut − advances − deductions (it may go negative). Leave is unpaid like absent; Holiday is paid like a worked day and never contributes to the cut. A day with any shift worked is a paid day regardless of how many shifts, and a day with **no mark at all is paid** — only an explicit Absent/Leave costs pay — but the sheet reports `unmarked_days` so gaps are visible. A month that hasn't finished is flagged `is_provisional`.

A `PER_TRIP` driver (see "Driver pay type" above) skips the attendance-based calculation entirely: `net = rate_per_trip × driver_trip_counts.trip_count` for that month, minus advances/deductions. Attendance may still be marked for a `PER_TRIP` driver (mainly Absent/Leave/Holiday for record-keeping), but it does not change their pay.

Routes: `GET /api/driver-salaries?month=` (the sheet + totals), `GET /api/driver-salaries/export?month=` (CSV), `GET /api/driver-salaries/[driverId]?month=` (one driver's line, rate history and entries), `POST …/[driverId]/rates`, `POST …/[driverId]/entries`, `POST …/[driverId]/entries/[entryId]/reverse`, `POST …/[driverId]/settle`, `DELETE …/[driverId]/settle/[settlementId]`. The page is `/admin/salaries` (`src/components/salariesPage/`), admin/superadmin only. A driver with salary rows can no longer be deleted, only deactivated.

### Settling a month

Only a **finished** month can be settled: drivers are paid for a month after it ends, so `POST …/settle` refuses the current month and any later one (400), and both clients disable "Mark paid" while `is_provisional` is true (see `docs/decisions/0007-settle-only-finished-months.md`). Settling records what was actually paid for a month (`driver_salary_settlements`, `sql/50`) — a fact separate from the computed `net_pay`, not another derived figure. `POST …/[driverId]/settle` takes `{ period_month, amount_paid, note? }`; if `amount_paid` differs from the computed `net_pay`, the gap becomes an ordinary `driver_salary_entries` row (`ADVANCE` if overpaid, `DEDUCTION` if underpaid) dated into *next* month and tagged `settlement_id`, so the existing pay rule picks it up automatically — no new money-derivation logic. `DELETE …/[driverId]/settle/[settlementId]` undoes it: reverses that carry-forward entry (if any), clears its `settlement_id`, then deletes the settlement row. Both writes go through single-transaction database functions (`settle_driver_salary` / `unsettle_driver_salary`, `sql/50`) — the same all-or-nothing pattern as `save_driver_attendance` (`sql/46`) — with a non-atomic three-write fallback while those functions don't exist in a database yet, same convention as attendance.

A settled month is locked: `POST …/entries`, `POST …/rates`, and reversing any entry dated into that month all 409. `POST …/rates` checks more than just the starting month being settled — since a rate applies from its starting month forward (`salaryForMonth` picks the latest rate on or before each month), it refuses the write if the driver has *any* settlement on or after the starting month, so a raise backdated before a settled month can't silently change what that month was paid against. A carry-forward entry can only be undone by unsettling the settlement that made it — the reverse route refuses it directly. Settling month M is refused with a 409 if M+1 is already settled (the carry-forward would silently change a month already closed out), and unsettling mirrors that check in reverse. Attendance marks are not gated by settlement — correcting one for a settled month still works, since attendance is a separate module — so a settled driver's live `net_pay` can still drift from `net_pay_computed`; the modal surfaces that drift rather than hiding it.
