-- Settling a month's salary, with any shortfall or overpayment carried
-- forward to the next month.
--
-- Today, a month's net pay (driver-salaries.utils.ts: computePay) can land
-- negative (advances outran what was earned) or simply differ from what the
-- owner actually handed the driver in cash. Nothing recorded that gap, so
-- next month's sheet started from zero even when money was still owed either
-- way.
--
-- driver_salary_settlements is the record of "this month was closed out, and
-- this is what was actually paid." It does not change how net_pay is
-- computed (driver-salaries.utils.ts is untouched) — it is a fact about one
-- month, written once money changes hands. The gap between what was owed and
-- what was paid becomes a normal driver_salary_entries row (ADVANCE if
-- overpaid, DEDUCTION if underpaid) dated into the *next* month, so the
-- existing pay rule picks it up automatically, the same way a manual advance
-- already does. No new money-derivation logic; one new fact table plus a
-- carry-forward entry through the ledger that already exists.
--
-- Run this in the Supabase SQL editor. Reversible manually via the DOWN
-- section at the bottom (commented out).

-- Tags a driver_salary_entries row as the carry-forward this settlement
-- produced, so the sheet can label it "carried from last month" instead of
-- it reading as a fresh advance/deduction. Nullable: ordinary entries never
-- set it.
alter table driver_salary_entries
  add column if not exists settlement_id bigint;

create table if not exists driver_salary_settlements (
  id                 bigint generated always as identity primary key,
  driver_id          bigint not null references drivers(id),
  -- The month being closed out, as the 1st of that month.
  period_month       date not null,
  -- net_pay as computed at the moment of settling — kept so the receipt
  -- shown later ("you owed X, paid Y") doesn't depend on recomputing the
  -- same figure from attendance/entries that may since have changed.
  net_pay_computed   numeric not null,
  amount_paid        numeric not null,
  note               text,
  -- The carry-forward entry this settlement created in
  -- driver_salary_entries, if amount_paid differed from net_pay_computed.
  -- Null when they matched exactly — nothing to carry.
  carry_forward_entry_id bigint references driver_salary_entries(id),
  created_by         uuid,
  created_at         timestamptz not null default now(),

  constraint driver_salary_settlements_amount_check check (amount_paid >= 0),
  constraint driver_salary_settlements_period_check
    check (extract(day from period_month) = 1),
  -- One settlement per driver per month. Undoing one means reversing its
  -- carry-forward entry (if any) and deleting this row, not stacking a
  -- second settlement on top — see the settle route.
  constraint driver_salary_settlements_unique unique (driver_id, period_month)
);

create index if not exists idx_driver_salary_settlements_period
  on driver_salary_settlements (period_month, driver_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'driver_salary_entries_settlement_fk'
  ) then
    alter table driver_salary_entries
      add constraint driver_salary_entries_settlement_fk
        foreign key (settlement_id) references driver_salary_settlements(id);
  end if;
end $$;

alter table driver_salary_settlements enable row level security;
-- No policies — service-role access only, same as the other salary tables.
-- requireStrictAdminAuth() on every method, GET included.

-- ---------------------------------------------------------------------
-- Settling and un-settling, as one transaction each
-- ---------------------------------------------------------------------

-- Settling a month writes up to three rows (the settlement, the
-- carry-forward entry, and the link back from the settlement to that
-- entry). Done as three separate API calls, a failure between the second
-- and third leaves a carry-forward entry nobody can trace or undo through
-- the UI, same bug class as save_driver_attendance (sql/46) existed to fix.
-- A plpgsql function body runs in one transaction, so this is all-or-nothing.
--
-- Returns the new settlement's id and, when a carry-forward was created,
-- that entry's id — the route uses these instead of chasing a second
-- select.
create or replace function settle_driver_salary(
  p_driver_id bigint,
  p_period_month date,
  p_net_pay_computed numeric,
  p_amount_paid numeric,
  p_note text,
  p_user uuid
)
returns table (settlement_id bigint, carry_forward_entry_id bigint)
language plpgsql
as $$
declare
  v_settlement_id bigint;
  v_entry_id bigint;
  v_gap numeric := p_amount_paid - p_net_pay_computed;
  v_next_month date := (p_period_month + interval '1 month')::date;
