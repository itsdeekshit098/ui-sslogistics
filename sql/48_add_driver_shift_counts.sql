-- How many shifts a driver works in a day.
--
-- Not every driver runs all three shifts. Some do one, some two, some all
-- three, and what counts as a *full day* — and so as full pay — is that
-- driver's own number, not a fixed three:
--
--   1 shift  → A           a full day is A
--   2 shifts → A, B        a full day is A + B
--   3 shifts → A, B, C     a full day is A + B + C
--
-- A driver on two shifts who works both is on a full day and loses nothing.
-- Pay is never pro-rated by shift count; the salary is monthly and only
-- Absent / Leave cut a day's pay (sql/47).
--
-- ---------------------------------------------------------------------
-- Why a table rather than a column on drivers
-- ---------------------------------------------------------------------
--
-- A driver moving from two shifts to three is a real event with a date, the
-- same as a raise. A plain drivers.shift_count would be overwritten by that
-- move, and every past month would then be re-read against the new number:
-- a day marked A+B back when the driver worked two shifts would start
-- reading as a part day, and last year's register and exports would change
-- behind you. So, exactly as driver_salary_rates does, a change is a new row
-- taking effect from a month, and the count for a given month is the latest
-- row whose effective_from is on or before that month.
--
-- Drivers with no row here work three shifts, so an untouched database
-- behaves exactly as it did before this file.
--
-- Run this in the Supabase SQL editor. Reversible manually via the DOWN
-- section at the bottom (commented out).

create table if not exists driver_shift_counts (
  id              bigint generated always as identity primary key,
  driver_id       bigint not null references drivers(id),
  -- 1, 2 or 3. Which shifts those are is fixed: the first N of A, B, C.
  shift_count     smallint not null,
  -- Always the 1st of a month: a mid-month change has no single answer for
  -- that month's register, so a change applies from a whole month.
  effective_from  date not null,
  note            text,
  created_by      uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint driver_shift_counts_range_check check (shift_count between 1 and 3),
  constraint driver_shift_counts_month_start_check
    check (extract(day from effective_from) = 1),
  -- One count per driver per starting month. Saving again for the same month
  -- corrects that row in place (a typo fix, not a change of duties); the
  -- change is recorded in activity_log.
  constraint driver_shift_counts_unique unique (driver_id, effective_from)
);

-- The register reads every driver's counts for one month.
create index if not exists idx_driver_shift_counts_driver
  on driver_shift_counts (driver_id, effective_from desc);

alter table driver_shift_counts enable row level security;
-- No policies — service-role access only (see docs/supabase-security.md).
-- Every role may read a driver's shift count through the attendance routes
-- (the marking screen has to know which buttons to show); only admins may
-- change it.

-- ---------------------------------------------------------------------
-- DOWN (manual rollback — uncomment to run)
-- ---------------------------------------------------------------------
-- drop table if exists driver_shift_counts;
