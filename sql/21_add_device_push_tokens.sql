-- Adds device_push_tokens: FCM registration tokens per user/device,
-- used to send push notifications to admin/staff mobile devices.
--
-- Run this in the Supabase SQL editor. Reversible manually via the DOWN
-- section at the bottom (commented out).

create table if not exists device_push_tokens (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id),
  token text not null,
  platform text not null check (platform in ('android', 'ios')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, token)
);

alter table device_push_tokens enable row level security;
-- No policies added — this app talks to Supabase exclusively via the
-- service-role key from Next.js API routes (see docs/supabase-security.md),
-- so RLS here defaults to deny-all for anon/authenticated clients.

-- ---------------------------------------------------------------------
-- DOWN (manual rollback)
-- ---------------------------------------------------------------------
-- drop table if exists device_push_tokens;
