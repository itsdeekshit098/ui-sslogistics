-- Private / "hand" loans: an individual lends a lump sum at an agreed ROI
-- (e.g. 2% per month). There is no schedule — principal comes back ad hoc,
-- interest is paid whenever we have it or whenever they push for it, and more
-- money may be borrowed from the same person later.
--
-- Interest is SIMPLE and never compounds: unpaid interest stays interest and
-- never joins the principal. So ₹1,00,000 at 2%/month accrues ₹2,000 a month
-- whether or not last month's ₹2,000 was actually paid, and repaying half the
-- principal halves the accrual from that day forward.
--
-- Interest is therefore not stored anywhere. It is computed from two
-- timelines — how much principal was outstanding when, and what rate applied
-- when — intersected and pro-rated by days
-- (src/app/api/fundings/fundings.utils.ts). Storing accrual rows would mean
-- rewriting history every time a backdated repayment is entered.
--
-- Run this in the Supabase SQL editor. Reversible manually via the DOWN
-- section at the bottom (commented out).

-- ---------------------------------------------------------------------
-- 1. The arrangement
-- ---------------------------------------------------------------------

create table if not exists fundings (
  id                 bigint generated always as identity primary key,
  funder_id          bigint not null references lenders(id),
  -- Whose name the arrangement is in, when it matters.
  borrower_entity_id bigint references entities(id),
  -- Set when this money was raised to service a specific institutional loan.
  linked_loan_id     bigint references loans(id),

  -- PERCENT: a rate applied to the outstanding principal.
  -- FIXED:   a flat rupee amount per month, agreed regardless of principal.
  -- The rate/amount itself lives in funding_rate_history, never here, so a
  -- renegotiation can't silently rewrite interest already accrued.
  interest_mode      text not null default 'PERCENT',
  -- Day of month the funder expects their interest, if they have a habit.
  interest_due_day   integer,

  start_date         date not null,
  status             text not null default 'OPEN',
  settled_on         date,
  notes              text,
  created_by         uuid,
  updated_by         uuid,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint fundings_interest_mode_check
    check (interest_mode in ('PERCENT', 'FIXED')),
  constraint fundings_status_check check (status in ('OPEN', 'SETTLED')),
  constraint fundings_interest_due_day_check
    check (interest_due_day is null or interest_due_day between 1 and 31),
  constraint fundings_settled_on_check
    check (settled_on is null or settled_on >= start_date)
);

create index if not exists idx_fundings_funder on fundings (funder_id);
create index if not exists idx_fundings_status on fundings (status);
create index if not exists idx_fundings_loan on fundings (linked_loan_id);

-- ---------------------------------------------------------------------
-- 2. Rate over time
-- ---------------------------------------------------------------------
-- One row per agreed rate, from the opening rate onwards. Interest for any
-- period is computed at the rate in force on that day, so renegotiating to 1.5%
-- in March leaves January and February accrued at 2%.

create table if not exists funding_rate_history (
  id                    bigint generated always as identity primary key,
  funding_id            bigint not null references fundings(id) on delete cascade,
  roi                   numeric,
  roi_basis             text,
  fixed_interest_amount numeric,
  effective_from        date not null,
  note                  text,
  created_by            uuid,
  created_at            timestamptz not null default now(),

  constraint funding_rate_history_unique unique (funding_id, effective_from),
  constraint funding_rate_history_roi_check check (roi is null or roi >= 0),
  constraint funding_rate_history_basis_check
    check (roi_basis is null or roi_basis in ('MONTHLY', 'ANNUAL')),
  constraint funding_rate_history_fixed_check
    check (fixed_interest_amount is null or fixed_interest_amount >= 0),
  -- A percentage rate is meaningless without knowing per what.
  constraint funding_rate_history_basis_required
    check (roi is null or roi_basis is not null),
  -- Every row has to specify something to charge.
  constraint funding_rate_history_has_value
    check (roi is not null or fixed_interest_amount is not null)
);

create index if not exists idx_funding_rate_history_funding
  on funding_rate_history (funding_id, effective_from);

-- ---------------------------------------------------------------------
-- 3. Money in and out (append-only)
-- ---------------------------------------------------------------------

create table if not exists funding_entries (
  id                bigint generated always as identity primary key,
  funding_id        bigint not null references fundings(id) on delete cascade,
  -- PRINCIPAL_TAKEN  — money received from the funder. Also covers a top-up:
  --                    borrowing more is another entry, not another funding.
  -- PRINCIPAL_REPAID — principal returned, reducing future interest.
  -- INTEREST_PAID    — interest handed over; never touches the principal.
  -- ADJUSTMENT       — a settlement write-off or agreed correction.
  entry_type        text not null,
  amount            numeric not null,
  entry_date        date not null,
  payment_method    text,
  reference         text,
  description       text,
  reverses_entry_id bigint references funding_entries(id),
  created_by        uuid,
  created_at        timestamptz not null default now(),

  constraint funding_entries_amount_check check (amount > 0),
  constraint funding_entries_type_check
    check (entry_type in
      ('PRINCIPAL_TAKEN', 'PRINCIPAL_REPAID', 'INTEREST_PAID', 'ADJUSTMENT'))
);

create unique index if not exists uq_funding_entries_reverses
  on funding_entries (reverses_entry_id)
  where reverses_entry_id is not null;

create index if not exists idx_funding_entries_funding
  on funding_entries (funding_id, entry_date, id);

alter table fundings enable row level security;
alter table funding_rate_history enable row level security;
alter table funding_entries enable row level security;
-- No policies added — service-role access only (see docs/supabase-security.md).

-- ---------------------------------------------------------------------
-- 4. Derived principal position
-- ---------------------------------------------------------------------
-- Only the parts that are pure arithmetic over the entries. Accrued interest
-- needs the day-by-day rate timeline and is computed in the API layer.

create or replace view funding_balances
with (security_invoker = on) as
select
  f.id as funding_id,
  coalesce(e.principal_taken, 0)   as principal_taken,
  coalesce(e.principal_repaid, 0)  as principal_repaid,
  greatest(
    coalesce(e.principal_taken, 0)
      - coalesce(e.principal_repaid, 0)
      - coalesce(e.adjustments, 0),
    0
  ) as principal_outstanding,
  coalesce(e.interest_paid, 0)     as interest_paid,
  coalesce(e.adjustments, 0)       as adjustments,
  e.last_entry_date
from fundings f
left join lateral (
  select
    coalesce(sum(fe.amount) filter (where fe.entry_type = 'PRINCIPAL_TAKEN'), 0)  as principal_taken,
    coalesce(sum(fe.amount) filter (where fe.entry_type = 'PRINCIPAL_REPAID'), 0) as principal_repaid,
    coalesce(sum(fe.amount) filter (where fe.entry_type = 'INTEREST_PAID'), 0)    as interest_paid,
    coalesce(sum(fe.amount) filter (where fe.entry_type = 'ADJUSTMENT'), 0)       as adjustments,
    max(fe.entry_date) as last_entry_date
  from funding_entries fe
  where fe.funding_id = f.id
    and fe.reverses_entry_id is null
    and not exists (
      select 1 from funding_entries r where r.reverses_entry_id = fe.id
    )
) e on true;

-- ---------------------------------------------------------------------
-- DOWN (manual rollback — uncomment to run)
-- ---------------------------------------------------------------------
-- drop view if exists funding_balances;
-- drop table if exists funding_entries;
-- drop table if exists funding_rate_history;
-- drop table if exists fundings;
