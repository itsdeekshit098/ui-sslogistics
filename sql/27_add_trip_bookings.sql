-- Adds the trip_bookings table: advance bookings taken over the phone for
-- external trips (bus/tempo/car hire, from a customer, for a future date),
-- recorded before actual costs are known. On completion a booking becomes
-- a normal external_trips row (see /api/external-trips `booking_id`
-- support) where the actual cost_items/amount_received get entered.
--
-- Run this in the Supabase SQL editor. Reversible manually via the DOWN
-- section at the bottom (commented out).

create table if not exists trip_bookings (
  id                bigint generated always as identity primary key,
  customer_name     text not null,
  customer_phone    text,
  from_location     text not null,
  to_location       text not null,
  start_date        date not null,
  end_date          date,
  vehicle_type      vehicle_type_enum not null,
  seating_capacity  integer,
  vehicle_id        bigint references vehicles(id),
  driver_id         bigint references drivers(id),
  status            text not null default 'confirmed',
  quoted_amount     numeric,
  advance_amount    numeric not null default 0,
  notes             text,
  external_trip_id  bigint references external_trips(id),
  created_by        uuid,
  updated_by        uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint trip_bookings_status_check
    check (status in ('confirmed', 'completed', 'cancelled')),
  constraint trip_bookings_end_date_check
    check (end_date is null or end_date >= start_date),
  constraint trip_bookings_seating_capacity_check
    check (seating_capacity is null or seating_capacity > 0),
  constraint trip_bookings_quoted_amount_check
    check (quoted_amount is null or quoted_amount >= 0),
  constraint trip_bookings_advance_amount_check
    check (advance_amount >= 0)
);

create index if not exists idx_trip_bookings_status_start
  on trip_bookings (status, start_date);
create index if not exists idx_trip_bookings_start_date
  on trip_bookings (start_date);
create index if not exists idx_trip_bookings_vehicle_id
  on trip_bookings (vehicle_id);
create index if not exists idx_trip_bookings_driver_id
  on trip_bookings (driver_id);

alter table trip_bookings enable row level security;
-- No policies added — this app talks to Supabase exclusively via the
-- service-role key from Next.js API routes, so RLS here defaults to
-- deny-all for anon/authenticated clients (same as external_trips /
-- notifications).

-- ---------------------------------------------------------------------
-- DOWN (manual rollback)
-- ---------------------------------------------------------------------
-- drop table if exists trip_bookings;
