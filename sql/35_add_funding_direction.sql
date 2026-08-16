-- Money we LEND to an individual is arithmetically the same arrangement as
-- money we borrow from one: no schedule, ad-hoc principal, simple interest that
-- never compounds, day-prorated at 30-day months. computeFunding()
-- (src/app/api/fundings/fundings.utils.ts) is already sign-agnostic — only the
-- field names and UI copy assume a borrower.
--
-- So this adds a direction rather than a parallel "lendings" module: the
-- day-prorating stays ONE implementation with one set of bugs. Entry types keep
-- their existing values (PRINCIPAL_TAKEN etc.) so no data migrates and the
-- engine is untouched; the UI relabels them per direction.
--
-- The LENT counterparty is an entities FK, not a lenders FK, so the same person
-- can also carry a receivables ledger (sql/36).
--
-- Run this in the Supabase SQL editor. Reversible manually via the DOWN
-- section at the bottom (commented out).

alter table fundings add column if not exists direction text not null
  default 'BORROWED';
alter table fundings add column if not exists counterparty_entity_id bigint
  references entities(id);
alter table fundings alter column funder_id drop not null;

alter table fundings add constraint fundings_direction_check
  check (direction in ('BORROWED', 'LENT'));

-- BORROWED → a lender we owe. LENT → an entity that owes us. Exactly one side.
alter table fundings add constraint fundings_counterparty_check check (
  (direction = 'BORROWED'
     and funder_id is not null and counterparty_entity_id is null)
  or (direction = 'LENT'
     and counterparty_entity_id is not null and funder_id is null)
);

create index if not exists idx_fundings_direction
  on fundings (direction, status);

-- ---------------------------------------------------------------------
-- DOWN (manual rollback — uncomment to run)
-- ---------------------------------------------------------------------
-- drop index if exists idx_fundings_direction;
-- alter table fundings drop constraint if exists fundings_counterparty_check;
-- alter table fundings drop constraint if exists fundings_direction_check;
-- delete from fundings where direction = 'LENT';   -- required before re-adding NOT NULL
-- alter table fundings alter column funder_id set not null;
-- alter table fundings drop column if exists counterparty_entity_id;
-- alter table fundings drop column if exists direction;
