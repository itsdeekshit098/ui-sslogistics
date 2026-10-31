# Salaries

## 1. Purpose

Shows what each driver is owed for a month and records what was actually paid. The server works out every figure from the driver's salary (or per-trip rate), the attendance marks, and any advances or deductions; the page only displays them and reloads after each change. Page: `/admin/salaries`.

## 2. Who can do what

| | Admin / superadmin | Staff | Driver |
|---|---|---|---|
| See "Salaries" in the sidebar / drawer | Yes | No | No |
| Open `/admin/salaries` | Yes | Redirected (page is locked in `routePermissions.ts`) | Redirected |
| Read the sheet, a driver's detail, the CSV | Yes | 403 on every method | 403 |
| Set salary / rate / pay type, enter trips | Yes | 403 | 403 |
| Add or reverse advances and deductions | Yes | 403 | 403 |
| Mark paid / undo settlement | Yes | 403 | 403 |

Money here is admin-only on every method, GET included. The Flutter app hides its Salaries tile from everyone but admin and superadmin. Staff and drivers learn a driver's pay *type* (to hide shift buttons) from `/api/driver-attendance`, which sends the type alone, never the rate.

## 3. The screen

**Desktop (`md` and up)**
- Header "Salaries".
- Four summary cards: **Monthly Salaries**, **Attendance Cuts**, **Advances & Deductions** (with "advances · other" underneath) and **Net Payable** (labelled "So far this month" while the month is running).
- A panel with: previous / next month buttons, the month name, a month picker, a search box ("Search driver or place...") and **Export** (CSV).
- Banners: an amber one while the month isn't over ("…Absences and advances recorded later this month will change these figures"); a grey one "N drivers have no salary set and are left out of the totals".
- The table, one row per driver: Driver (name, place, "Inactive"), **Salary / Rate** (a rupee amount, `₹x/trip`, or a blue "Set salary" / "Set rate" prompt), **Unpaid Days / Trips** (e.g. "2 of 30" with "1 absent · 1 leave", an amber "N not marked" badge, or "12 trips", or "Enter trips"), Attendance Cut, Advances, Deductions, **Net Pay** (red if negative, green "Paid" badge once settled).
- Click a row to open that driver. A row action **Add advance** opens a quick form; it is disabled once the month is settled ("This month is settled — undo it first to add an advance").
- Below `lg` (tablet widths) the table becomes the same slim list as on a phone, because seven columns don't fit beside the sidebar.

**Phone (390px)**
- One top row: previous / next month arrows, the month (tap it for the native month picker), a search icon and a download icon. Search replaces the row until Cancel.
- One summary card: big **Net payable** (and "so far this month"), then three small figures — Salaries, Absence cuts, Advances & other. Hidden while a search is active.
- A slim list: name, place / "Inactive" / "N not marked" / "No trips entered", a second line only when something was taken off ("2 unpaid days − ₹2,000", "Advance ₹5,000"; per-trip shows "22 trips × ₹800"). On the right a hand-coin button for Add advance, then net pay ("of ₹30,000" when it differs from the salary, or a green "Paid"), or a blue "Set salary" / "Set rate" / "Enter trips".

