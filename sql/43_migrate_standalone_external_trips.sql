-- Migrates standalone external_trips rows (never linked to a trip_bookings
-- row — i.e. entered directly under the old "External Trips" feature, not
-- via the "Complete Booking" flow) forward into trip_bookings as completed
-- bookings, matching the precedent set by 40_unify_trip_bookings.sql for
-- linked rows. Once verified, this lets the external_trips table/feature be
-- retired without losing data.
--
-- trip_bookings.customer_name / from_location / to_location / start_date
-- are NOT NULL, but were optional on the old standalone-trip form, so a
-- literal fallback is used for any row missing them. vehicle_type and
-- seating_capacity don't exist on external_trips at all and are pulled from
-- vehicles via vehicle_id — a row whose vehicle_id has no match in vehicles
-- has no safe value for the NOT NULL vehicle_type column and is skipped by
-- the inner join (see preflight check below).
--
-- Run this manually in the Supabase SQL editor. Run the preflight check
-- first and confirm the "skipped" count is 0 (or an expected/acceptable
-- number) before running the INSERT.

-- ---------------------------------------------------------------------
-- PREFLIGHT: rows that will be skipped because their vehicle_id has no
-- match in vehicles (would violate trip_bookings.vehicle_type NOT NULL).
-- Review these manually if the count is non-zero.
-- ---------------------------------------------------------------------
select t.id, t.vehicle_id, t.customer_name, t.created_at
from external_trips t
where not exists (
  select 1 from trip_bookings b where b.external_trip_id = t.id
)
and not exists (
  select 1 from vehicles v where v.id = t.vehicle_id
);

-- ---------------------------------------------------------------------
-- MIGRATE
-- ---------------------------------------------------------------------
insert into trip_bookings (
  customer_name,
  customer_phone,
  from_location,
  to_location,
  start_date,
  end_date,
  vehicle_type,
  seating_capacity,
  vehicle_id,
  driver_id,
  status,
  quoted_amount,
  advance_amount,
  notes,
  external_trip_id,
  trip_type,
  cost_items,
  total_cost,
  amount_received,
  completed_at,
  created_by,
  updated_by,
  created_at,
  updated_at
)
select
  coalesce(nullif(trim(t.customer_name), ''), 'Unknown customer'),
  t.customer_phone,
  coalesce(nullif(trim(t.from_location), ''), 'Unknown'),
  coalesce(nullif(trim(t.to_location), ''), 'Unknown'),
  coalesce(t.start_date, t.created_at::date),
  t.end_date,
  v.vehicle_type,
  v.seating_capacity,
  t.vehicle_id,
  t.driver_id,
  'completed',
  null,   -- quoted_amount: no concept of a quote on a standalone external trip
  0,      -- advance_amount: same — no advance was ever taken
  t.notes,
  t.id,   -- external_trip_id: keep the link back for traceability
  t.trip_type,
  t.cost_items,
  t.total_cost,
  t.amount_received,
  t.created_at,  -- completed_at — same precedent as 40_unify_trip_bookings.sql:22
  t.created_by,
  t.updated_by,
  t.created_at,
  t.updated_at
from external_trips t
join vehicles v on v.id = t.vehicle_id
where not exists (
  select 1 from trip_bookings b where b.external_trip_id = t.id
);

-- ---------------------------------------------------------------------
-- VERIFY: should return 0 once every eligible row has been migrated
-- (any remaining count should match the preflight "skipped" count above).
-- ---------------------------------------------------------------------
select count(*) as still_orphaned
from external_trips t
where not exists (
  select 1 from trip_bookings b where b.external_trip_id = t.id
);

-- ---------------------------------------------------------------------
-- NEXT STEP (do not run yet — separate, deliberate action after you've
-- eyeballed the migrated rows in the Trip Bookings UI/table):
--
-- trip_bookings.external_trip_id is a hard FK to external_trips(id), so the
-- table can't be dropped until that's resolved. Once confirmed correct:
--
--   alter table trip_bookings drop constraint trip_bookings_external_trip_id_fkey;
--   drop table external_trips;
--
-- (constraint name may differ — check with:
--   select conname from pg_constraint where conrelid = 'trip_bookings'::regclass
--     and confrelid = 'external_trips'::regclass;
-- )
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- DOWN (manual rollback; only safe before external_trips is dropped —
-- removes just the rows this migration inserted)
-- ---------------------------------------------------------------------
-- delete from trip_bookings b
-- using external_trips t
-- where b.external_trip_id = t.id
--   and b.created_at = t.created_at
--   and b.status = 'completed';
