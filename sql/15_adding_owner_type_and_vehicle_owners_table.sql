-- Vehicle ownership: a vehicle is either owned by the company ("OWNED") or
-- belongs to a third party ("EXTERNAL"). External owners are looked up from
-- a dedicated table instead of free-text, so the same owner can be reused
-- across vehicles and we get autocomplete + no duplicate/typo'd names.
--
-- No migration tool is wired up in this repo (no supabase/migrations dir),
-- so run this manually once in the Supabase SQL editor before deploying the
-- owner_type / owner_id changes in src/app/api/vehicles/route.ts.

create table if not exists vehicle_owners (
  id bigint generated always as identity primary key,
  name text not null,
  phone text,
  email text,
  address text,
  gst_number text,
  notes text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Case-insensitive uniqueness so "ABC Transport" and "abc transport" can't
-- both get created from the inline "Add New Owner" flow.
create unique index if not exists vehicle_owners_name_key
  on vehicle_owners (lower(name));

alter table vehicles
  add column if not exists owner_type text not null default 'OWNED',
  add column if not exists owner_id bigint references vehicle_owners (id);

-- Defensive DB-level constraints mirroring the API validation in
-- src/app/api/vehicles/route.ts — belt-and-suspenders, not a replacement
-- for the server-side checks.
alter table vehicles
  drop constraint if exists vehicles_owner_type_check;
alter table vehicles
  add constraint vehicles_owner_type_check
  check (owner_type in ('OWNED', 'EXTERNAL'));

alter table vehicles
  drop constraint if exists vehicles_owner_id_required_for_external;
alter table vehicles
  add constraint vehicles_owner_id_required_for_external
  check (owner_type = 'OWNED' or owner_id is not null);