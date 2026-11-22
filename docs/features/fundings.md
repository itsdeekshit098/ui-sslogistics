# Fundings (private borrowing and lending)

## Purpose

Money handled outside a bank: **borrowed** from a private funder (the "Private Fundings" tab on the Loans page) or **lent out** to someone (the "Lent Out" tab). Interest is simple and never compounds: ₹1,00,000 at 2% a month accrues ₹2,000 a month whether or not last month's interest was paid, and part months are charged by the day (a month is 30 days). Nothing about interest is stored; every figure is worked out from the funding's entries and rate history each time.

## Who can do what

| Role | Can do |
|---|---|
| Admin / superadmin | Everything below. |
| Staff, driver | Nothing: the tab and the detail page are hidden, and every `/api/fundings` method answers 403, reads included. |
| Signed out | 401 `SESSION_INVALID`. |

## The screen

**List** (Loans page, "Private Fundings" and "Lent Out" tabs): one row or card per funding with the funder (or borrower), principal outstanding, current rate, monthly interest and interest due, sortable. The button at the top is "Add Funding" or "Lend Money" depending on the tab.

**Detail** (`/admin/fundings/<id>`): the name, an Open/Settled badge and "2.5% per month · since 1 Sept 2026"; four buttons (Pay Interest, Repay Principal, Borrow More, Change Rate); tiles for principal outstanding, interest accrued, interest due and total owed; then three tabs: **Interest** (one card per month: days, average principal, rate, interest, balance), **Entries** (the ledger; a reversed entry is struck through and its reversal shows a "Reversal of #n" badge) and **Rate History**. Hover a row in Entries to get **Reverse** (a touch screen always shows it).

**Phone (390px):** summary tiles scroll sideways like the Flutter app; forms open as bottom sheets; Entries is a vertical timeline. Long unbroken text (a reference number) wraps instead of running off the screen.

## Flows

1. **Add a funding** — funder (or borrower), optional "In whose name", amount, date (defaults to today in India), interest as a percentage (per month or per year) or a fixed monthly amount, optional day of month interest is due, notes. A live line shows what a full month costs. Saving creates the funding, its opening rate and its opening principal together; if either of the last two fails the funding is rolled back.
2. **Pay Interest / Repay Principal / Borrow More** — amount (prefilled with the suggested figure), date (backdating is fine; the accrual is recalculated from scratch), optional payment method, reference (up to 100 characters) and description (up to 300). Repaying or adjusting more than the principal still outstanding is refused with the amount shown.
3. **Reverse an entry** — confirm; a new row cancels the original and interest is recalculated as if it had never been entered. An entry can be reversed once; a reversal cannot be reversed; an entry of another funding is refused.
4. **Change Rate** — a new rate from a date (the funding's own mode decides percentage or fixed). Interest already accrued stays at the old rate. Two rates cannot start on the same day (409). Limits: 20% a month, 100% a year; two decimals.

## Rules the user can notice

- Entries are append-only; there is no edit and no delete of an entry, only a reversal ([database-and-money](../../.claude/rules/database-and-money.md)).
- A funding with entries cannot be deleted ("mark it SETTLED instead"). Every new funding starts with an entry, so in practice none can be deleted.
- The web has no button to **settle or reopen** a funding; that is only possible through `PUT /api/fundings` with `status`.
- The loans summary's "funding principal outstanding" counts only **open, borrowed** fundings; lent money is never mixed into what the company owes.
- Money has at most two decimals; free-text fields must be text (not objects) and are refused, not cut, when too long.

## Where it lives

- Screens: `src/components/fundingModal/`, `src/components/fundingDetailPage/`, the tabs in `src/components/loansPage/`; page `src/app/admin/fundings/[id]/`.
- API: `src/app/api/fundings/` (`route.ts`, `[id]/route.ts`, `[id]/entries/`, `[id]/rates/`, `[id]/entries/[entryId]/reverse/`); the interest engine is `fundings.utils.ts`.
- SQL: `sql/32_add_fundings.sql`, `sql/35_add_funding_direction.sql`. Rule: `.claude/rules/database-and-money.md`.
- Tests: `test/app/api/fundings/`, `test/components/fundingModal/`, `e2e/features/fundings/`.
- Flutter: `mobile_sslogistics/lib/features/fundings/` (same routes; it parses the response shapes unchanged).

## Why it works this way

Decision [0010](../decisions/0010-open-funding-product-questions.md) lists the open product questions. The append-only ledger and the "never store derived money" rule are in the money rule file.

## Not built / open questions

See [0010](../decisions/0010-open-funding-product-questions.md): future-dated entries, entries on a settled funding, and no settle/reopen/delete on the web.
