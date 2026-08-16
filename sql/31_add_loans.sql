-- Institutional loans: vehicle / personal / mortgage borrowings from a bank or
-- NBFC, repaid on a fixed EMI schedule, held in the name of one of our firms or
-- family members (loans.borrower_entity_id -> entities, sql/28).
--
-- Three tables, because a loan is three different things:
--   loans              — the contract terms, entered once
--   loan_installments  — the schedule, generated from those terms
--   loan_payments      — what actually happened, append-only
--
-- Why the schedule and the payments are separate from the loan: an EMI that
-- bounced, one paid late, a part payment, a prepayment that shortens the loan —
-- none of those are expressible in the terms alone. Deriving "paid" from "the
-- due date has passed" (which is what a terms-only model has to do) silently
-- reports the wrong outstanding the first time anything is irregular, and this
-- is money owed to a financier.
--
-- Nothing here is ever edited or deleted. A mistake is corrected by inserting a
-- reversal that points at the original, so the history stays auditable — the
-- same shape the client receivables ledger uses.
--
-- Balances and installment status are NOT stored. Both are derived by the two
-- views at the bottom, so they cannot drift away from the payment rows.
--
-- Run this in the Supabase SQL editor. Reversible manually via the DOWN
-- section at the bottom (commented out).

-- ---------------------------------------------------------------------
-- 1. The contract
-- ---------------------------------------------------------------------

create table if not exists loans (
  id                   bigint generated always as identity primary key,
  -- References lookup_options('loan_type').value rather than an enum, so a new
  -- kind of loan needs no migration (see sql/29_add_lookup_options.sql).
  loan_type            text not null,
  borrower_entity_id   bigint not null references entities(id),
  lender_id            bigint references lenders(id),
  account_number       text,

  -- Collateral. A vehicle loan on a vehicle we track links to it; anything else
  -- (land, gold, a vehicle not in our fleet) is described in free text.
  vehicle_id           bigint references vehicles(id),
  collateral_description text,

  -- Terms
  principal_amount     numeric not null,
  interest_rate        numeric,
  processing_fee       numeric,
  start_date           date not null,
  -- Stored explicitly rather than derived from start_date + emi_day_of_month:
  -- financiers routinely set the first EMI a month or two after disbursal, and
  -- guessing it wrong shifts the entire schedule.
  first_emi_date       date not null,
  emi_amount           numeric not null,
  emi_day_of_month     integer not null,
  total_installments   integer not null,

  -- Escape hatch for reconciling against a lender's own statement (foreclosure
  -- quotes, interest recalculations we don't model). When set it wins over the
  -- derived figure in loan_balances.
  outstanding_override numeric,

  status               text not null default 'ACTIVE',
  closed_on            date,
  notes                text,
  created_by           uuid,
  updated_by           uuid,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint loans_status_check
    check (status in ('ACTIVE', 'CLOSED', 'FORECLOSED', 'DEFAULTED')),
  constraint loans_principal_check check (principal_amount >= 0),
  constraint loans_interest_rate_check
    check (interest_rate is null or interest_rate >= 0),
  constraint loans_processing_fee_check
    check (processing_fee is null or processing_fee >= 0),
  constraint loans_emi_amount_check check (emi_amount > 0),
  constraint loans_emi_day_check check (emi_day_of_month between 1 and 31),
  constraint loans_total_installments_check check (total_installments > 0),
  constraint loans_outstanding_override_check
    check (outstanding_override is null or outstanding_override >= 0),
  constraint loans_first_emi_check check (first_emi_date >= start_date)
);

create index if not exists idx_loans_status on loans (status);
create index if not exists idx_loans_borrower on loans (borrower_entity_id);
create index if not exists idx_loans_lender on loans (lender_id);
create index if not exists idx_loans_vehicle on loans (vehicle_id);

-- ---------------------------------------------------------------------
-- 2. The schedule
-- ---------------------------------------------------------------------

create table if not exists loan_installments (
  id              bigint generated always as identity primary key,
  loan_id         bigint not null references loans(id) on delete cascade,
  installment_no  integer not null,
  due_date        date not null,
  amount_due      numeric not null,
  -- Overrides the derived status. WAIVED = the lender let it go; BOUNCED = the
  -- mandate failed. Everything else (paid / partial / overdue / pending) comes
  -- from the payment rows and the calendar, so it can't be set wrongly by hand.
  manual_status   text,
  notes           text,
  created_at      timestamptz not null default now(),

  constraint loan_installments_unique unique (loan_id, installment_no),
  constraint loan_installments_amount_check check (amount_due > 0),
  constraint loan_installments_no_check check (installment_no > 0),
  constraint loan_installments_manual_status_check
    check (manual_status is null or manual_status in ('WAIVED', 'BOUNCED'))
);

-- Drives the daily reminder job, which scans by due date across all loans.
create index if not exists idx_loan_installments_due
  on loan_installments (due_date);
create index if not exists idx_loan_installments_loan
  on loan_installments (loan_id, installment_no);

-- ---------------------------------------------------------------------
-- 3. What actually happened (append-only)
-- ---------------------------------------------------------------------

