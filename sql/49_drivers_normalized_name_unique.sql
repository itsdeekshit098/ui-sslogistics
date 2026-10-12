-- One person, one driver row.
--
-- `drivers` has no unique constraint on the name at all today, so "Mehaboob"
-- and "MEHABOOB" (or "Meha boob") insert cleanly as three separate drivers.
-- That is not a cosmetic problem: attendance, salary rates, advances and
-- trips all hang off driver_id, so one person split across two rows has
-- their month split too, and both halves pay wrong.
--
-- POST/PUT /api/drivers already refuse an exact match and a repeated DL
-- number, with a friendlier message naming the conflicting driver. These
-- indexes are the backstop for anything that doesn't go through the route —
-- a hand-written INSERT in the SQL editor, an import, a future script.
--
-- Mirrors sql/42_entities_normalized_name_unique.sql, which solves exactly
-- this for entities.
--
-- Run this in the Supabase SQL editor **after** merging any existing
-- duplicates; it will fail to create while duplicates remain. To find them:
--
--   select lower(regexp_replace(name, '\s+', '', 'g')) as key,
--          count(*), array_agg(id) as ids, array_agg(name) as names
--   from drivers
--   group by 1 having count(*) > 1;

-- Case- and whitespace-insensitive: "Mehaboob" = "MEHABOOB" = "Meha boob".
create unique index if not exists drivers_normalized_name_unique
  on drivers (lower(regexp_replace(name, '\s+', '', 'g')));

-- A driving licence belongs to one person, whatever name the row carries, so
-- a repeated DL is a duplicate even when the spelling differs. Partial: most
-- drivers have no DL recorded, and those must not collide with each other.
create unique index if not exists drivers_normalized_dl_unique
  on drivers (lower(regexp_replace(dl_number, '[^A-Za-z0-9]', '', 'g')))
  where dl_number is not null and btrim(dl_number) <> '';

-- ---------------------------------------------------------------------
-- DOWN (manual rollback — uncomment to run)
-- ---------------------------------------------------------------------
-- drop index if exists drivers_normalized_name_unique;
-- drop index if exists drivers_normalized_dl_unique;
