# 0002 — Attendance rejects a repeated shift instead of fixing it

- **Status:** Accepted
- **Date:** 2026-10
- **Area:** attendance — `driver-attendance.utils.ts` (`parseMark`), `PUT /api/driver-attendance`

## Situation

Found in live testing: a hand-made request with `shifts: ["A","A"]` was accepted. The database stores three booleans, so a repeat collapsed to one shift. The caller was told "saved" for something other than what it sent, and the two clients could disagree about what was stored.

## Options considered

1. **Silently de-duplicate** (`["A","A"]` becomes `["A"]`). Friendly, but hides a client bug and reports success for different data.
2. **Reject with a 400.** The caller learns its request was malformed.

## Decision

Reject. `parseMark` returns an error when the list contains the same shift twice, the same way it already rejects an unknown shift or a shift the driver does not run.

## Consequences

- Neither the web page nor the Flutter app can produce a repeat, so real users never see this error. It only affects malformed or hand-made requests.
- A client bug that sends repeats now fails loudly instead of being masked.
- Same principle as the shift-count check: attendance decides wages, so bad input is refused, not repaired.

## Where it shows up

[attendance feature page](../features/attendance.md) · [.claude/rules/attendance-and-salaries.md](../../.claude/rules/attendance-and-salaries.md) · unit test in `test/app/api/driver-attendance/`
