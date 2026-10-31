---
paths:
  - "sql/**"
  - "src/app/api/loans/**"
  - "src/app/api/fundings/**"
  - "src/app/api/clients/**"
  - "src/app/api/entities/**"
  - "src/app/api/lenders/**"
  - "src/app/api/lookups/**"
  - "src/app/api/bank-accounts/**"
  - "src/app/api/attachments/**"
  - "src/app/api/vehicle-owners/**"
  - "src/components/loan*/**"
  - "src/components/funding*/**"
  - "src/components/client*/**"
  - "test/app/api/loans/**"
  - "test/app/api/fundings/**"
  - "test/app/api/clients/**"
---

# Database and money modules

<!--
WHAT THIS FILE IS: a rule — project knowledge that Claude reads, not a program.
WHEN IT LOADS: automatically when Claude reads anything under sql/, the loans/fundings/clients/entities/
  lenders/lookups/bank-accounts/attachments API routes, their components, or their tests (see `paths:`).
WHY: this holds the three invariants that prevent money bugs — derived money is never stored, ledgers are
  append-only with reversals, and every money route is strict-admin (GET included). Breaking one brings back
  a bug the current design exists to prevent.
KEEP IN SYNC: the "currently up to <NN>" SQL number below must match the highest file in sql/
  (the reminders hook warns when it doesn't).
-->

Schema changes are recorded as SQL files in `sql/`, numbered sequentially (`sql/NN_description.sql`, currently up to `52_vehicle_document_date_order.sql`), and applied to Supabase manually — there is no migration runner. Each file carries a `--` header explaining *why* and a commented-out `-- DOWN` rollback section. New tables get `enable row level security` with **no policies** (deny-all for anon; all access is service-role via API routes).

## Money modules (loans, fundings, clients)

Three rules hold across all of them, and breaking any one reintroduces a bug the current design exists to prevent:

- **Derived money is never stored.** Loan outstanding comes from the `loan_balances` view, installment status from `loan_installment_state`, client receivables from `client_balances`. Funding interest is computed per request by `src/app/api/fundings/fundings.utils.ts`. Neither web nor mobile may recompute these — they display what the server returns. (`loans.outstanding_override` is the one exception, and only to match a lender's own statement.)
- **Ledgers are append-only.** `loan_payments`, `funding_entries` and `client_ledger_entries` are never edited or deleted. A mistake is corrected by inserting a row whose `reverses_*_id` points at the original; the views exclude *both* rows, so the pair nets to zero and the history stays auditable. A partial unique index on `reverses_*_id` makes a double-reversal a 409.
- **Every method is `requireStrictAdminAuth()`, GET included** — unlike most feature routes, which let staff read.

The loans list (`GET /api/loans`) takes `sort=ending_soon` (default: active loans first, the one whose last EMI is nearest on top, closed loans last) or `sort=newest` (the web page and the Flutter loans list both send it, so the two agree on order). The last EMI date (`final_due_date`) and the remaining count (`installments_left`) come from the `loan_balances` view, so "ending soon" loads every matching loan, merges balances, sorts and slices the page in the route — the same approach as the fundings list — instead of ordering in SQL.

`entities` is the single master of firms and people. It replaced `vehicle_owners`; `vehicles.owner_entity_id` is the real FK, while `owner_name` / `owner_type` survive as trigger-maintained mirrors so existing readers (the vehicles API, `get_vehicles_summary`, the Flutter app) keep working. `/api/vehicle-owners` is now a thin adapter over `entities`. Unlike the other money-module routes, `/api/entities` GET and POST are intentionally `requireAdminAuth` (not strict) — staff need to read/add entities to pick a borrower or owner elsewhere in the app — while its `PUT`/`DELETE` stay `requireStrictAdminAuth()`. This is a deliberate carve-out (see the inline comment on the route), not a bug to fix.

Label-only dropdown lists (loan types, client types, contact roles, payment methods) live in `lookup_options` and are edited at runtime through `<LookupSelect>`'s "+ Add new" footer or Settings → Dropdown Lists. **Do not add new Postgres enums for these** — `vehicle_type` and friends already demonstrate the cost (defined in the DB, in `vehicles.types.ts`, and in the API validation array, all needing a coordinated deploy).

`bank_accounts` (`sql/34`) holds SS Logistics's own bank accounts (holder is an `entities` row), so a loan can record which account its EMI mandate debits (`loans.debit_account_id`). Like the money modules, `/api/bank-accounts` is `requireStrictAdminAuth` on every method, GET included, and `DELETE` is blocked while any loan or client still references the account.

`attachments` (`sql/38`) is a shared files-per-record table used by vehicles, client ledger entries and loans via three mutually-exclusive nullable FKs (`vehicle_id` / `client_entry_id` / `loan_id`, enforced by a CHECK, each `ON DELETE CASCADE`). Files live in a private Supabase Storage bucket under random-UUID paths; `/api/attachments/view` streams them back through the app's own domain rather than a signed storage URL. Auth follows the owner: vehicle attachments are `requireAdminAuth` (images only), client/loan attachments are `requireStrictAdminAuth` including on read (images, PDF, and plain text).
