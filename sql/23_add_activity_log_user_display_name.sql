-- Adds user_display_name to activity_log so the Activity Log admin page can
-- show who performed an action by name instead of email. Older rows written
-- before this column existed remain null; the page falls back to user_email
-- for those.
--
-- Run this in the Supabase SQL editor. Reversible manually via the DOWN
-- section at the bottom (commented out).

alter table activity_log add column if not exists user_display_name text;

-- ---------------------------------------------------------------------
-- DOWN (manual rollback)
-- ---------------------------------------------------------------------
-- alble activity_log drop column if exists user_display_name;
