-- Our own bank accounts, so a loan can record which account its EMI mandate
-- debits. This is NOT the lender's loan reference — that lives in
-- loans.loan_number (renamed from account_number in this same file, because
-- "Loan Account Number" sitting next to a real bank account reads as the same
-- thing and isn't).
--
-- The holder is an entities FK rather than free text: the Deekshith who holds
-- this account is the same Deekshith who borrows on loans and owns vehicles,
-- and that is the entire reason the entities master exists (sql/28).
--
-- Deliberately NOT referenced from loan_payments / funding_entries /
-- client_ledger_entries. Tagging individual payments would imply a per-account
-- balance the app cannot compute — it never sees diesel, salaries or tolls —
-- and a confidently wrong balance is worse than none. Adding it later is a
-- nullable column with no rework.
--
-- Run this in the Supabase SQL editor. Reversible manually via the DOWN
-- section at the bottom (commented out).

create table if not exists bank_accounts (
  id               bigint generated always as identity primary key,
  holder_entity_id bigint not null references entities(id),
  -- References lookup_options('bank_name').value so a new bank needs no
  -- migration (see sql/29_add_lookup_options.sql).
  bank_name        text not null,
  account_number   text not null,
  account_type     text not null default 'SAVINGS',
  ifsc             text,
  branch           text,
  -- Optional human label, e.g. "Salary account". Overrides the derived
  -- "Axis Bank ••81" half of the display label when set.
  nickname         text,
  notes            text,
  is_active        boolean not null default true,
  created_by       uuid,
  updated_by       uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint bank_accounts_type_check
    check (account_type in ('SAVINGS', 'CURRENT', 'OD', 'CC')),
  constraint bank_accounts_unique unique (bank_name, account_number),
  constraint bank_accounts_ifsc_check
    check (ifsc is null or ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$')
);

create index if not exists idx_bank_accounts_holder
  on bank_accounts (holder_entity_id, is_active);

alter table bank_accounts enable row level security;
-- No policies — service-role access only (see docs/supabase-security.md).

-- ---------------------------------------------------------------------
-- Loans: the lender's reference gets an unambiguous name, and the mandate
-- account gets a home.
-- ---------------------------------------------------------------------

alter table loans rename column account_number to loan_number;

alter table loans add column if not exists debit_account_id bigint
  references bank_accounts(id);
alter table loans add column if not exists mandate_type text;

alter table loans add constraint loans_mandate_type_check
  check (mandate_type is null
         or mandate_type in ('NACH', 'ECS', 'SI', 'PDC', 'MANUAL'));

create index if not exists idx_loans_debit_account
  on loans (debit_account_id);

-- ---------------------------------------------------------------------
-- Seed the bank list, mirroring the lender seeds in sql/30.
-- ---------------------------------------------------------------------
-- value == label here, matching how lenders.name is stored (the full name is
-- the value — loan_type/client_type's coded-value-vs-label split is existing
-- debt, not a pattern worth repeating for a field that's just a bank's name).
insert into lookup_options (category, value, label, sort_order, is_system) values
  ('bank_name', 'Axis Bank',           'Axis Bank',           10, true),
  ('bank_name', 'HDFC Bank',           'HDFC Bank',           20, true),
  ('bank_name', 'ICICI Bank',          'ICICI Bank',          30, true),
  ('bank_name', 'State Bank of India', 'State Bank of India', 40, true),
  ('bank_name', 'Kotak Mahindra Bank', 'Kotak Mahindra Bank', 50, true),
  ('bank_name', 'Canara Bank',         'Canara Bank',         60, true),
  ('bank_name', 'Union Bank of India', 'Union Bank of India', 70, true),
  ('bank_name', 'Punjab National Bank','Punjab National Bank',80, true),
  ('bank_name', 'Bank of Baroda',      'Bank of Baroda',      90, true),
  ('bank_name', 'Indian Bank',         'Indian Bank',        100, true)
on conflict (category, value) do nothing;

-- ---------------------------------------------------------------------
-- DOWN (manual rollback — uncomment to run)
-- ---------------------------------------------------------------------
-- delete from lookup_options where category = 'bank_name';
-- drop index if exists idx_loans_debit_account;
-- alter table loans drop constraint if exists loans_mandate_type_check;
-- alter table loans drop column if exists mandate_type;
-- alter table loans drop column if exists debit_account_id;
-- alter table loans rename column loan_number to account_number;
-- drop table if exists bank_accounts;
