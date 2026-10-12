-- Driver salaries, worked out from attendance.
--
-- A driver is on a fixed monthly salary. A month's pay is that salary, less a
-- day's pay for every day marked Absent or Leave in driver_attendance, less
-- any advances and other deductions recorded against that month.
--
-- Nothing here stores a salary *figure for a month*. As with the loans,
-- fundings and client modules, the amount payable is derived on every request
-- (src/app/api/driver-salaries/driver-salaries.utils.ts) from three inputs:
--
--   driver_salary_rates    — what the monthly salary is, and from which month
--   driver_attendance      — which days were absent / on leave (sql/45)
--   driver_salary_entries  — advances and deductions, append-only
--
-- so correcting an attendance mark or reversing an advance changes the sheet
-- immediately, and there is no stored total to drift out of step with it.
--
-- Run this in the Supabase SQL editor. Reversible manually via the DOWN
-- section at the bottom (commented out).

-- ---------------------------------------------------------------------
-- 1. The monthly salary, with history
-- ---------------------------------------------------------------------

-- A salary changes over the years, and last year's sheet must keep showing
-- last year's salary. So a raise is a new row taking effect from a month, not
-- an edit: the salary for a given month is the latest row whose
-- effective_from is on or before that month.
--
-- effective_from is always the 1st of a month. A salary is a monthly figure;
-- a mid-month change has no single answer for that month's pay, so a change
-- applies from a whole month.
create table if not exists driver_salary_rates (
  id              bigint generated always as identity primary key,
  driver_id       bigint not null references drivers(id),
  monthly_salary  numeric not null,
  effective_from  date not null,
  note            text,
  created_by      uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint driver_salary_rates_amount_check check (monthly_salary >= 0),
  constraint driver_salary_rates_month_start_check
    check (extract(day from effective_from) = 1),
  -- One salary per driver per starting month. Saving again for the same
  -- month corrects that row in place (a typo fix, not a raise); the change is
  -- recorded in activity_log.
  constraint driver_salary_rates_unique unique (driver_id, effective_from)
);

-- ---------------------------------------------------------------------
-- 2. Advances and other deductions (append-only)
-- ---------------------------------------------------------------------

create table if not exists driver_salary_entries (
  id                bigint generated always as identity primary key,
  driver_id         bigint not null references drivers(id),
  -- ADVANCE   — money already handed to the driver against this month's pay
  -- DEDUCTION — any other cut: damages, a fine, a recovered loss
  -- Both reduce what is payable; they are kept apart only because the sheet
  -- reports them in separate columns.
  entry_type        text not null,
  amount            numeric not null,
  -- When the money changed hands or the cut was decided.
  entry_date        date not null default current_date,
  -- Which salary month it comes out of, as the 1st of that month. Usually the
  -- month of entry_date, but an advance handed over on the 2nd against last
  -- month's pay belongs to last month's sheet.
  period_month      date not null,
  description       text,
  -- A mistake is corrected by a second row pointing at the first, never by
  -- editing or deleting. Both rows then drop out of the totals, so the pair
  -- nets to zero and the history of what was entered stays readable.
  reverses_entry_id bigint references driver_salary_entries(id),
  created_by        uuid,
  created_at        timestamptz not null default now(),

  constraint driver_salary_entries_type_check
    check (entry_type in ('ADVANCE', 'DEDUCTION')),
  constraint driver_salary_entries_amount_check check (amount > 0),
  constraint driver_salary_entries_period_check
    check (extract(day from period_month) = 1)
);

-- An entry can be reversed at most once; a second attempt hits this and
-- surfaces as a 409 rather than double-correcting the sheet.
create unique index if not exists uq_driver_salary_entries_reverses
  on driver_salary_entries (reverses_entry_id)
  where reverses_entry_id is not null;

-- The sheet reads every driver's entries for one month.
create index if not exists idx_driver_salary_entries_period
  on driver_salary_entries (period_month, driver_id);

alter table driver_salary_rates enable row level security;
alter table driver_salary_entries enable row level security;
-- No policies — service-role access only (see docs/supabase-security.md).
-- The API routes additionally gate every method, GET included, behind
-- requireStrictAdminAuth(): what each driver is paid is as sensitive as the
-- loans.

-- ---------------------------------------------------------------------
-- DOWN (manual rollback — uncomment to run)
-- ---------------------------------------------------------------------
-- drop table if exists driver_salary_entries;
-- drop table if exists driver_salary_rates;
