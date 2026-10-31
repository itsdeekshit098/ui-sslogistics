# 0005 — Closed and foreclosed loans never count as overdue; part-paid late EMIs are deliberately not handled

- **Status:** Accepted
- **Date:** 2026-10-31
- **Area:** loans — `GET /api/loans` overdue filter, `loan_balances`, the loans list, the EMI calendar

## Situation

Live testing found two ways the overdue figure disagreed with reality:

1. A loan marked CLOSED or FORECLOSED keeps its leftover schedule rows, and the view still reads them as overdue. The "Overdue only" filter and the dashboard would list a loan that owes nothing.
2. A *part-paid* instalment past its due date disappears from overdue: paying ₹400 of a ₹1,000 EMI that was weeks late removes the whole ₹1,000, though ₹600 is still late. The cause is in the `loan_installment_state` view, which gives an instalment `PARTIAL` before it checks the due date, so `loan_balances` never counts it.

## Options considered

For the closed-loan case:

1. **Change the schedule rows** when a loan closes. Rewrites ledger-adjacent data; rejected, history should stay.
2. **Exclude by loan status** where overdue is read. Nothing is rewritten.

For the part-paid case:

1. **Fix the view** so a past-due `PARTIAL` instalment counts as overdue with its remaining amount. A `create or replace view` file was written (`sql/53`) but never applied to any database.
2. **Leave it.** EMIs are collected in full by the bank's auto-debit mandate, and the nightly script inserts a full-EMI payment ([0001](0001-auto-settle-overdue-emis.md)). A part payment only exists if an admin types a smaller amount by hand, which the product owner says does not happen.

## Decision

- Closed loans: option 2. The overdue filter drops loans whose status is CLOSED or FORECLOSED.
- Part-paid: **leave it, and delete `sql/53`.** A database change that has to be applied by hand is not worth carrying for a case that does not occur.

## Consequences

- Overdue totals on the list, dashboard and "Needs attention" agree for every loan that is paid the way the business pays them.
- **Known gap, on purpose:** if an admin ever records a part payment against a late EMI, that whole EMI drops out of the Overdue tile and filter, while the EMI Calendar (which does list part-paid instalments, with the amount still to pay) keeps showing it. If part payments become real, this is the place to start: restore the view change (the `PARTIAL and due_date < current_date` condition in `loan_balances`'s overdue count and amount) as a new numbered SQL file.
- A DEFAULTED loan still counts as overdue; that is a separate open question ([0006](0006-open-loan-product-questions.md)).

## Where it shows up

[loans feature page](../features/loans.md) · `GET /api/loans` overdue filter in `src/app/api/loans/route.ts` · `test/app/api/loans/route.test.ts` (closed loans excluded from overdue) · `src/app/api/loans/calendar/route.ts`
