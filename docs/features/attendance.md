# Attendance

_Checked against the code on 2026-10-31._

## 1. Purpose

Record, for every driver and every day, which shifts they drove (A, B, C) or whether they were absent, on leave or on a paid holiday. Wages are worked out from these marks (see [salaries.md](salaries.md)), so the page is built to mark 30–40 drivers quickly and to make gaps obvious.

## 2. Who can do what

Admin and superadmin behave the same here.

| | Admin / superadmin | Staff | Driver |
|---|---|---|---|
| Open the page and read any day or month | Yes | Yes | Yes |
| Mark, change or clear a mark | Yes | No | No |
| Bulk buttons (Mark full day / absent / copy yesterday) | Shown while someone is unmarked | Hidden | Hidden |
| Set "shifts per day" for a driver (gear icon) | Yes | Hidden | Hidden |
| "Export for wages" (CSV) | Yes | Hidden | Hidden |
| See the money (salaries) | Separate page, admin only | No | No |

- Staff and drivers get the same screens with every control disabled and the note "Only an admin can mark attendance."
- That note, and the controls being disabled, come from the server's `editable` flag. It is false for non-admins **and** for any date after today (IST).
- The server enforces it too: saving, exporting and the shift-count change answer 403 to anyone who isn't admin/superadmin.

## 3. The screen

Title "Attendance — Who drove which shift, day by day." Two views: **Daily marking** and **Monthly register** (on a phone: a Day / Month switch).

### Desktop (768px and wider)

**Daily marking, top to bottom**
1. A "roll call" card: "N of M drivers marked" (with "All done" once nobody is left), and one bar split into Present / Absent / Leave / Holiday / Not marked. The hatched "Not marked" part shrinks as you mark. Under it, a legend with each count, plus Shift A / B / C counts. Every segment and shift count is also a filter — click again to clear.
2. Tabs: Daily marking · Monthly register.
3. Date row: previous-day arrow, the date (reads "Today, 11 Oct" on today), next-day arrow (disabled on today), and a "Today" button when on another day. The date label is also the date picker. Beside it, "N unmarked:" with **Mark full day**, **Mark absent**, **Copy yesterday** (only while someone is unmarked).
4. Filter chips (All, Not marked, A, B, C, Off, Holiday) and a search box ("Search driver or place...").
5. One row per driver: initials, name, place, small badges, then the controls — a **Full day** button, the driver's own shift buttons (A B C), a gear for shifts per day (admin only), and **Absent / Leave / Holiday**. A coloured edge runs down the left of each row: green worked, red absent, amber leave/holiday, pale amber still to mark.
6. When there are unsaved changes, a bar sticks to the bottom: "N unsaved changes for Sun, 11 Oct" with **Discard** and **Save attendance**. After a save: "Attendance saved for …".

Row badges: **Full day**, **Double shift** (more than one shift but not a full day), **Not marked**, **Holiday**, **Inactive**, **Per trip**, and "2 shifts/day" or "1 shift/day" when the driver doesn't run all three.

**Monthly register:** month arrows plus a month picker, search, and **Export for wages** (admin only; disabled while empty). A table with drivers down the left and days across; the driver column and day header stay pinned while it scrolls. Each cell is three small bars (A, B, C filled for shifts worked), or **A** (absent), **L** (leave), **H** (holiday), **P** (present, for per-trip drivers). Future days are blank, Sundays are shaded, today is outlined. Right-hand totals: Days, Full, Shifts, Abs, Lv, Hol. An absence count of 3 or more turns red. Clicking a cell opens that day in Daily marking.

### Phone (below 768px)

