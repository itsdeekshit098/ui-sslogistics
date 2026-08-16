-- Clients: the companies our vehicles run for, what they owe us, who to call
-- there, and which vehicles are deployed to them.
--
-- The receivables model is a running account, not invoice matching. Bills go on
-- as they're raised, payments come in irregularly — sometimes part of a bill,
-- sometimes extra to clear old dues — and service continues throughout. So the
-- ledger is a single append-only list of debits and credits, and what a client
-- owes is ALWAYS sum(debits) - sum(credits), never a stored column that could
-- drift out of step with the rows behind it.
--
-- Nothing is ever edited or deleted. A wrong entry is corrected by inserting an
-- opposite-direction adjustment that points at it; the pair nets to zero and
-- both stay visible, so a statement always reconciles.
--
-- Run this in the Supabase SQL editor. Reversible manually via the DOWN
-- section at the bottom (commented out).

-- ---------------------------------------------------------------------
-- 1. The company
-- ---------------------------------------------------------------------

create table if not exists clients (
  id          bigint generated always as identity primary key,
  name        text not null,
  -- References lookup_options('client_type').value, so the list is editable at
  -- runtime (see sql/29_add_lookup_options.sql).
  client_type text not null default 'VENDOR',
  location    text,
  address     text,
  gst_number  text,
  notes       text,
  is_active   boolean not null default true,
  created_by  uuid,
  updated_by  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint clients_name_unique unique (name)
);

create index if not exists idx_clients_active on clients (is_active, name);

-- ---------------------------------------------------------------------
-- 2. Points of contact
-- ---------------------------------------------------------------------
-- A company is several people in practice — HR for the contract, operations
-- for day-to-day vehicles, accounts for the money — so contacts are their own
-- rows rather than one contact_person column on the client.

create table if not exists client_contacts (
  id          bigint generated always as identity primary key,
  client_id   bigint not null references clients(id) on delete cascade,
  name        text not null,
  role        text,          -- lookup_options('contact_role').value
  designation text,
  phone       text,
  alt_phone   text,
  email       text,
  notes       text,
  is_primary  boolean not null default false,
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint client_contacts_phone_check
    check (phone is null or phone ~ '^[6-9][0-9]{9}$'),
  constraint client_contacts_alt_phone_check
    check (alt_phone is null or alt_phone ~ '^[6-9][0-9]{9}$')
);

-- Exactly one primary per client, enforced by the DB rather than by the API
-- remembering to clear the old one.
create unique index if not exists uq_client_primary_contact
  on client_contacts (client_id)
  where is_primary;

create index if not exists idx_client_contacts_client
  on client_contacts (client_id);

-- ---------------------------------------------------------------------
-- 3. Vehicles deployed to the client
-- ---------------------------------------------------------------------
-- Two things at once, because both are genuinely needed:
--
--   * A LINKED vehicle (vehicle_id set) — one of ours, so the deployment can be
--     read either way: "which vehicles are on this client", "which client is
--     this vehicle on".
--   * A DECLARED bucket (vehicle_id null, quantity > 1) — "4 buses, 43-seater"
--     where the individual vehicles aren't tracked, e.g. hired-in units.
--
-- Either way the spec columns describe exactly what runs there, reusing the
-- same enums as the vehicles table (sql/11_enums_for_vehicle_types.sql) so a
-- 43-seater bus or a 32ft closed container means the same thing in both places.

create table if not exists client_deployments (
  id                 bigint generated always as identity primary key,
  client_id          bigint not null references clients(id) on delete cascade,
  vehicle_id         bigint references vehicles(id) on delete set null,
  quantity           integer not null default 1,

  vehicle_type       vehicle_type_enum not null,
  seating_capacity   integer,                    -- 43-seater bus, 12-seater tempo
  truck_type         truck_type_enum,
  container_length   container_length_enum,      -- 32 ft
  axle_type          axle_type_enum,
  container_body_type container_body_type_enum,  -- CLOSED / FLATBED_OPEN

  monthly_rate       numeric,
  start_date         date,
  end_date           date,
  is_active          boolean not null default true,
  notes              text,
  created_by         uuid,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint client_deployments_quantity_check check (quantity > 0),
  -- A linked vehicle is one physical vehicle; only declared buckets can count
  -- more than one.
  constraint client_deployments_linked_qty_check
    check (vehicle_id is null or quantity = 1),
  constraint client_deployments_rate_check
    check (monthly_rate is null or monthly_rate >= 0),
  constraint client_deployments_seating_check
    check (seating_capacity is null or seating_capacity > 0),
  constraint client_deployments_dates_check
    check (end_date is null or start_date is null or end_date >= start_date)
);

