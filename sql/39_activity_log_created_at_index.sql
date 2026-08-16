-- `activity_log` is append-only and grows forever — every mutation across the
-- app writes a row. Two readers now scan it by time and neither had an index:
--
--   1. GET /api/activity-log orders the whole table by created_at desc on
--      every page load of the admin Activity Log page.
--   2. DELETE /api/activity-log (new, superadmin-only) counts and deletes
--      `created_at < cutoff` when clearing old entries.
--
-- Descending matches the read path's ORDER BY exactly; a range delete uses the
-- same index in either direction.
--
-- Note on reclaiming space: this DELETE marks rows dead for autovacuum to
-- reuse, it does not hand disk back to the OS. Purging keeps the table from
-- growing without bound; it will not visibly shrink the database.

create index if not exists idx_activity_log_created_at
  on activity_log (created_at desc);

-- ---------------------------------------------------------------------
-- DOWN (manual rollback — uncomment to run)
-- ---------------------------------------------------------------------
-- drop index if exists idx_activity_log_created_at;
