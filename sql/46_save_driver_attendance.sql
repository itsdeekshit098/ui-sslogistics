-- Saving a day's attendance writes two kinds of change: marks to store
-- (upsert) and marks to clear (delete). The API did these as two separate
-- calls, so a failure in the second left the first committed — the screen
-- reported "save failed" and kept every change as unsaved, while some of
-- them were already in the table and feeding the wage totals.
--
-- A plpgsql function body runs in one transaction, so doing both writes here
-- makes a save all-or-nothing: either every change for the day lands, or
-- none does.
--
-- p_entries is a JSON array of
--   { "driver_id": 12, "status": "PRESENT" | "ABSENT" | "LEAVE" | null,
--     "shift_a": true, "shift_b": false, "shift_c": true }
-- A null status clears that driver's mark for the date. Validation (role,
-- date not in the future, shifts vs status) stays in the API route; the
-- table's own check constraints are the backstop.
--
-- The route falls back to the old two-step path while this function does not
-- exist, so deploying the API before running this file breaks nothing.
--
-- Run this in the Supabase SQL editor. Reversible manually via the DOWN
-- section at the bottom (commented out).

create or replace function save_driver_attendance(
  p_date date,
  p_entries jsonb,
  p_user uuid
)
returns void
language plpgsql
as $$
begin
  delete from driver_attendance a
  using jsonb_to_recordset(p_entries) as e(driver_id bigint, status text)
  where a.attendance_date = p_date
    and a.driver_id = e.driver_id
    and e.status is null;

  insert into driver_attendance
    (driver_id, attendance_date, status, shift_a, shift_b, shift_c, marked_by, updated_at)
  select
    e.driver_id,
    p_date,
    e.status,
    coalesce(e.shift_a, false),
    coalesce(e.shift_b, false),
    coalesce(e.shift_c, false),
    p_user,
    now()
  from jsonb_to_recordset(p_entries)
    as e(driver_id bigint, status text, shift_a boolean, shift_b boolean, shift_c boolean)
  where e.status is not null
  on conflict (driver_id, attendance_date) do update
    set status     = excluded.status,
        shift_a    = excluded.shift_a,
        shift_b    = excluded.shift_b,
        shift_c    = excluded.shift_c,
        marked_by  = excluded.marked_by,
        updated_at = excluded.updated_at;
end;
$$;

-- Only the API's service-role client calls this; RLS on the table has no
-- policies, and nothing signed-in or anonymous should be able to reach it.
revoke all on function save_driver_attendance(date, jsonb, uuid) from public, anon, authenticated;
grant execute on function save_driver_attendance(date, jsonb, uuid) to service_role;

-- ---------------------------------------------------------------------
-- DOWN (manual rollback — uncomment to run)
-- ---------------------------------------------------------------------
-- drop function if exists save_driver_attendance(date, jsonb, uuid);
