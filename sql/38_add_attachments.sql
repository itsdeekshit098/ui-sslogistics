-- The first many-files-per-record table in the schema. Vehicle documents
-- (sql-less, columns on `vehicles`) are six fixed slots that overwrite on
-- re-upload; a vehicle photo gallery and a stack of payment proofs are not
-- that shape, so they get real rows.
--
-- Two nullable parent FKs with an exactly-one CHECK, mirroring
-- fundings_counterparty_check (sql/35). This beats a polymorphic
-- (owner_type, owner_id) pair because both parents keep a real FK with
-- ON DELETE CASCADE, so a deleted parent can never leave a dangling row.
-- Adding a third parent later (funding_entries, loan_payments) is one nullable
-- column plus one number in the CHECK.
--
-- Files live in the private `attachments` bucket, created by hand in the
-- Supabase dashboard (there is no storage SQL in this repo). storage_path is
-- unique so a row can never point at a file another row also claims.

create table if not exists attachments (
  id              bigint generated always as identity primary key,
  vehicle_id      bigint references vehicles(id) on delete cascade,
  client_entry_id bigint references client_ledger_entries(id) on delete cascade,
  storage_path    text not null unique,
  file_name       text not null,
  mime_type       text not null,
  size_bytes      bigint not null,
  caption         text,
  uploaded_by     uuid,
  created_at      timestamptz not null default now(),

  constraint attachments_one_parent
    check (num_nonnulls(vehicle_id, client_entry_id) = 1),
  constraint attachments_size_check
    check (size_bytes > 0 and size_bytes <= 10485760)
);

create index if not exists idx_attachments_vehicle
  on attachments (vehicle_id, created_at desc) where vehicle_id is not null;
create index if not exists idx_attachments_client_entry
  on attachments (client_entry_id, created_at desc) where client_entry_id is not null;

alter table attachments enable row level security;
-- No policies — service-role only, same as every other money table.

-- ---------------------------------------------------------------------
-- DOWN (manual rollback — uncomment to run)
-- ---------------------------------------------------------------------
-- drop index if exists idx_attachments_client_entry;
-- drop index if exists idx_attachments_vehicle;
-- drop table if exists attachments;
-- Storage objects under the `attachments` bucket must be removed separately.
