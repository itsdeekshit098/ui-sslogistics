-- Makes trip_bookings the unified record for the planned and completed
-- lifecycle of a customer trip. Existing external_trips are retained during
-- the application migration; linked completed bookings are backfilled first.
--
-- Run this manually in the Supabase SQL editor.

alter table trip_bookings
  add column if not exists trip_type text,
  add column if not exists cost_items jsonb,
  add column if not exists total_cost numeric,
  add column if not exists amount_received numeric,
  add column if not exists completed_at timestamptz;

-- Copy the final operational and financial values already held by legacy
-- external trip records into their completed booking.
update trip_bookings as booking
set
  trip_type = trip.trip_type,
  cost_items = trip.cost_items,
  total_cost = trip.total_cost,
  amount_received = trip.amount_received,
  completed_at = trip.created_at
from external_trips as trip
where booking.external_trip_id = trip.id
  and booking.status = 'completed';

alter table trip_bookings
  drop constraint if exists trip_bookings_trip_type_check,
  drop constraint if exists trip_bookings_total_cost_check,
  drop constraint if exists trip_bookings_amount_received_check,
  drop constraint if exists trip_bookings_completed_financials_check;

alter table trip_bookings
  add constraint trip_bookings_trip_type_check
    check (trip_type is null or trip_type in ('company_oncall', 'external_user')),
  add constraint trip_bookings_total_cost_check
    check (total_cost is null or total_cost >= 0),
  add constraint trip_bookings_amount_received_check
    check (amount_received is null or amount_received >= 0),
  add constraint trip_bookings_completed_financials_check
    check (
      status <> 'completed'
      or (
        trip_type is not null
        and cost_items is not null
        and total_cost is not null
        and amount_received is not null
        and completed_at is not null
      )
    );

create index if not exists idx_trip_bookings_completed_at
  on trip_bookings (completed_at desc)
  where status = 'completed';

-- ---------------------------------------------------------------------
-- DOWN (manual rollback; do not run until legacy external trip data has
-- been safely retained elsewhere)
-- ---------------------------------------------------------------------
-- alter table trip_bookings
--   drop constraint if exists trip_bookings_trip_type_check,
--   drop constraint if exists trip_bookings_total_cost_check,
--   drop constraint if exists trip_bookings_amount_received_check,
--   drop constraint if exists trip_bookings_completed_financials_check,
--   drop column if exists completed_at,
--   drop column if exists amount_received,
--   drop column if exists total_cost,
--   drop column if exists cost_items,
--   drop column if exists trip_type;