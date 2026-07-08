-- Extends the system_settings singleton (see 19_add_system_settings.sql)
-- with a "force update" gate: the minimum Android versionCode (Flutter's
-- pubspec.yaml build number, the `+N` in `1.1.0+4`) a client must be on.
-- Clients below this build get a non-dismissible update popup.
--
-- Run this in the Supabase SQL editor. Reversible manually via the DOWN
-- section at the bottom (commented out).

alter table system_settings
  add column if not exists min_android_version_code integer,
  add column if not exists force_update_message text;

-- ---------------------------------------------------------------------
-- DOWN (manual rollback)
-- ---------------------------------------------------------------------
-- alter table system_settings
--   drop column if exists min_android_version_code,
--   drop column if exists force_update_message;
