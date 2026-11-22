# 0003 — Lowering a driver's shift count warns about old marks, never rewrites them

- **Status:** Accepted
- **Date:** 2026-10
- **Area:** attendance — `shift-counts/[driverId]/route.ts`, `shiftCountModal.tsx`, `driver_shift_counts` (sql/48)

## Situation

A driver's shifts per day (1, 2 or 3) applies from a month onward. If a driver who was marked on shifts A, B and C in earlier days is changed to 1 shift from that month, the days already marked B or C no longer match the rule. The question raised was: can those days be marked back to one shift, and should the save warn?

## Options considered

1. **Rewrite the old marks** to fit the new count. Tidy, but attendance is what wages are worked out from, so an automatic edit silently changes pay.
2. **Block the change** while conflicting marks exist. Safe, but the admin cannot cut a driver's shifts without first editing every day.
3. **Save, then report the conflicts and leave the days alone** for an admin to review.

## Decision

Option 3. The save goes through, and the response lists how many marks conflict (an exact count) and the first 10 dates. The modal stays open with an amber warning instead of closing. An admin fixes the days on the attendance page; they can mark them back to one shift because the page offers only the shifts the driver runs.

## Consequences

- Wages never change without an admin choosing it.
- The conflict check is advisory: if it fails, the save still stands and the failure is logged, so an empty result is not read as "nothing to review".
- Old months keep the count they were marked against (a change applies from its month onward), so history stays consistent.
- Until the admin reviews, a driver can have marks on shifts they no longer run; the day list shows them (`shiftsToShow`) so they are not invisible.

## Where it shows up

[attendance feature page](../features/attendance.md) · [.claude/rules/attendance-and-salaries.md](../../.claude/rules/attendance-and-salaries.md) · `test/components/attendancePage/attendancePage.utils.test.ts`
