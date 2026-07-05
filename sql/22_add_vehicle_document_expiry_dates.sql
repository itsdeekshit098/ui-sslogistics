-- Adds start/end date tracking for insurance and FC (fitness certificate)
-- documents on vehicles, so the daily expiry-check job can warn admin/staff
-- before they lapse. Deliberately scoped to just insurance + FC for now
-- (not permit/pollution/tax) — extend the same pattern later if needed.
--
-- Run this in the Supabase SQL editor. Reversible manually via the DOWN
-- section at the bottom (commented out).

alter table vehicles
  add column if not exists insurance_start_date date,
  add column if not exists insurance_end_date date,
  add column if not exists fc_start_date date,
  add column if not exists fc_end_date date;

-- ---------------------------------------------------------------------
-- DOWN (manual rollback)
-- ---------------------------------------------------------------------
-- alter table vehicles
--   drop column if exists insurance_start_date,
--   drop column if exists insurance_end_date,
--   drop column if exists fc_start_date,
--   drop column if exists fc_end_date;