- **Pinned header:** the date with previous/next arrows (two short lines, "11 Oct" over "Today" or the weekday), a search icon, and the Day / Month switch. Tapping the search icon replaces that row with a search field and "Cancel".
- Below it, a thin roll-call bar with "N of M marked", then a row of filter chips (All, **Left** instead of "Not marked", A/B/C, Off, Holiday only when someone is on holiday). The chip row scrolls sideways on very narrow screens.
- **Bulk strip** (amber, admin only, while someone is unmarked): "N left" with **Full day**, **Absent**, **As yesterday**.
- **Driver cards**, one line each: a round tick (tap = full day; a dash means part of the day), name with a status line ("Full day", "Shifts A + B", "Not marked", "2 shifts"…), then either the shift cells (A B C) or, if marked off, a pill such as "Absent ✕" that clears it when tapped, and a "more" (⋯) button. The more menu opens Absent / Leave / Holiday / Clear and, for admins, the gear for shifts per day.
- **Save:** a small floating pair in the bottom-right: an undo icon (asks "Discard unsaved changes?") and "Save N changes". A green "Saved" chip shows for about three seconds afterwards.
- **Monthly (phone):** one card per driver showing "N absent · N leave", the shift total, and the whole month as a strip of coloured cells (dark green full day, light green part day, red absent, amber leave, pale amber holiday). Tap a card to expand a calendar; tap a day to open it for marking. Export is the same button, at the top.

### Shifts per day (modal, admin only)

Opened from the gear. Title is the driver's name. Pick **1 (A)**, **2 (A · B)** or **3 (A · B · C)**, choose a **From month** (defaults to the month on screen), and press Save. A History list shows earlier changes ("From Oct 2026 — 2 (A · B)"), or "Nothing set yet — this driver runs all three shifts." If the new count leaves days marked with a shift the driver no longer runs, the modal stays open with an amber note listing up to 10 dates (and "and N more") and the line "Nothing was changed for you." — the button becomes **Done**.

## 4. Flows

**Mark a day (admin)**
1. Open Attendance (opens on today). Use the arrows, the date label or the picker to choose another day — any past day works, a future day does not.
2. Tap a driver's Full day / tick, or individual shifts, or Absent / Leave / Holiday. Tapping the same Absent/Leave/Holiday again clears it. Choosing a shift clears Absent/Leave/Holiday; choosing Absent/Leave/Holiday clears shifts.
3. For many drivers at once use the bulk buttons — they only fill drivers who are **still unmarked**, never overwrite a mark. "Copy yesterday" copies only for drivers who are unmarked today and were marked yesterday, and is disabled when there are none.
4. Press **Save**. Only the drivers whose marks changed are sent, in one request. The screen then shows what the server actually stored.
5. If the save fails (for example the connection drops), the error appears in the save bar and your marks stay, so you can retry.

**Leave a day with unsaved marks:** choosing another date (arrows, picker, or opening a day from the register) asks "Discard unsaved changes?" and only moves on if you confirm. Switching between Day and Month does not ask and keeps your unsaved marks.

**Clear a mark:** tap the active status again (desktop), or the pill / Clear in the more menu (phone), then Save. A cleared mark deletes the record — "not marked" means no record.

**Change how many shifts a driver runs:** gear → pick 1/2/3 → pick the starting month → Save. Earlier months keep their old count. If any day from that month is left on a shift they no longer run, read the warning, open each listed day and remove the extra shift.

**Export for wages:** Monthly register → choose the month → "Export for wages". Downloads `driver_attendance_YYYY-MM.csv`: one row per driver with Driver, Place, Shifts per day, Days present, Full days, Shifts, Absent, Leave, then one column per day ("ABC", "AC", "Absent", "Leave", "Holiday", "Present", or blank).

**Read-only user:** open the page, browse days and months; nothing can be changed.

## 5. Rules the user can notice