begin
  insert into driver_salary_settlements
    (driver_id, period_month, net_pay_computed, amount_paid, note, created_by)
  values
    (p_driver_id, p_period_month, p_net_pay_computed, p_amount_paid, p_note, p_user)
  returning id into v_settlement_id;

  if v_gap != 0 then
    insert into driver_salary_entries
      (driver_id, entry_type, amount, entry_date, period_month, description, settlement_id, created_by)
    values
      (
        p_driver_id,
        case when v_gap > 0 then 'ADVANCE' else 'DEDUCTION' end,
        abs(v_gap),
        current_date,
        v_next_month,
        case when v_gap > 0
          then format('Carried forward: overpaid for %s', to_char(p_period_month, 'YYYY-MM'))
          else format('Carried forward: underpaid for %s', to_char(p_period_month, 'YYYY-MM'))
        end,
        v_settlement_id,
        p_user
      )
    returning id into v_entry_id;

    update driver_salary_settlements
    set carry_forward_entry_id = v_entry_id
    where id = v_settlement_id;
  end if;

  return query select v_settlement_id, v_entry_id;
end;
$$;

-- Undoing a settlement reverses its carry-forward entry (if it made one),
-- clears that entry's settlement_id (it would otherwise still point at the
-- row this is about to delete, and the foreign key would reject the
-- delete), and removes the settlement row — again, one transaction so a
-- failure partway through can't leave the carry-forward reversed but the
-- settlement still showing as "paid", or the FK blocking the delete.
create or replace function unsettle_driver_salary(
  p_settlement_id bigint,
  p_driver_id bigint,
  p_user uuid
)
returns void
language plpgsql
as $$
declare
  v_entry_id bigint;
  v_entry_type text;
  v_amount numeric;
  v_period_month date;
  v_already_reversed bigint;
begin
  select carry_forward_entry_id into v_entry_id
  from driver_salary_settlements
  where id = p_settlement_id and driver_id = p_driver_id
  for update;

  if not found then
    raise exception 'Settlement % not found for driver %', p_settlement_id, p_driver_id;
  end if;

  if v_entry_id is not null then
    select entry_type, amount, period_month
    into v_entry_type, v_amount, v_period_month
    from driver_salary_entries
    where id = v_entry_id and reverses_entry_id is null;

    if found then
      select id into v_already_reversed
      from driver_salary_entries
      where reverses_entry_id = v_entry_id;

      if v_already_reversed is null then
        insert into driver_salary_entries
          (driver_id, entry_type, amount, entry_date, period_month, description, reverses_entry_id, created_by)
        values
          (
            p_driver_id,
            v_entry_type,
            v_amount,
            current_date,
            v_period_month,
            format('Reversal of #%s: settlement undone', v_entry_id),
            v_entry_id,
            p_user
          );
      end if;
    end if;

    update driver_salary_entries set settlement_id = null where id = v_entry_id;
  end if;

  delete from driver_salary_settlements where id = p_settlement_id;
end;
$$;

revoke all on function settle_driver_salary(bigint, date, numeric, numeric, text, uuid) from public, anon, authenticated;
grant execute on function settle_driver_salary(bigint, date, numeric, numeric, text, uuid) to service_role;
revoke all on function unsettle_driver_salary(bigint, bigint, uuid) from public, anon, authenticated;
grant execute on function unsettle_driver_salary(bigint, bigint, uuid) to service_role;

-- ---------------------------------------------------------------------
-- DOWN (manual rollback — uncomment to run)
-- ---------------------------------------------------------------------
-- drop function if exists settle_driver_salary(bigint, date, numeric, numeric, text, uuid);
-- drop function if exists unsettle_driver_salary(bigint, bigint, uuid);
-- alter table driver_salary_entries drop constraint if exists driver_salary_entries_settlement_fk;
-- alter table driver_salary_entries drop column if exists settlement_id;
-- drop table if exists driver_salary_settlements;
