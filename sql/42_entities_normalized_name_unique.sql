-- entities_name_unique (sql/28_add_entities.sql) is an exact-string unique
-- constraint, so "SS LOGISTICS - SUKANYA" and "SS LOGISTICS -SUKANYA" (or
-- "SSLOGISTICS-DEEKSHITH" with no spaces at all) are different bytes to
-- Postgres and both insert cleanly, producing duplicate rows for what is
-- really the same firm/person. Add a second, whitespace/case-insensitive
-- unique index that catches those near-duplicates too. The app-side create
-- paths (POST /api/entities, POST /api/vehicle-owners) already treat any
-- 23505 on this table as "already exists", so no route changes are needed
-- for this index to take effect — it's paired with an explicit pre-check in
-- both routes for a friendlier message naming the conflicting row.
--
-- Run this manually in the Supabase SQL editor, after any existing
-- near-duplicate rows have been merged/deleted (it will fail to create if
-- duplicates remain).

create unique index if not exists entities_normalized_name_unique
  on entities (lower(regexp_replace(name, '\s+', '', 'g')));

-- ---------------------------------------------------------------------
-- DOWN (manual rollback)
-- ---------------------------------------------------------------------
-- drop index if exists entities_normalized_name_unique;
