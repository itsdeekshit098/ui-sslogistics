# Loans

## Purpose

Track the bank and finance-company loans the business owes: who borrowed, from which lender, on what vehicle or collateral, how much is still outstanding, and which EMIs are due or late. The same page also holds private borrowings, money lent out, and an EMI calendar (those three have their own notes under "The screen").

## Who can do what

| | Admin / superadmin | Staff | Driver |
|---|---|---|---|
| Open `/admin/loans` and a loan | Yes | No — the page is blocked and the API answers 403 | No — same |
| Create, edit, delete a loan | Yes | No | No |
| Record a payment, bounce an EMI, reverse a payment | Yes | No | No |
| Open the documents of a loan | Yes | No | No |

Loans are locked to admins on every method, **reading included** (`requireStrictAdminAuth`), because they hold EMIs and personal borrowings. Neither the page nor the Flutter app shows the entry point to staff or drivers.

## The screen

### List — `/admin/loans`, tab "Loans"

Top to bottom on desktop:

1. **Header** "Loans" with a primary button. The button follows the tab: "New Loan" on Loans, "Add Funding" on Private Fundings, "Lend Money" on Lent Out; none on the calendar.
2. **Five summary tiles** across all *active* loans (the filters below do not change them): Total Outstanding, Monthly EMI Outgo, Due This Month, Overdue (count, with the amount underneath), Active Loans. Clicking the Overdue tile when it is not "None" switches to the loans list with "Overdue only" on.
3. **Tabs:** Loans, Private Fundings, Lent Out, EMI Calendar. The last three load the first time they are opened.
4. **Search box** — "Search by loan number or collateral…", applied half a second after typing stops.
5. **Dropdowns:** loan type, borrower ("In whose name"), lender — all clearable.
6. **Status chips** All / Active / Closed, an **"Overdue only"** toggle, and a **Sort by** dropdown: "Ending soonest" (default) or "Newest first".
7. **The table**, one row per loan: Type (with loan number underneath), In Whose Name (Firm or Person), Lender / Collateral (vehicle number or collateral text), EMI, Paid (`3 / 36 - 33 rem` with a progress bar), Outstanding, Next EMI (date and "in 3 days"; red with "N overdue" when something is late), Last EMI (date and "in 5 months" for active loans), Status badge.
8. **Pagination** — 10 rows by default, page size selectable.

Clicking a row opens the loan. Row actions (Documents for everyone who can see the page; Edit and Delete for admins) appear on hover or keyboard focus. Delete asks for confirmation.

Empty states: "No loans yet" with a "New Loan" button when nothing exists; "No loans match" with a "Clear filters" button when filters or search hide everything.

**Phone (390px):** the three dropdowns move into a bottom sheet behind a filter button that shows how many are set; each loan becomes a card (lender name and status, borrower, type · number · vehicle, Outstanding on the left, "Next EMI" or a red "Overdue" on the right, a thin progress bar and "3/36 - 33 rem · Last EMI …"). A fully paid loan says "Fully paid" where the next date would be.

### Detail — `/admin/loans/[id]`

- **Header:** lender name (or loan type), a status badge, and one line of facts: type · "in the name of …" · vehicle or collateral · loan number · "Disbursed X of Y principal" (only when they differ) · "Debits from <account> (mandate type)". A back link returns to the list.
- **Header buttons — Prepayment, Charge, Foreclose** — appear only for admins and only while the loan is Active.
- **Hero card:** Outstanding (large), with an "Overridden" badge and an explanation when the lender's figure was typed in; Principal, Total Payable, Flat ROI (an estimate from the schedule, "—" when it can't be worked out); "N of M installments paid", the next due date, a progress bar.
- **Three tiles:** Total Paid, EMI (with "Due day 5 of each month"), Overdue (count and amount).
- **Tab "Schedule":** one row per installment — #, Due Date (with "in 3 days" / "2 days ago" while unsettled), Amount, Paid, Status (Paid, Partly paid, Overdue, Pending, Waived, Bounced), and an Action column with **Mark Paid** (not on paid or waived rows), **Bounced**, or **Clear** (when an installment is flagged).
- **Tab "Payments":** newest first with date, type (EMI, Prepayment, Foreclosure, Charge / Penalty, Adjustment; a "Reversal" badge on correcting rows), notes, amount, reference or method, and a **Reverse** button. A reversed payment and its reversal both stay listed; the reversed one is struck through.

