# 0004 — A settled salary month is locked

- **Status:** Accepted
- **Date:** 2026
- **Area:** salaries — `settle`, `rates` and `entries` routes, `driver_salary_settlements` (sql/50)

## Situation

Settling a month records what was actually paid. If salary entries or rates for that month could still change afterwards, the figure paid and the figure computed would drift apart, and nobody could say what the driver was owed.

## Options considered

1. **Let a settled month be edited**, recalculating the difference. Flexible, but rewrites a closed record.
2. **Lock it.** Corrections go forward: any gap between computed pay and amount paid becomes an ordinary advance or deduction dated into the next month.

## Decision

Lock it, and carry the difference forward.

- Entries, rates, and reversals dated into a settled month all return 409.
- A rate is refused if the driver has *any* settlement on or after its starting month, because a rate applies forward and would change what that month was paid against.
- A carry-forward entry can only be undone by unsettling the settlement that created it.
- Settling month M is refused if M+1 is already settled, and unsettling mirrors that check.
- To change a settled month, unsettle it first.

## Consequences

- The paid amount is a fact; the computed `net_pay` stays derived. No new money-derivation logic: the carry-forward is an ordinary entry the existing pay rule already understands.
- **Known gap, on purpose:** attendance is not gated by settlement, since it is a separate module. Correcting a settled month's attendance still works, so a settled driver's live `net_pay` can drift from `net_pay_computed`. The driver modal shows that drift instead of hiding it.
- Settle and unsettle each run as one database transaction (sql/50), with a non-atomic fallback until that function exists.

## Where it shows up

[salaries feature page](../features/salaries.md) · [.claude/rules/attendance-and-salaries.md](../../.claude/rules/attendance-and-salaries.md) · `test/app/api/driver-salaries/settle-route.test.ts`
