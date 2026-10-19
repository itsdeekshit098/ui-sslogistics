-- Two additions driven by real variation across drivers:
--
--   1. HOLIDAY as a fourth attendance status, alongside PRESENT / ABSENT /
--      LEAVE. A holiday is a day the driver didn't work (no shifts, like
--      Absent/Leave) but — unlike Absent/Leave — is still a PAID day. Some of
--      our drivers serve a company that's closed on a given date; others
--      serve a company that isn't, so holidays are marked per driver per
--      day, not as one shared calendar.
--
--   2. driver_pay_types: some drivers are paid a fixed MONTHLY salary (the
--      existing rule — see sql/47), others are paid PER_TRIP, a rate per
--      trip times however many trips they ran that month (entered by hand,
--      see driver_trip_counts below — these are not auto-derived from
--      external_trips/trip_bookings, which don't reliably cover every
--      trip-paid driver's work). Exactly one pay type per driver, dated like
--      a salary rate or shift count so switching a driver's pay type doesn't
--      rewrite how past months were paid.
--
-- Run this in the Supabase SQL editor. Reversible manually via the DOWN
-- section at the bottom (commented out).

-- ---------------------------------------------------------------------
-- 1. HOLIDAY status, and PRESENT-with-no-shifts for PER_TRIP drivers
-- ---------------------------------------------------------------------

-- The existing CHECK only allowed PRESENT/ABSENT/LEAVE. Widening it is safe:
-- every existing row keeps its current status untouched.
alter table driver_attendance
  drop constraint if exists driver_attendance_status_check;

alter table driver_attendance
  add constraint driver_attendance_status_check
    check (status in ('PRESENT', 'ABSENT', 'LEAVE', 'HOLIDAY'));

-- The sibling shifts-check constraint originally required
-- (status = 'PRESENT') = (shift_a or shift_b or shift_c) — PRESENT meant
-- exactly "has at least one shift". A PER_TRIP driver has no shifts to pick
-- at all (their pay comes from a trip count, not which shift they drove), so
-- their attendance screen offers Present/Absent/Leave/Holiday with no shift
-- buttons, and a "Present" mark for them has to be storable with all three
-- shift flags false.
--
-- Loosened to: ABSENT/LEAVE/HOLIDAY still rule out every shift (unchanged —
-- a driver cannot be off and also marked as driving a shift), but PRESENT no
-- longer requires at least one shift. Which drivers actually use a
-- shift-less PRESENT is an application-layer rule (parseMark, keyed off the
-- driver's pay type), not something the table itself can know — the table
-- only needs to allow the shape, not decide when it's correct.
alter table driver_attendance
  drop constraint if exists driver_attendance_shifts_check;

alter table driver_attendance
  add constraint driver_attendance_shifts_check
    check (
      status in ('ABSENT', 'LEAVE', 'HOLIDAY')
      and not (shift_a or shift_b or shift_c)
      or status = 'PRESENT'
    );

-- ---------------------------------------------------------------------
-- 2. Pay type per driver, dated
-- ---------------------------------------------------------------------

-- Same shape and reasoning as driver_shift_counts (sql/48): a column on
-- drivers would be overwritten the moment someone's pay model changes,
-- silently reinterpreting every past month. A dated row means a switch
-- takes effect from a month forward, and the type for a given month is the
-- latest row on or before it. Drivers with no row are MONTHLY (today's only
-- pay model), so an untouched database behaves exactly as before this file.
create table if not exists driver_pay_types (
  id              bigint generated always as identity primary key,
  driver_id       bigint not null references drivers(id),
  pay_type        text not null,
  -- Only meaningful (and required) when pay_type = 'PER_TRIP'. Null for
  -- MONTHLY rows — the monthly figure itself still lives in
  -- driver_salary_rates, unchanged, exactly as it does today.
  rate_per_trip   numeric,
  effective_from  date not null,
  note            text,
  created_by      uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint driver_pay_types_type_check
    check (pay_type in ('MONTHLY', 'PER_TRIP')),
  constraint driver_pay_types_rate_check
    check (
      (pay_type = 'PER_TRIP' and rate_per_trip is not null and rate_per_trip > 0)
      or (pay_type = 'MONTHLY' and rate_per_trip is null)
    ),
  constraint driver_pay_types_month_start_check
    check (extract(day from effective_from) = 1),
  constraint driver_pay_types_unique unique (driver_id, effective_from)
);

create index if not exists idx_driver_pay_types_driver
  on driver_pay_types (driver_id, effective_from desc);

-- ---------------------------------------------------------------------
-- 3. Trips run, for PER_TRIP drivers — entered by hand, one row per month
-- ---------------------------------------------------------------------

-- Deliberately a single editable count per driver per month, not an
-- append-only ledger like driver_salary_entries: a trip count is a fact
-- about the month ("this driver ran 42 trips in October"), corrected in
-- place like a salary rate or shift count, not a running list of individual
-- trip events. Saving again for the same month corrects the figure (a typo,
-- or trips added as the month goes on) rather than stacking rows.
create table if not exists driver_trip_counts (
  id            bigint generated always as identity primary key,
  driver_id     bigint not null references drivers(id),
  -- Always the 1st of the month this count is for.
  period_month  date not null,
  trip_count    integer not null,
  note          text,
  created_by    uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint driver_trip_counts_count_check check (trip_count >= 0),
  constraint driver_trip_counts_month_start_check
    check (extract(day from period_month) = 1),
  constraint driver_trip_counts_unique unique (driver_id, period_month)
);

create index if not exists idx_driver_trip_counts_driver
  on driver_trip_counts (driver_id, period_month desc);

alter table driver_pay_types enable row level security;
alter table driver_trip_counts enable row level security;
-- No policies — service-role access only (see docs/supabase-security.md).
-- Every role may read a driver's pay type through the salary/attendance
-- routes (a trip-based driver's attendance screen has no shift buttons, so
-- the client needs to know); only admins may change pay type or trip count,
-- matching the strict-admin rule on the rest of the salary module.

-- ---------------------------------------------------------------------
-- DOWN (manual rollback — uncomment to run)
-- ---------------------------------------------------------------------
-- Only safe once no row actually uses HOLIDAY or a shift-less PRESENT.
-- alter table driver_attendance drop constraint if exists driver_attendance_shifts_check;
-- alter table driver_attendance
--   add constraint driver_attendance_shifts_check
--     check ((status = 'PRESENT') = (shift_a or shift_b or shift_c));
-- alter table driver_attendance drop constraint if exists driver_attendance_status_check;
-- alter table driver_attendance
--   add constraint driver_attendance_status_check
--     check (status in ('PRESENT', 'ABSENT', 'LEAVE'));
-- drop table if exists driver_trip_counts;
-- drop table if exists driver_pay_types;
