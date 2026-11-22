-- A vehicle's FC / insurance validity end date can't be before its start date.
--
-- The API already refuses this (route.ts: validateDocumentDates for a pair
-- sent together, validateDateOrderAgainstStored for one date sent alone, which
-- is how the web dialog and the mobile app save). Both are read-then-write
-- checks, so two saves landing together (web + mobile, or two tabs) can each
-- pass against the other's old value and store a reversed pair. A CHECK
-- constraint closes that: the database decides, atomically.
--
-- NOT VALID enforces the rule for every new insert and update without
-- scanning existing rows, so a legacy bad pair can't block this migration.
-- Note it also means an unrelated UPDATE of such a legacy row is checked and
-- refused until its dates are fixed — run the query below first and correct
-- anything it returns, then (optionally) VALIDATE.
--
-- select id, vehicle_number, fc_start_date, fc_end_date,
--        insurance_start_date, insurance_end_date
-- from vehicles
-- where fc_end_date < fc_start_date
--    or insurance_end_date < insurance_start_date;
--
-- Run this in the Supabase SQL editor. Reversible via the DOWN section at the
-- bottom (commented out).

alter table vehicles
  add constraint vehicles_fc_dates_order
  check (fc_start_date is null or fc_end_date is null or fc_end_date >= fc_start_date)
  not valid;

alter table vehicles
  add constraint vehicles_insurance_dates_order
  check (insurance_start_date is null or insurance_end_date is null or insurance_end_date >= insurance_start_date)
  not valid;

-- After the query above returns nothing:
-- alter table vehicles validate constraint vehicles_fc_dates_order;
-- alter table vehicles validate constraint vehicles_insurance_dates_order;

-- DOWN
-- alter table vehicles drop constraint if exists vehicles_fc_dates_order;
-- alter table vehicles drop constraint if exists vehicles_insurance_dates_order;
