-- Master list of everyone we borrow FROM: financiers (Shriram, Cholamandalam,
-- Axis…) that give structured EMI loans, and private individuals who lend a
-- lump sum at an agreed ROI with no schedule.
--
-- Why one table and not two: the same party can appear in both roles, and free
-- text was the alternative — "HDFC" vs "hdfc bank" vs "HDFC Bank Ltd" all
-- meaning one lender, with no way to total what we owe them. `lender_kind`
-- filters the dropdown per context so a loan form doesn't offer private
-- funders and vice versa, without duplicating the row.
--
-- Run this in the Supabase SQL editor. Reversible manually via the DOWN
-- section at the bottom (commented out).

create table if not exists lenders (
  id             bigint generated always as identity primary key,
  name           text not null,
  lender_kind    text not null,
  phone          text,
  contact_person text,
  notes          text,
  is_active      boolean not null default true,
  created_by     uuid,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint lenders_name_unique unique (name),
  -- INSTITUTION = bank/NBFC with an EMI schedule. PRIVATE = an individual
  -- lending at a monthly/annual ROI, repaid ad hoc.
  constraint lenders_kind_check
    check (lender_kind in ('INSTITUTION', 'PRIVATE')),
  constraint lenders_phone_check
    check (phone is null or phone ~ '^[6-9][0-9]{9}$')
);

create index if not exists idx_lenders_kind on lenders (lender_kind, is_active);

alter table lenders enable row level security;
-- No policies added — service-role access only, same as every other table here
-- (see docs/supabase-security.md).

-- ---------------------------------------------------------------------
-- Seeds — the financiers commonly used for commercial vehicle loans.
-- Private funders are added by the user as they arise.
-- ---------------------------------------------------------------------

insert into lenders (name, lender_kind) values
  ('Shriram Finance',       'INSTITUTION'),
  ('Cholamandalam Finance', 'INSTITUTION'),
  ('Axis Bank',             'INSTITUTION'),
  ('HDFC Bank',             'INSTITUTION'),
  ('ICICI Bank',            'INSTITUTION'),
  ('State Bank of India',   'INSTITUTION'),
  ('Bajaj Finance',         'INSTITUTION'),
  ('Mahindra Finance',      'INSTITUTION'),
  ('TVS Credit',            'INSTITUTION'),
  ('Sundaram Finance',      'INSTITUTION')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------
-- DOWN (manual rollback — uncomment to run)
-- ---------------------------------------------------------------------
-- drop table if exists lenders;
