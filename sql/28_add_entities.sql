-- Introduces `entities`: one master list of every party the business acts as
-- or deals with — the family proprietorships (SRI SRINIVASA - KRREDDY,
-- SS LOGISTICS - DEEKSHITH, SS LOGISTICS - SUKANYA), the individuals behind
-- them, and external parties whose vehicles we run. Loans and private
-- fundings hang off this table (a loan is always "in whose name"), and it
-- absorbs `vehicle_owners`, which held the same real-world things in a
-- weaker shape (name + OWN/EXTERNAL only).
--
-- Why the merge: today `vehicles.owner_name` / `owner_type` are denormalized
-- TEXT copies with no foreign key (see 17_add_vehicle_owner.sql), so a rename
-- has to be cascaded by hand through the `rename_vehicle_owner` plpgsql
-- function (25_atomic_vehicle_owner_rename.sql) and a typo silently orphans
-- vehicles. Here `vehicles.owner_entity_id` becomes the real FK and source of
-- truth, while owner_name/owner_type stay as trigger-maintained mirrors so the
-- existing vehicles API response, the get_vehicles_summary RPC filters, the
-- vehicle filter UI and the Flutter app keep working untouched.
--
-- Run this in the Supabase SQL editor. Reversible manually via the DOWN
-- section at the bottom (commented out).

-- ---------------------------------------------------------------------
-- 1. The master table
-- ---------------------------------------------------------------------

create table if not exists entities (
  id                   bigint generated always as identity primary key,
  name                 text not null,
  entity_kind          text not null,
  relationship         text not null default 'INTERNAL',
  -- A firm is a proprietorship: this points at the PERSON row who owns it,
  -- e.g. 'SRI SRINIVASA - KRREDDY' -> 'Rama Krishna Reddy'.
  proprietor_entity_id bigint references entities(id),
  phone                text,
  email                text,
  pan                  text,
  gst_number           text,
  address              text,
  notes                text,
  is_active            boolean not null default true,
  created_by           uuid,
  updated_by           uuid,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint entities_name_unique unique (name),
  constraint entities_entity_kind_check
    check (entity_kind in ('FIRM', 'PERSON')),
  -- INTERNAL = ours (our firms and family). EXTERNAL = third parties, e.g.
  -- someone whose vehicle we run. Carries the old owner_type meaning:
  -- OWN -> INTERNAL, EXTERNAL -> EXTERNAL.
  constraint entities_relationship_check
    check (relationship in ('INTERNAL', 'EXTERNAL')),
  constraint entities_phone_check
    check (phone is null or phone ~ '^[6-9][0-9]{9}$'),
  -- Only a FIRM can have a proprietor, and it can't be its own.
  constraint entities_proprietor_check
    check (proprietor_entity_id is null or entity_kind = 'FIRM'),
  constraint entities_proprietor_not_self
    check (proprietor_entity_id is null or proprietor_entity_id <> id)
);

create index if not exists idx_entities_kind on entities (entity_kind);
create index if not exists idx_entities_relationship on entities (relationship);
create index if not exists idx_entities_proprietor on entities (proprietor_entity_id);

alter table entities enable row level security;
-- No policies added — this app talks to Supabase exclusively via the
-- service-role key from Next.js API routes (see docs/supabase-security.md),
-- so RLS here defaults to deny-all for anon/authenticated clients.

-- ---------------------------------------------------------------------
-- 2. Backfill from vehicle_owners
-- ---------------------------------------------------------------------
-- Every existing owner becomes an entity. entity_kind can't be inferred from
-- a bare name, so everything lands as 'FIRM' — the user re-tags the
-- individuals as 'PERSON' from the Firms & Owners page afterwards.

insert into entities (name, entity_kind, relationship, created_at)
select
  vo.name,
  'FIRM',
  case vo.owner_type when 'OWN' then 'INTERNAL' else 'EXTERNAL' end,
  vo.created_at
from vehicle_owners vo
on conflict (name) do nothing;

-- ---------------------------------------------------------------------
-- 3. Seed the family entities
-- ---------------------------------------------------------------------
-- Persons first, then the firms that point at them. `on conflict do nothing`
-- so this is safe when a name already arrived via the backfill above.

insert into entities (name, entity_kind, relationship) values
  ('Rama Krishna Reddy', 'PERSON', 'INTERNAL'),
  ('Deekshith Reddy',    'PERSON', 'INTERNAL'),
  ('Sukanya',            'PERSON', 'INTERNAL')
on conflict (name) do nothing;