- **A full day is per driver.** A driver who runs two shifts is on a full day with A + B. Only the driver's own shifts are offered, so a two-shift driver has no C button. Pay is never divided by shift count; only Absent and Leave cut pay (see [salaries.md](salaries.md)). A chip for a shift nobody runs (for example C when everyone is on two) is left out.
- **A change of shifts applies from a month onward.** Earlier months show the count they were marked against.
- **If a count was cut part-way through a month,** an older mark may still contain the dropped shift. That shift still shows as a button on that day so it can be seen and removed; it isn't hidden.
- **Per-trip drivers have no shift buttons.** They show a "Per trip" badge and only Present / Absent / Leave / Holiday. The bulk "Full day" marks them Present. Their pay type is set on the Salaries page.
- **Holiday is a paid non-working day.** It is not counted under the "Off" filter, which means Absent or Leave only. The Holiday chip appears only when someone is on holiday that day.
- **An unmarked day is not a mark.** It is simply no record; salaries treat it as paid but report it as "unmarked".
- **Inactive drivers** appear only on days they were marked, so an old day reads the same after someone leaves. Active drivers are listed first, then by name.
- **"Today" is India time.** The server says what today is; a page left open past midnight moves its own "today" forward (never back), so "next day" unlocks without a reload. The server still decides what can be edited.
- **No future dates**, and the month register won't go past the current month.
- **Fast clicking is safe:** if you tap next-day repeatedly, only the newest request is allowed to fill the screen. Controls are disabled while a save is running.
- **Saved marks must make sense:** the server refuses a duplicate shift, a shift the driver doesn't run, a shift together with Absent/Leave/Holiday, a driver listed twice in one save, a deleted driver, a future date, or more than 500 entries in one save.

## 6. Where it lives

| What | Where |
|---|---|
| Page | `/admin/attendance` (open to all roles in `src/lib/routePermissions.ts`; marking is enforced by the API) |
| Components | `src/components/attendancePage/` — `attendancePage.tsx` (state, save, both layouts), `attendanceDayList.tsx` (desktop and phone rows), `attendanceRollCall.tsx`, `attendanceMonthView.tsx`, `shiftCountModal.tsx`, `attendancePage.utils.ts` (marks, filters), `attendancePage.types.ts` |
| API | `GET /api/driver-attendance?date=` or `?month=` (any role), `PUT /api/driver-attendance` (admin), `GET /api/driver-attendance/export?month=` (admin), `GET` and `POST /api/driver-attendance/shift-counts/[driverId]` (read: any role; write: admin) |
| API logic | `src/app/api/driver-attendance/driver-attendance.utils.ts` (validation, totals, which shift count applies), `driver-attendance.data.ts` (loading a day or month, `editable`) |
| SQL | `sql/46_save_driver_attendance.sql` (all-or-nothing save), `sql/48_add_driver_shift_counts.sql` (shifts per driver), `sql/51_add_holiday_status_and_pay_type.sql` (Holiday status and per-trip pay type) |
| Rule file | `.claude/rules/attendance-and-salaries.md` |
| Tests | `test/app/api/driver-attendance/` (`route.test.ts`, `driver-attendance.utils.test.ts`, `shift-counts/route.test.ts`), `test/components/attendancePage/attendancePage.utils.test.ts`. There is no attendance spec in `e2e/features/`. |
| Flutter | `../mobile_sslogistics/lib/features/attendance/` (`screens/attendance_screen.dart`, `widgets/`, `data/attendance_models.dart`) — change the response shape and that model in the same pass |

## 7. Why it works this way

- Duplicate shifts are rejected rather than quietly merged: [0002-reject-duplicate-shifts.md](../decisions/0002-reject-duplicate-shifts.md).
- Cutting a driver's shift count warns and lists the affected days instead of rewriting past marks: [0003-shift-count-change-warns-not-rewrites.md](../decisions/0003-shift-count-change-warns-not-rewrites.md).
- Everything else (wage rule, IST, admin-only marking, the one-request save) is explained in `.claude/rules/attendance-and-salaries.md`.

## 8. Not built / open questions

- **No way to mark a future date**, by design.
- **No limit on how far back** an admin can edit a day; a paid month can still be changed (attendance is not locked by settling a salary month, so a settled driver's live pay can drift from what was paid; the Salaries screen shows that drift).
- **Holiday is not in the CSV totals.** The export has Absent and Leave columns but no Holiday total; holiday days still appear in the per-day columns.
- **Desktop and phone do not warn when switching Day ↔ Month** with unsaved marks (they are kept); only date changes ask.
- **Not checked on the Flutter app:** its shift-count warning and Holiday/per-trip behaviour were not compared with this web page.
