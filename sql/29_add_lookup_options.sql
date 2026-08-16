-- One generic registry for the app's simple label-only dropdown lists.
--
-- Why not enums or CHECK constraints: lists like "loan type" grow. Today it's
-- vehicle/personal/mortgage; tomorrow it's machinery or a top-up. As a
-- Postgres enum that costs an ALTER TYPE plus a TS constant edit plus an API
-- validation-array edit plus a deploy, coordinated with the Flutter app (see
-- 11_enums_for_vehicle_types.sql for that pain — vehicle_type is defined in
-- three places). Here a new option is one INSERT, addable from the "+ Add new"
-- footer on any dropdown, live, with no deploy.
--
-- Structural enums (vehicle_type_enum and friends) deliberately stay as they
-- are — those drive conditional form fields and DB columns, not just labels.
--
-- Run this in the Supabase SQL editor. Reversible manually via the DOWN
-- section at the bottom (commented out).

create table if not exists lookup_options (
  id          bigint generated always as identity primary key,
  category    text not null,
  value       text not null,
  label       text not null,
  sort_order  integer not null default 100,
  is_active   boolean not null default true,
  -- Seeded rows the app's own code may reference by value. They can be
  -- relabelled or deactivated, never deleted.
  is_system   boolean not null default false,
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint lookup_options_unique unique (category, value),
  constraint lookup_options_category_check check (category <> ''),
  constraint lookup_options_value_check check (value <> ''),
  constraint lookup_options_label_check check (label <> '')
);

create index if not exists idx_lookup_options_category
  on lookup_options (category, is_active, sort_order);

alter table lookup_options enable row level security;
-- No policies added — service-role access only, same as every other table
-- here (see docs/supabase-security.md).

-- ---------------------------------------------------------------------
-- Seeds
-- ---------------------------------------------------------------------

insert into lookup_options (category, value, label, sort_order, is_system) values
  -- Loans
  ('loan_type', 'VEHICLE',   'Vehicle Loan',    10, true),
  ('loan_type', 'PERSONAL',  'Personal Loan',   20, true),
  ('loan_type', 'LAND',      'Land Loan',       30, true),
  ('loan_type', 'MORTGAGE',  'Mortgage Loan',   40, true),
  ('loan_type', 'BUSINESS',  'Business Loan',   50, true),
  ('loan_type', 'GOLD',      'Gold Loan',       60, true),
  ('loan_type', 'MACHINERY', 'Machinery Loan',  70, true),
  ('loan_type', 'TOP_UP',    'Top-up Loan',     80, true),
  ('loan_type', 'OTHER',     'Other',           90, true),

  -- Clients
  ('client_type', 'PRIMARY', 'Primary',            10, true),
  ('client_type', 'VENDOR',  'Vendor / Sub-company', 20, true),
  ('client_type', 'PARTNER', 'Partner',            30, true),

  -- Client point-of-contact roles
  ('contact_role', 'HR',         'HR',         10, true),
  ('contact_role', 'OPERATIONS', 'Operations', 20, true),
  ('contact_role', 'ACCOUNTS',   'Accounts',   30, true),
  ('contact_role', 'MANAGEMENT', 'Management', 40, true),
  ('contact_role', 'OTHER',      'Other',      50, true),

  -- How money moved, on loan payments / funding entries / client payments
  ('payment_method', 'CASH',   'Cash',   10, true),
  ('payment_method', 'UPI',    'UPI',    20, true),
  ('payment_method', 'NEFT',   'NEFT',   30, true),
  ('payment_method', 'RTGS',   'RTGS',   40, true),
  ('payment_method', 'CHEQUE', 'Cheque', 50, true)
on conflict (category, value) do nothing;

-- ---------------------------------------------------------------------
-- DOWN (manual rollback — uncomment to run)
-- ---------------------------------------------------------------------
-- drop table if exists lookup_options;
