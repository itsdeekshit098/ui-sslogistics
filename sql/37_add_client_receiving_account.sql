-- The account a client's payment normally arrives INTO — the mirror of
-- loans.debit_account_id (sql/34), which records the account an EMI LEAVES
-- FROM. Same shape, same reasoning: one FK on the master row, never on
-- individual client_ledger_entries rows, so there is no implied per-account
-- balance the app would have to (wrongly) compute.
--
-- Nullable and freely reassignable — unlike clients.party_kind (create-only,
-- sql/36), a client's paying-into account is expected to change over time.

alter table clients add column if not exists receiving_account_id bigint
  references bank_accounts(id);

create index if not exists idx_clients_receiving_account
  on clients (receiving_account_id);

-- ---------------------------------------------------------------------
-- DOWN (manual rollback — uncomment to run)
-- ---------------------------------------------------------------------
-- drop index if exists idx_clients_receiving_account;
-- alter table clients drop column if exists receiving_account_id;
