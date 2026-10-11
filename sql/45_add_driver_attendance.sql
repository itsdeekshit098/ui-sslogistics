-- Daily driver attendance across the three shifts (A, B, C).
--
-- One row per driver per day, NOT one per shift: a driver's day is a single
-- fact — which of the three shifts they drove, or that they were absent or on
-- leave — and the screen marks it as one row. Three booleans keep "full day"
-- (all three), a double shift and a single shift in the same shape, and make
-- a contradictory day (absent AND drove shift B) impossible to store rather
-- than something every reader has to guard against.
--
-- "Not marked" is the absence of a row. Clearing a mark deletes the row, so
-- there is no fourth status to keep in sync with the three shift flags.
--
-- The shifts are columns rather than a lookup list because A/B/C is how the
-- operation itself is organised — the register, the wage count and the bulk
-- "full day" action all assume exactly these three. A fourth shift would be a
-- schema change either way.
--
-- Totals (shifts worked, absences, leave) are never stored: the month view
-- counts them from these rows on every request.
--
-- Run this in the Supabase SQL editor. Reversible manually via the DOWN
-- section at the bottom (commented out).

create table if not exists driver_attendance (
  id              bigint generated always as identity primary key,
  driver_id       bigint not null references drivers(id),
  attendance_date date not null,
  status          text not null,
  shift_a         boolean not null default false,
  shift_b         boolean not null default false,
  shift_c         boolean not null default false,
  -- Whoever saved this row last. Edits overwrite in place; the who/when of
  -- each save is in activity_log (MARK_DRIVER_ATTENDANCE).
  marked_by       uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint driver_attendance_unique unique (driver_id, attendance_date),
  constraint driver_attendance_status_check
    check (status in ('PRESENT', 'ABSENT', 'LEAVE')),
  -- Present means at least one shift; absent or leave means none.
  constraint driver_attendance_shifts_check
    check ((status = 'PRESENT') = (shift_a or shift_b or shift_c))
);

-- The day view reads one date across all drivers; the month view reads a date
-- range. The unique constraint above already covers per-driver lookups.
create index if not exists idx_driver_attendance_date
  on driver_attendance (attendance_date);

alter table driver_attendance enable row level security;
-- No policies — service-role access only (see docs/supabase-security.md).

-- ---------------------------------------------------------------------
-- DOWN (manual rollback — uncomment to run)
-- ---------------------------------------------------------------------
-- drop table if exists driver_attendance;
