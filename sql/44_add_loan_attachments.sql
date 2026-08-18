-- Two loan-related additions bundled together since neither was applied yet:
--
-- 1. Extends the shared attachments table (sql/38_add_attachments.sql) with
--    a third parent: loans. Lets a loan agreement, collateral photo, or
--    other supporting document be attached per loan, same as vehicle photos
--    and client payment proofs. This is exactly the "one nullable column
--    plus one number in the CHECK" extension that migration's header
--    comment anticipated.
--
-- 2. Adds loans.disbursed_amount — what actually landed in the account at
--    disbursal, distinct from principal_amount (the sanctioned/contract
--    figure). Lenders routinely net off processing fees, insurance, or
--    other deductions before disbursing, so the two can differ and both are
--    worth keeping. A contract term entered once, like processing_fee — not
--    derived, and it never feeds the EMI schedule or the outstanding
--    balance in loan_balances.
--
-- Run this manually in the Supabase SQL editor.

-- ─── 1. Loan attachments ───

alter table attachments
  add column if not exists loan_id bigint references loans(id) on delete cascade;

alter table attachments
  drop constraint if exists attachments_one_parent;

alter table attachments
  add constraint attachments_one_parent
    check (num_nonnulls(vehicle_id, client_entry_id, loan_id) = 1);

create index if not exists idx_attachments_loan
  on attachments (loan_id)
  where loan_id is not null;

-- ─── 2. Loan disbursed amount ───

alter table loans
  add column if not exists disbursed_amount numeric;

alter table loans
  drop constraint if exists loans_disbursed_amount_check;

alter table loans
  add constraint loans_disbursed_amount_check
    check (disbursed_amount is null or disbursed_amount >= 0);

-- ---------------------------------------------------------------------
-- DOWN (manual rollback)
-- ---------------------------------------------------------------------
-- delete from attachments where loan_id is not null;
-- alter table attachments drop constraint if exists attachments_one_parent;
-- alter table attachments
--   add constraint attachments_one_parent
--     check (num_nonnulls(vehicle_id, client_entry_id) = 1);
-- drop index if exists idx_attachments_loan;
-- alter table attachments drop column if exists loan_id;
-- alter table loans drop constraint if exists loans_disbursed_amount_check;
-- alter table loans drop column if exists disbursed_amount;