**Driver window (opens from a row, same on every width)**
Top to bottom:
1. Name and month.
2. The big figure: **Net pay** with an amber "Unsettled" badge, or **Paid** with a green "✓ Paid" badge and "Settled on <date>". Warnings underneath: "Month isn't over — absences or advances can still change this", and "Attendance has changed since this was settled — now computes to ₹x".
3. **Mark paid** button (greyed with a hint while the month isn't over, or until there is a figure to pay), or, once settled, the carry-forward note and **Undo settlement**.
4. **How this was calculated** (open until settled, then collapsed): for monthly drivers salary, attendance cut ("2 unpaid days of 30 (1 absent, 1 leave)"), advances, other deductions, and a "Carried from last month" / "Owed from last month" line; days present and "N not marked (paid, not cut)". For per-trip drivers: rate per trip and trips this month.
5. **Pay setup**: a badge (Monthly salary / Per trip) and **Change**. The form has a "Paid" choice (Monthly salary | Per trip), the salary or rate, and **From month**. Underneath, the history ("From Oct 2026 — ₹30,000").
6. **Trips · <month>** (per-trip drivers only): **Enter trips** / **Change**, one whole number, **Save trips**.
7. **Advances & deductions · <month>**: **Add advance** / **Add deduction**, then the list of entries. Reversed entries stay, struck through, with a "Reversed" or "Reversal" badge; carry-forward entries show a "Carried in" badge and have no Reverse button.

While any save is in flight every control in the window is disabled and the window can't be closed.

## 4. Flows

**Set a driver's first salary.** Row shows "Set salary" → open the driver → Pay setup is already in edit mode → type the salary, check **From month** (defaults to the month being viewed) → **Save**. The sheet reloads. Errors: "Enter the monthly salary", "Choose the month it starts from".

**Give a raise.** Open the driver → **Change** → new salary and the month it starts from → Save. Earlier months keep their old figure; the history list shows both.

**Switch to per-trip.** **Change** → choose "Per trip" → rate (must be above zero) and From month → Save. The page sends the pay type first, then (for monthly) the salary. Earlier months keep how they were paid. Then use **Enter trips** each month.

**Enter trips.** Per-trip driver → **Enter trips** → whole number 0 or more → **Save trips**. Until entered, net pay is blank and the row shows "Enter trips". Re-saving the same month corrects it in place.

**Add an advance or deduction.** Either the **Add advance** row action (advances only, against the sheet month, date defaults to today) or inside the driver window (**Add advance** / **Add deduction**, amount, date up to today, optional note → **Record advance** / **Record deduction**). Errors: "Enter an amount greater than zero"; the server also refuses more than ₹1,00,00,000, more than two decimals, a future date or future salary month, and a settled month.

**Reverse an entry.** **Reverse** next to the entry → **Reverse** to confirm (or **Keep**). Both rows stay on the record and drop out of the totals. Not allowed for a carry-forward entry or a settled month.

**Mark a month paid.** Driver window → **Mark paid** → "Settle <month>'s pay": amount defaults to net pay → edit if you paid something different (a hint appears: "You're paying ₹x more than owed — that will carry forward to <next month> as an advance…" or "…less than owed… as a deduction…") → optional note → **Confirm paid**. The row shows "Paid", Add advance goes grey. Errors: "Enter the amount actually paid"; "Set a salary before settling this month" (per-trip: "Set the rate per trip and this month's trip count before settling"); "This month is already settled…"; "<next month> is already settled — undo that settlement first…".

**Undo a settlement.** **Undo settlement** → **Undo** (confirm text: "Undo this settlement and any carry-forward it created?"). The carry-forward entry is reversed, the month unlocks. Refused if the month the carry-forward landed in has itself been settled.

**Export.** **Export** (or the download icon on a phone) downloads `driver_salaries_<month>.csv`: one row per driver (pay type, salary, rate, trips, days present/absent/leave/holiday/not marked, unpaid days, cut, advances, deductions, net pay) and a TOTAL row.

**Change month.** Arrows or picker. Future months are blocked (picker `max` is the current month; the API answers 400). Fast clicks are safe — only the newest request is shown.

## 5. Rules the user can notice

**Monthly pay:** day's pay = salary ÷ calendar days in that month; attendance cut = day's pay × (absent + leave days), rounded to the rupee and never more than the salary; net = salary − cut − advances − deductions.

> Worked example. Salary ₹30,000, a 30-day month → day's pay ₹1,000. One absent day and one leave day → cut ₹2,000. ₹5,000 advance. Net = 30,000 − 2,000 − 5,000 = **₹23,000**. If ₹20,000 is then handed over and the month is marked paid, the ₹3,000 shortfall becomes a ₹3,000 **deduction** in next month's sheet ("Owed from last month"). Had ₹26,000 been paid, ₹3,000 would carry as an **advance**.

**Per-trip pay:** net = rate × trips − advances − deductions. Attendance is still shown but never cuts a per-trip driver's pay. Example: ₹800 × 22 trips − ₹3,000 advance = **₹14,600**.

- Leave is unpaid, like Absent. **Holiday is a paid day.** A day with any shift worked is paid however many shifts.
- **An unmarked day is paid.** Only an explicit Absent or Leave costs pay; the sheet flags "N not marked" so gaps are visible.
- Net pay can go **negative** (red) — advances outran what was earned.
- A month that isn't over is **provisional**: the figures move as attendance and advances arrive, and it **cannot be marked paid** until it ends ("You can settle this month once it is over."). Drivers are paid for a month after it ends ([0007](../decisions/0007-settle-only-finished-months.md)).
- **Rates, pay types and trip counts apply from a month onward**; earlier months keep what they had. Saving again for the same starting month corrects that row. Salary is only for monthly drivers and trips only for per-trip drivers (the server says "This driver is paid per trip, not monthly — set their pay type to monthly first").
- **A settled month is locked:** no new entries, no reversals, no salary or pay-type change backdated to on-or-before a settled month ("A later month is already settled — undo that settlement first…"), no trip-count change. Undo the settlement first.
- Settling is refused if the **next** month is already settled, and so is undoing in the same situation.
- **Attendance is not locked by settlement.** If a mark is corrected later, the window shows "Attendance has changed since this was settled — now computes to ₹x" while the Paid figure stays as recorded.
- Drivers with no salary yet appear as "Set salary" and are **left out of the totals** (the banner counts them). Inactive drivers appear only if they have attendance or entries that month.
- Money limits: positive, at most ₹1,00,00,000, at most 2 decimals; trips at most 10,000.

## 6. Where it lives

- **Page:** `/admin/salaries` — `src/app/admin/salaries/`; components in `src/components/salariesPage/` (`salariesPage.tsx`, `salaryDriverModal.tsx`, `addAdvanceModal.tsx`, `salaryMobileList.tsx`, `salariesPage.types.ts`).
- **API** (`src/app/api/driver-salaries/`, all strict-admin except one GET):
  - `GET /api/driver-salaries?month=` — the sheet and totals
  - `GET /export?month=` — CSV
  - `GET /[driverId]?month=` — one driver's line, rate and pay-type history, entries, settlement
  - `POST /[driverId]/rates` — salary from a month
  - `GET`, `POST /[driverId]/pay-type` — pay type and per-trip rate
  - `GET`, `POST /[driverId]/trip-count` — trips for a month
  - `POST /[driverId]/entries` — advance or deduction
  - `POST /[driverId]/entries/[entryId]/reverse`
  - `POST /[driverId]/settle`, `DELETE /[driverId]/settle/[settlementId]`
  - The pay rule is in `driver-salaries.utils.ts` (`computeMonthlyPay`, `computePerTripPay`); loading and the settled-month checks are in `driver-salaries.data.ts`.
- **SQL:** `sql/47_add_driver_salaries.sql` (rates, entries), `sql/48_add_driver_shift_counts.sql` (shifts per driver), `sql/50_driver_salary_settlement.sql` (settlements + the `settle_driver_salary` / `unsettle_driver_salary` functions), `sql/51_add_holiday_status_and_pay_type.sql` (Holiday status, pay types, trip counts). `sql/46_save_driver_attendance.sql` belongs to attendance.
- **Rules:** `.claude/rules/attendance-and-salaries.md`.
- **Tests:** `test/app/api/driver-salaries/` (utils, sheet, driver, rates, entries, reverse, settle, unsettle, trip-count, export); `test/components/salariesPage/salaryDriverModal.test.tsx`; mocked e2e `e2e/features/salaries/salaries-mocked.spec.ts`.
- **Flutter:** `../mobile_sslogistics/lib/features/salaries/` (`data/salary_models.dart` must change with any response-shape change).

## 7. Why it works this way

- [0004 — A settled month is locked](../decisions/0004-settled-month-is-locked.md)
- Pay rule, append-only entries and carry-forward: `.claude/rules/attendance-and-salaries.md` and the money-module rules in `.claude/rules/database-and-money.md`.

## 8. Not built / open questions

- A settled month cannot be edited, only undone and redone; there is no "adjust amount paid".
- No per-driver payslip, no payment method or bank reference on a settlement, no history view across months beyond switching the month.
- The "Reports" page is disabled in the sidebar; there is no yearly salary report.
