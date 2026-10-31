# Known issues

Bugs and gaps that are **confirmed but not yet fixed**, so they are not rediscovered or forgotten between chats. One row per issue. When one is fixed, delete its row in the same commit as the fix (the commit and `CHANGELOG.md` keep the history). Product questions that need a decision live in [decisions/](decisions/README.md) with status `Open`, not here.

| Area | Issue | Where | How it was found | Severity |
|---|---|---|---|---|
| All API | 38 route files call `req.json()` directly, so malformed JSON answers 500 instead of 400. Fix: `readJsonObject()`. | `grep -rl "req.json()" src/app/api` — includes the tested `driver-attendance/route.ts` (PUT) and `shift-counts/[driverId]` (POST) | Code scan | Low — bad requests only |
| Attendance | The CSV export has no Holiday total, though the register shows one. | `src/app/api/driver-attendance/export/route.ts` | Code, while writing `features/attendance.md` | Low |
| Attendance | Switching Day ↔ Month with unsaved marks doesn't ask first (changing the date does). | `src/components/attendancePage/attendancePage.tsx` | Code, while writing `features/attendance.md` | Low — marks can be lost |
