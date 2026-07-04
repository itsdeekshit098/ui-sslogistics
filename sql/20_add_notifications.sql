-- Adds the notifications table backing the in-app + push notification
-- system: one row per recipient (fan-out at write time), so read state
-- is independent per admin/staff user instead of shared across a role.
--
-- Run this in the Supabase SQL editor. Reversible manually via the DOWN
-- section at the bottom (commented out).

create table if not exists notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id),
  type text not null,
  title text not null,
  body text not null,
  link_path text,
  metadata jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_unread_idx
  on notifications (user_id, read_at);
create index if not exists notifications_user_created_idx
  on notifications (user_id, created_at desc);

alter table notifications enable row level security;
-- No policies added — this app talks to Supabase exclusively via the
-- service-role key from Next.js API routes (see docs/supabase-security.md),
-- so RLS here defaults to deny-all for anon/authenticated clients.
--
-- Not enabled for Supabase Realtime: clients never hold Supabase
-- credentials (see ui-sslogistics/CLAUDE.md), so live delivery instead goes
-- through a server-side SSE poll-and-diff route mirroring the existing
-- /api/system/maintenance-stream pattern.

-- ---------------------------------------------------------------------
-- DOWN (manual rollback)
-- ---------------------------------------------------------------------
-- drop table if exists notifications;