The Mark Paid, Bounced, Clear and Reverse buttons are invisible until you hover or tab to a row on desktop, so a 60-row schedule isn't a wall of buttons. On a touch device (no hover) they are always visible. On phones the schedule and payments become cards, with payments as a timeline.

### EMI Calendar tab

A month picker (arrows and a month input) with the month's total due. Dates are grouped into cards listing each installment with lender, borrower, vehicle, "EMI 7", status badge and amount still to pay. Overdue days come first whatever their date, then the rest in date order; today is badged "Today". Closed loans never appear.

### Private Fundings and Lent Out tabs

Lists of money borrowed from private funders and money lent to individuals, sortable, opening `/admin/fundings/[id]`. They are kept on separate tabs and never added together. These have their own rules; see `.claude/rules/database-and-money.md` and (when written) a fundings page here.

## Flows

**Create a loan**
1. Click "New Loan" → form: Loan Type* , In Whose Name*, Lender, Loan Number, Vehicle, Other Collateral, Auto-debit from (bank account), Mandate, Principal*, Disbursed, Interest Rate (% p.a.), Start date*, First EMI date*, EMI*, EMI day of month*, Total installments*, Processing Fee, Outstanding Override, Notes.
2. Save. The whole schedule is generated at once: one installment a month from the first EMI date, on the EMI day (clamped to short months — day 31 falls on the 28th/29th in February and goes back to the 31st in March). The first installment keeps the exact date you gave.
3. Errors show in the form. Server limits: loan type must exist in the loan-type list; money must be positive, at most ₹100 crore, at most 2 decimals; interest 0–100%; EMI day 1–31; installments 1–600; first EMI not before the start date; notes up to 500 characters.

**Edit a loan** — row action "Edit". Changing EMI terms rebuilds the *unpaid* part of the schedule; installments already paid against are left alone. The server refuses a change (400) that would cut the schedule shorter than an installment that already has money against it. The form has **no status field**.

**Mark an EMI paid**
1. Hover a row → "Mark Paid". The dialog shows the installment number, due date and still-due amount, and pre-fills the amount with what is still due.
2. Change the amount for a part payment; set Paid On (today by default), method, reference (UTR / cheque no.) and notes.
3. "Record". Errors appear under the form and scroll into view.
4. The page refreshes: row status becomes Paid or Partly paid, Total Paid and Outstanding change, the payment appears on the Payments tab.

The server refuses: an amount over what is still due on that installment (400, "record the extra as a prepayment"), an already paid (409) or waived (409) installment, a date in the future or before the loan started, an amount that is zero, too large or has more than 2 decimals.

**Prepayment / Charge / Foreclose** — header buttons, same dialog, no installment attached. A prepayment lowers Outstanding without changing dates. A charge (bounce fee, penalty) is recorded but **never** lowers Outstanding. A foreclosure is a lump sum — it does not close the loan by itself.

**Flag an EMI as bounced** — "Bounced" on the row; "Clear" removes the flag. A bounced installment counts as overdue and shows in red. (The server also accepts "waived", but the web page has no Waive button.)

**Reverse a payment** — "Reverse" on a payment → confirm dialog ("Both the original and the reversal stay visible in the log"). A new row dated today is added, noted "Reversal of #<id>". Reversing the same payment twice gives 409; a reversal cannot be reversed (the button is hidden and the server answers 400).

**Delete a loan** — row action "Delete" → confirmation. Refused (400) if the loan has any recorded payment, or any private funding is linked to it.

**Documents** — row action "Documents" opens the loan's files (images, PDF, plain text).

## Rules the user can notice

