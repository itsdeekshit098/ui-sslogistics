-- Individuals owe us money too — overdue rent on a hired vehicle, or a plain
-- interest-free advance. That is the same running-account shape the clients
-- ledger already models, so this widens clients rather than adding a module.
--
-- (Money lent WITH interest is not this — it's a LENT funding, sql/35.)
--
-- An individual must BE someone in the entities master, so the same person can
-- also appear as a LENT funding counterparty, a vehicle owner or a bank account
-- holder. Companies may stay free-text for now; existing rows have no entity
-- and keep working untouched.
--
-- Run this in the Supabase SQL editor. Reversible manually via the DOWN
-- section at the bottom (commented out).

alter table clients add column if not exists party_kind text not null
  default 'COMPANY';
alter table clients add column if not exists entity_id bigint
  references entities(id);

alter table clients add constraint clients_party_kind_check
  check (party_kind in ('COMPANY', 'INDIVIDUAL'));
alter table clients add constraint clients_individual_needs_entity
  check (party_kind <> 'INDIVIDUAL' or entity_id is not null);

-- One entity cannot be two client accounts.
create unique index if not exists uq_clients_entity
  on clients (entity_id) where entity_id is not null;

-- ---------------------------------------------------------------------
-- Keep clients.name mirrored from the FK, exactly as vehicles.owner_name is
-- mirrored in sql/28. clients.name stays the searched + unique column, so it
-- must never go stale when an entity is renamed.
-- ---------------------------------------------------------------------

create or replace function sync_client_name_mirror()
returns trigger
language plpgsql
as $$
declare
  v_name text;
begin
  if new.entity_id is null then
    return new;
  end if;

  select e.name into v_name from entities e where e.id = new.entity_id;

  if v_name is null then
    raise exception 'Unknown entity %', new.entity_id
      using errcode = 'foreign_key_violation';
  end if;

  new.name := v_name;
  return new;
end;
$$;

drop trigger if exists trg_clients_name_mirror on clients;
create trigger trg_clients_name_mirror
  before insert or update of entity_id on clients
  for each row
  execute function sync_client_name_mirror();

create or replace function cascade_entity_rename_to_clients()
returns trigger
language plpgsql
as $$
begin
  if new.name is distinct from old.name then
    update clients set name = new.name, updated_at = now()
    where entity_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_entities_cascade_rename_clients on entities;
create trigger trg_entities_cascade_rename_clients
  after update of name on entities
  for each row
  execute function cascade_entity_rename_to_clients();

-- ---------------------------------------------------------------------
-- DOWN (manual rollback — uncomment to run)
-- ---------------------------------------------------------------------
-- drop trigger if exists trg_entities_cascade_rename_clients on entities;
-- drop trigger if exists trg_clients_name_mirror on clients;
-- drop function if exists cascade_entity_rename_to_clients();
-- drop function if exists sync_client_name_mirror();
-- drop index if exists uq_clients_entity;
-- alter table clients drop constraint if exists clients_individual_needs_entity;
-- alter table clients drop constraint if exists clients_party_kind_check;
-- alter table clients drop column if exists entity_id;
-- alter table clients drop column if exists party_kind;
