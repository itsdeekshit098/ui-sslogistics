-- Adds a system_settings singleton table backing "maintenance mode": a
-- kill switch the owner/admin can flip to block all non-admin traffic
-- (web + mobile) while working on something risky.
--
-- Run this in the Supabase SQL editor. Reversible manually via the DOWN
-- section at the bottom (commented out).

create table if not exists system_settings (
  id bigint generated always as identity primary key,
  maintenance_mode boolean not null default false,
  maintenance_message text,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  -- Enforce a single row (singleton config table).
  singleton boolean not null default true unique
);

alter table system_settings enable row level security;
-- No policies added — this app talks to Supabase exclusively via the
-- service-role key from Next.js API routes (see docs/supabase-security.md),
-- so RLS here defaults to deny-all for anon/authenticated clients.

insert into system_settings (maintenance_mode)
values (false)
on conflict (singleton) do nothing;

-- ---------------------------------------------------------------------
-- DOWN (manual rollback)
-- ---------------------------------------------------------------------
-- drop table if exists system_settings;
