-- Adds vehicle ownership tracking: own vehicles (possibly under different
-- family proprietorships) vs. external/leased-in vehicles.
--
-- Run this in the Supabase SQL editor. Reversible manually via the DOWN
-- section at the bottom (commented out).

-- 1. Lookup table of owner names, each tagged with an owner_type so the
--    "Owner Name" dropdown can be filtered by the selected "Owner Type".
create table if not exists vehicle_owners (
  id bigint generated always as identity primary key,
  name text not null,
  owner_type text not null check (owner_type in ('OWN', 'EXTERNAL')),
  created_at timestamptz not null default now(),
  constraint vehicle_owners_name_unique unique (name)
);

alter table vehicle_owners enable row level security;
-- No policies added — this app talks to Supabase exclusively via the
-- service-role key from Next.js API routes (see docs/supabase-security.md),
-- so RLS here defaults to deny-all for anon/authenticated clients.

-- 2. Denormalized columns on vehicles — the selected owner's type/name are
--    copied onto the vehicle row directly (no FK), per the flow: pick
--    Owner Type, then pick Owner Name from vehicle_owners filtered to that
--    type, and store both values as-is.
alter table vehicles
  add column if not exists owner_type text check (owner_type in ('OWN', 'EXTERNAL')),
  add column if not exists owner_name text;

-- ---------------------------------------------------------------------
-- DOWN (manual rollback — uncomment to run)
-- ---------------------------------------------------------------------
-- alter table vehicles drop column if exists owner_type;
-- alter table vehicles drop column if exists owner_name;
-- drop table if exists vehicle_owners;