insert into entities (name, entity_kind, relationship, proprietor_entity_id) values
  ('SRI SRINIVASA - KRREDDY',  'FIRM', 'INTERNAL',
    (select id from entities where name = 'Rama Krishna Reddy')),
  ('SS LOGISTICS - DEEKSHITH', 'FIRM', 'INTERNAL',
    (select id from entities where name = 'Deekshith Reddy')),
  ('SS LOGISTICS - SUKANYA',   'FIRM', 'INTERNAL',
    (select id from entities where name = 'Sukanya'))
on conflict (name) do nothing;

-- ---------------------------------------------------------------------
-- 4. Point vehicles at entities
-- ---------------------------------------------------------------------

alter table vehicles
  add column if not exists owner_entity_id bigint references entities(id);

create index if not exists idx_vehicles_owner_entity_id
  on vehicles (owner_entity_id);

update vehicles v
set owner_entity_id = e.id
from entities e
where v.owner_name is not null
  and v.owner_entity_id is null
  and e.name = v.owner_name;

-- ---------------------------------------------------------------------
-- 5. Keep owner_name / owner_type mirrored from the FK
-- ---------------------------------------------------------------------
-- owner_entity_id is the source of truth. These two triggers keep the legacy
-- text columns in step so every existing reader (vehicles API, the
-- get_vehicles_summary RPC's owner filters, the web filter drawer, the Flutter
-- app) keeps working without a single change.

create or replace function sync_vehicle_owner_mirror()
returns trigger
language plpgsql
as $$
declare
  v_name text;
  v_relationship text;
begin
  -- Legacy rows with no entity keep whatever they already have.
  if new.owner_entity_id is null then
    return new;
  end if;

  select e.name, e.relationship
    into v_name, v_relationship
  from entities e
  where e.id = new.owner_entity_id;

  if v_name is null then
    raise exception 'Unknown owner entity %', new.owner_entity_id
      using errcode = 'foreign_key_violation';
  end if;

  new.owner_name := v_name;
  new.owner_type := case v_relationship when 'INTERNAL' then 'OWN' else 'EXTERNAL' end;

  return new;
end;
$$;

drop trigger if exists trg_vehicles_owner_mirror on vehicles;
create trigger trg_vehicles_owner_mirror
  before insert or update of owner_entity_id on vehicles
  for each row
  execute function sync_vehicle_owner_mirror();

-- Renaming an entity (or flipping it internal/external) cascades to every
-- vehicle that references it. This is what rename_vehicle_owner used to do
-- by hand, now automatic and atomic by virtue of being in the same statement.
create or replace function cascade_entity_rename_to_vehicles()
returns trigger
language plpgsql
as $$
begin
  if new.name is distinct from old.name
     or new.relationship is distinct from old.relationship then
    update vehicles
      set owner_name = new.name,
          owner_type = case new.relationship when 'INTERNAL' then 'OWN' else 'EXTERNAL' end
      where owner_entity_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_entities_cascade_rename on entities;
create trigger trg_entities_cascade_rename
  after update of name, relationship on entities
  for each row
  execute function cascade_entity_rename_to_vehicles();

-- ---------------------------------------------------------------------
-- 6. Retire the old shape
-- ---------------------------------------------------------------------
-- The RPC is superseded by trg_entities_cascade_rename above, and
-- vehicle_owners by entities. /api/vehicle-owners survives as a thin adapter
-- over entities so the Flutter owners screen keeps its contract.

drop function if exists rename_vehicle_owner(bigint, text, text);
drop table if exists vehicle_owners;

-- ---------------------------------------------------------------------
-- DOWN (manual rollback — uncomment to run)
-- ---------------------------------------------------------------------
-- drop trigger if exists trg_entities_cascade_rename on entities;
-- drop trigger if exists trg_vehicles_owner_mirror on vehicles;
-- drop function if exists cascade_entity_rename_to_vehicles();
-- drop function if exists sync_vehicle_owner_mirror();
--
-- create table if not exists vehicle_owners (
--   id bigint generated always as identity primary key,
--   name text not null,
--   owner_type text not null check (owner_type in ('OWN', 'EXTERNAL')),
--   created_at timestamptz not null default now(),
--   constraint vehicle_owners_name_unique unique (name)
-- );
-- alter table vehicle_owners enable row level security;
-- insert into vehicle_owners (name, owner_type, created_at)
-- select e.name,
--        case e.relationship when 'INTERNAL' then 'OWN' else 'EXTERNAL' end,
--        e.created_at
-- from entities e
-- on conflict (name) do nothing;
--
-- alter table vehicles drop column if exists owner_entity_id;
-- drop table if exists entities;
-- (then re-run sql/25_atomic_vehicle_owner_rename.sql to restore the RPC)