-- One of our vehicles can only be actively deployed to one client at a time.
create unique index if not exists uq_active_vehicle_one_client
  on client_deployments (vehicle_id)
  where vehicle_id is not null and is_active;

create index if not exists idx_client_deployments_client
  on client_deployments (client_id, is_active);

-- ---------------------------------------------------------------------
-- 4. The receivables ledger (append-only)
-- ---------------------------------------------------------------------

create table if not exists client_ledger_entries (
  id                bigint generated always as identity primary key,
  client_id         bigint not null references clients(id) on delete cascade,
  -- OPENING    — balance carried in when the client was added
  -- BILL       — monthly hire charges, increases what they owe
  -- PAYMENT    — money received, reduces it
  -- ADJUSTMENT — a correction, including every reversal
  entry_type        text not null,
  -- DEBIT increases what the client owes us, CREDIT decreases it. Kept separate
  -- from entry_type so a reversal can be an ADJUSTMENT in either direction.
  direction         text not null,
  amount            numeric not null,
  entry_date        date not null default current_date,
  invoice_no        text,        -- optional
  period_month      date,        -- optional, 1st of the month the bill covers
  payment_method    text,        -- lookup_options('payment_method').value
  reference         text,        -- UTR / cheque no.
  description       text,
  reverses_entry_id bigint references client_ledger_entries(id),
  created_by        uuid,
  created_at        timestamptz not null default now(),

  constraint client_ledger_entries_type_check
    check (entry_type in ('OPENING', 'BILL', 'PAYMENT', 'ADJUSTMENT')),
  constraint client_ledger_entries_direction_check
    check (direction in ('DEBIT', 'CREDIT')),
  -- Amounts are always positive; `direction` carries the sign.
  constraint client_ledger_entries_amount_check check (amount > 0)
);

-- An entry can be reversed at most once; a second attempt hits this and
-- surfaces as a 409 rather than double-correcting the balance.
create unique index if not exists uq_client_ledger_reverses
  on client_ledger_entries (reverses_entry_id)
  where reverses_entry_id is not null;

-- Ordered by (date, id) because the statement's running balance depends on a
-- stable sequence, and two entries can share a date.
create index if not exists idx_client_ledger_client
  on client_ledger_entries (client_id, entry_date, id);

alter table clients enable row level security;
alter table client_contacts enable row level security;
alter table client_deployments enable row level security;
alter table client_ledger_entries enable row level security;
-- No policies added — service-role access only (see docs/supabase-security.md).
-- The API routes additionally gate every method, GET included, behind
-- requireStrictAdminAuth(), matching the loans routes.

-- ---------------------------------------------------------------------
-- 5. Derived balances
-- ---------------------------------------------------------------------

create or replace view client_balances
with (security_invoker = on) as
select
  c.id as client_id,
  coalesce(e.total_billed, 0) as total_billed,
  coalesce(e.total_paid, 0)   as total_paid,
  coalesce(e.total_billed, 0) - coalesce(e.total_paid, 0) as outstanding,
  -- An overpayment reads as money held on account rather than as a confusing
  -- negative outstanding.
  greatest(coalesce(e.total_paid, 0) - coalesce(e.total_billed, 0), 0) as advance_amount,
  e.last_payment_date,
  e.last_entry_date,
  e.oldest_unpaid_date,
  coalesce(e.entry_count, 0) as entry_count
from clients c
left join lateral (
  select
    coalesce(sum(le.amount) filter (where le.direction = 'DEBIT'), 0)  as total_billed,
    coalesce(sum(le.amount) filter (where le.direction = 'CREDIT'), 0) as total_paid,
    max(le.entry_date) filter (where le.entry_type = 'PAYMENT')        as last_payment_date,
    max(le.entry_date)                                                 as last_entry_date,
    min(le.entry_date) filter (where le.direction = 'DEBIT')           as oldest_unpaid_date,
    count(*)                                                           as entry_count
  from client_ledger_entries le
  where le.client_id = c.id
    -- A reversed entry and its reversal are both excluded, so the pair nets to
    -- zero without either row being deleted.
    and le.reverses_entry_id is null
    and not exists (
      select 1 from client_ledger_entries r where r.reverses_entry_id = le.id
    )
) e on true;

-- ---------------------------------------------------------------------
-- DOWN (manual rollback — uncomment to run)
-- ---------------------------------------------------------------------
-- drop view if exists client_balances;
-- drop table if exists client_ledger_entries;
-- drop table if exists client_deployments;
-- drop table if exists client_contacts;
-- drop table if exists clients;