create table if not exists loan_payments (
  id                  bigint generated always as identity primary key,
  loan_id             bigint not null references loans(id) on delete cascade,
  -- Set for an EMI against a specific scheduled installment; null for money
  -- that isn't tied to one (prepayment, foreclosure, a bounce charge).
  installment_id      bigint references loan_installments(id) on delete cascade,
  payment_type        text not null,
  amount              numeric not null,
  paid_on             date not null,
  payment_method      text,
  reference           text,
  notes               text,
  -- Points at the row this one cancels. The pair is then excluded from every
  -- balance, netting to zero without deleting the history.
  reverses_payment_id bigint references loan_payments(id),
  created_by          uuid,
  created_at          timestamptz not null default now(),

  constraint loan_payments_amount_check check (amount > 0),
  constraint loan_payments_type_check
    check (payment_type in ('EMI', 'PREPAYMENT', 'FORECLOSURE', 'CHARGE', 'ADJUSTMENT')),
  -- An EMI payment must say which installment it settles.
  constraint loan_payments_emi_needs_installment
    check (payment_type <> 'EMI' or installment_id is not null)
);

-- A payment can be reversed at most once; a second attempt hits this and
-- surfaces as a 409 rather than double-crediting the loan.
create unique index if not exists uq_loan_payments_reverses
  on loan_payments (reverses_payment_id)
  where reverses_payment_id is not null;

create index if not exists idx_loan_payments_loan on loan_payments (loan_id);
create index if not exists idx_loan_payments_installment
  on loan_payments (installment_id);

alter table loans enable row level security;
alter table loan_installments enable row level security;
alter table loan_payments enable row level security;
-- No policies added — service-role access only (see docs/supabase-security.md).
-- Loans are the most sensitive data in this app; the API routes additionally
-- gate every method, including GET, behind requireStrictAdminAuth().

-- ---------------------------------------------------------------------
-- 4. Derived state
-- ---------------------------------------------------------------------

-- Per installment: how much has effectively been paid against it, and what
-- that makes its status. A payment counts only if it is neither a reversal
-- itself nor has been reversed by a later row.
create or replace view loan_installment_state
with (security_invoker = on) as
select
  i.id,
  i.loan_id,
  i.installment_no,
  i.due_date,
  i.amount_due,
  i.manual_status,
  i.notes,
  coalesce(p.amount_paid, 0) as amount_paid,
  greatest(i.amount_due - coalesce(p.amount_paid, 0), 0) as amount_remaining,
  case
    when i.manual_status is not null                  then i.manual_status
    when coalesce(p.amount_paid, 0) >= i.amount_due   then 'PAID'
    when coalesce(p.amount_paid, 0) > 0               then 'PARTIAL'
    when i.due_date < current_date                    then 'OVERDUE'
    else 'PENDING'
  end as status
from loan_installments i
left join lateral (
  select sum(lp.amount) as amount_paid
  from loan_payments lp
  where lp.installment_id = i.id
    and lp.reverses_payment_id is null
    and not exists (
      select 1 from loan_payments r where r.reverses_payment_id = lp.id
    )
) p on true;

-- Per loan: everything the list and detail screens display, so neither the web
-- app nor the mobile app ever computes a balance itself.
create or replace view loan_balances
with (security_invoker = on) as
select
  l.id as loan_id,
  coalesce(s.total_payable, 0)  as total_payable,
  coalesce(p.total_paid, 0)     as total_paid,
  coalesce(p.total_charges, 0)  as total_charges,
  case
    when l.outstanding_override is not null then l.outstanding_override
    else greatest(coalesce(s.total_payable, 0) - coalesce(p.total_paid, 0), 0)
  end as outstanding,
  coalesce(s.installments_paid, 0) as installments_paid,
  coalesce(s.installments_left, 0) as installments_left,
  nxt.due_date       as next_due_date,
  nxt.amount_remaining as next_due_amount,
  coalesce(s.overdue_count, 0)  as overdue_count,
  coalesce(s.overdue_amount, 0) as overdue_amount,
  s.final_due_date,
  p.last_payment_date
from loans l
left join lateral (
  select
    sum(st.amount_due) as total_payable,
    count(*) filter (where st.status = 'PAID')                    as installments_paid,
    count(*) filter (where st.status not in ('PAID', 'WAIVED'))   as installments_left,
    count(*) filter (where st.status in ('OVERDUE', 'BOUNCED'))   as overdue_count,
    coalesce(
      sum(st.amount_remaining) filter (where st.status in ('OVERDUE', 'BOUNCED')),
      0
    ) as overdue_amount,
    max(st.due_date) as final_due_date
  from loan_installment_state st
  where st.loan_id = l.id
) s on true
-- The next thing actually owed, which may already be overdue — that is what
-- the "Next EMI" column should show, not the next future date.
left join lateral (
  select st.due_date, st.amount_remaining
  from loan_installment_state st
  where st.loan_id = l.id
    and st.status not in ('PAID', 'WAIVED')
  order by st.due_date, st.installment_no
  limit 1
) nxt on true
left join lateral (
  select
    coalesce(sum(lp.amount) filter (
      where lp.payment_type in ('EMI', 'PREPAYMENT', 'FORECLOSURE', 'ADJUSTMENT')
    ), 0) as total_paid,
    -- Charges (bounce fees, penalties) are a cost, not a repayment — they are
    -- reported separately and never reduce the outstanding.
    coalesce(sum(lp.amount) filter (where lp.payment_type = 'CHARGE'), 0) as total_charges,
    max(lp.paid_on) as last_payment_date
  from loan_payments lp
  where lp.loan_id = l.id
    and lp.reverses_payment_id is null
    and not exists (
      select 1 from loan_payments r where r.reverses_payment_id = lp.id
    )
) p on true;

-- ---------------------------------------------------------------------
-- DOWN (manual rollback — uncomment to run)
-- ---------------------------------------------------------------------
-- drop view if exists loan_balances;
-- drop view if exists loan_installment_state;
-- drop table if exists loan_payments;
-- drop table if exists loan_installments;
-- drop table if exists loans;
