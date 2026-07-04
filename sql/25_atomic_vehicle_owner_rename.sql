-- Renaming a vehicle owner must update vehicle_owners AND cascade the new
-- name/type onto every vehicles row that references it (owner_name/owner_type
-- are denormalized text copies, not an FK — see 17_add_vehicle_owner.sql).
-- Doing this as two separate JS calls from the API route left a window where
-- the owner row could be renamed while the vehicles cascade failed, leaving
-- the two out of sync with no rollback. Wrapping both writes in a single
-- plpgsql function makes them atomic (one statement = one transaction).
--
-- Run this in the Supabase SQL editor.

create or replace function rename_vehicle_owner(
  p_id bigint,
  p_name text,
  p_owner_type text
)
returns table (id bigint, name text, owner_type text, created_at timestamptz)
language plpgsql
as $$
declare
  v_old_name text;
begin
  select vo.name into v_old_name from vehicle_owners vo where vo.id = p_id;

  if v_old_name is null then
    raise exception 'Owner not found' using errcode = 'P0002';
  end if;

  update vehicle_owners
    set name = p_name, owner_type = p_owner_type
    where vehicle_owners.id = p_id;

  if v_old_name is distinct from p_name or p_owner_type is not null then
    update vehicles
      set owner_name = p_name, owner_type = p_owner_type
      where vehicles.owner_name = v_old_name;
  end if;

  return query
    select vo.id, vo.name, vo.owner_type, vo.created_at
    from vehicle_owners vo
    where vo.id = p_id;
end;
$$;

-- ---------------------------------------------------------------------
-- DOWN (manual rollback — uncomment to run)
-- ---------------------------------------------------------------------
-- drop function if exists rename_vehicle_owner(bigint, text, text);
