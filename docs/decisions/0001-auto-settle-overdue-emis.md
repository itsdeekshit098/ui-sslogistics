# 0001 — Overdue EMIs are auto-settled by a nightly script

- **Status:** Accepted
- **Date:** 2026-08-16 (script added in commit `b87593f`)
- **Area:** loans — `scripts/check-loan-emis.js`, `loan_payments`, `loan_balances`

## Situation

Most EMIs are collected by bank mandate, so the money moves without anyone touching the app. Asking an admin to click "Mark paid" on every instalment of every loan, every month, meant the ledger was always behind reality.

## Options considered

1. **Manual only.** The ledger is exact, but someone must log every EMI. In practice they would not, and every loan would read as overdue.
2. **Auto-settle and let a real miss be caught outside the app.** Zero clicks. The lender chases a bounced EMI, the admin reverses the assumed payment.
3. **Reconcile against bank statements.** Most accurate, but needs a bank feed we do not have.

## Decision

Option 2. Each night `check-loan-emis.js` inserts a real `loan_payments` row (`payment_method: 'AUTO'`, `paid_on` = the due date) for every EMI that is past due with nothing logged. `BOUNCED` instalments are excluded: that status already means a mandate is *known* to have failed, so paying over it would hide a confirmed problem.

## Consequences

- Outstanding and instalment status read "paid" for money that was only assumed. This is the deliberate trade: ledger accuracy for zero manual work.
- Every auto row is tagged `AUTO`, written to the activity log with `details.auto: true`, and shown in the loan's payment history, so a real miss can be found and reversed through the normal reversal endpoint.
- Admins get a `loan_emi_auto_settled` notification per instalment, so nothing happens silently.
- There is no automated un-settling.
- If a loan looks too healthy, check its history for `AUTO` rows first.

## Where it shows up

[.claude/rules/platform-ops.md](../../.claude/rules/platform-ops.md) · [loans feature page](../features/loans.md) · open question in [0006](0006-open-loan-product-questions.md)