- **Outstanding is never typed in** (except the optional Outstanding Override that matches a lender's statement, shown with an "Overridden" badge). It is worked out from the schedule and payments by the database, so the list, the detail page, the tiles and the calendar all show the same number.
- **What "overdue" means:** an installment that is Overdue or Bounced. A **part-paid installment past its due date does not count** — paying part of a late EMI makes the whole EMI vanish from the Overdue tile and "Overdue only" filter, while the EMI Calendar still lists it. This is deliberate: EMIs are taken in full by the bank mandate, so a part payment only happens if an admin types one in by hand ([0005](../decisions/0005-closed-loans-are-not-overdue.md)).
- **Closed and foreclosed loans** are left out of the Overdue tile, the "Overdue only" filter, the calendar and the summary tiles, even though their unpaid schedule rows still exist. A **Defaulted** loan is not excluded from the "Overdue only" filter.
- **Daily auto-payment:** every day a scheduled job records an EMI payment on its due date (method "AUTO") for any active loan's installment that is past due and Overdue or Partly paid, assuming the mandate went through. It skips Bounced installments. You will see these rows on the Payments tab with a note explaining it; reverse one if the lender says it wasn't paid. See decision 0001.
- **Sort order:** "Ending soonest" puts active loans first with the nearest last EMI on top, then closed loans, most recently ended first; "Newest first" sorts by start date.
- **"Due This Month"** counts active loans whose next unpaid EMI is on or before the last day of this month, so a loan with a late EMI counts here too.
- **Dates use India time** for "today" on the server.

## Where it lives

- **Pages:** `src/app/admin/loans/page.tsx`, `src/app/admin/loans/[id]/page.tsx`. Access in `src/lib/routePermissions.ts` (`/admin/loans` → admin, superadmin).
- **Components:** `src/components/loansPage/` (list, `loanMobileCard.tsx`, helpers), `src/components/loanDetailPage/` (detail, `loanPaymentModal.tsx`), `src/components/loanModal/` (create/edit form), `src/components/loanAttachmentsModal/`.
- **API:** `src/app/api/loans/route.ts` (GET list + summary, POST, PUT, DELETE), `[id]/route.ts` (GET one loan with schedule and payments), `[id]/payments/route.ts` (POST payment, PUT bounce/waive flag), `[id]/payments/[paymentId]/reverse/route.ts`, `calendar/route.ts`, helpers in `loans.utils.ts`.
- **Database:** `sql/31_add_loans.sql` (tables, `loan_balances`, `loan_installment_state`), `sql/41_fix_charge_installment_state.sql`, `sql/44_add_loan_attachments.sql`.
- **Scheduled job:** `scripts/check-loan-emis.js`, run by `.github/workflows/check-loan-emis.yml`.
- **Rules:** `.claude/rules/database-and-money.md`, `.claude/rules/platform-ops.md`, `.claude/rules/live-testing.md`.
- **Tests:** `test/app/api/loans/` (list, utils, calendar, `[id]` with payments and reverse), `test/components/loansPage/loansPage.utils.test.ts`, `e2e/features/loans/loans.spec.ts`.
- **Flutter:** `../mobile_sslogistics/lib/features/loans/` (list, detail, due-soon screens; filter, form and payment sheets). Its detail menu offers Prepayment and Foreclosure and "Mark Bounced".

## Why it works this way

- [0001 — Overdue EMIs are auto-settled by the daily job](../decisions/0001-auto-settle-overdue-emis.md)
- [0005 — Closed and foreclosed loans never count as overdue](../decisions/0005-closed-loans-are-not-overdue.md)
- [0006 — Open loan product questions](../decisions/0006-open-loan-product-questions.md)

## Not built / open questions

Open product questions (from `.claude/rules/live-testing.md`) — not changed, ask the owner:
- Should a **waived** EMI reduce the loan's outstanding?
- Should payments be **blocked on closed or foreclosed loans**? Today the server accepts them, and the schedule still shows "Mark Paid" on unpaid rows of a closed loan (only the Prepayment, Charge and Foreclose header buttons are hidden).
- Should **Foreclose** suggest the outstanding amount and close the loan? Today it just records a payment of whatever is typed and leaves the status Active.

Gaps found while writing this page:
- **A loan's status can't be changed from the web.** The edit form has no status field; Closed, Foreclosed and Defaulted are set only by calling the API. Yet deleting a loan that has payments is refused with "Mark it CLOSED, FORECLOSED, or DEFAULTED instead" — the page offers no way to do that.
- **No Waive button on the web** (the API supports it; the Flutter app's menu was only checked for "Mark Bounced").
- The status chips offer All, Active and Closed only; Foreclosed and Defaulted loans can't be filtered to.
- Staff cannot see loans at all; there is no read-only view for them.
- Whether row actions (Documents, Edit, Delete) are reachable by touch on a phone was not checked here.
