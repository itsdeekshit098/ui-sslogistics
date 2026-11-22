# Clients (companies and people we supply vehicles to)

## Purpose

A client is who our vehicles run for, and what they owe. Each has a **statement** (a ledger of bills and payments), contacts, and the vehicles deployed to them. What a client owes is never stored: it is worked out from the statement (`client_balances`).

## Who can do what

| Role | Can do |
|---|---|
| Admin / superadmin | Everything below. |
| Staff, driver | Nothing: the page is hidden and every `/api/clients` method answers 403, reads included. |
| Signed out | 401 `SESSION_INVALID`. |

## The screen

**List** (`/admin/clients`): summary tiles (total clients, total outstanding, clients with dues, advance held), a search (name, location, GST), filters for All / Companies / Individuals and "Owes money", and one row or card per client with type, vehicles, outstanding and last payment. Hover a row for Edit and Delete. The "Owes money" filter counts and pages only the clients that owe.

**Detail** (`/admin/clients/<id>`): name and type, "Add Bill" and "Record Payment", tiles for outstanding, total billed and total received, then tabs **Statement** (every entry with a running balance, newest first; a reversed entry is struck through), **Contacts** (not shown for an individual) and **Vehicles** (deployments).

**Phone (390px):** tiles scroll sideways, forms are bottom sheets, and the statement is a vertical timeline.

## Flows

1. **Add a client** — a company (name, type, location, address, GST, which account they pay into, notes) or an individual linked to an entity (their name comes from the entity). An optional opening balance becomes the first statement entry, dated today unless changed; an invalid amount or a future date refuses the whole save, so nothing is half created.
2. **Edit** — the same form, plus an Active switch. An inactive client keeps its statement but takes no new bills or payments (the buttons are disabled; the API answers 400); reversing an entry still works.
3. **Add Bill / Record Payment** — amount, date, invoice number and billing month (bills), payment method, reference, description. "Settle in full" shows what is outstanding.
4. **Reverse an entry** — a new row cancels the original; once only; a reversal cannot be reversed.
5. **Contacts** — name, role, designation, phone (10-digit mobile), email; one can be primary, which replaces the previous primary.
6. **Vehicles** — either one of our vehicles (its spec is copied) or a declared bucket ("2 buses, 40-seater"), with an optional monthly rate and dates.
7. **Delete** — only when the account is settled and the statement has no entries. It is also refused while the client has contacts or vehicle assignments, and the message says what is attached. Otherwise it says to mark the client inactive.

## Rules the user can notice

- Names are unique ignoring case ("ACT" and "act" are the same client). One entity can have one client account.
- An individual's name always follows the linked entity.
- Limits: location 150, address 500, GST 20, notes 500, reference and invoice number 100 characters; seating capacity 1 to 200; quantity 1 to 1000; money has at most two decimals.
- Free-text fields must be text, flags must be true or false, and a client type must be one of the type list.
- Statement entries are append-only. Deleting a client also removes its contacts and vehicles.

## Where it lives

- Screens: `src/components/clientsPage/`, `clientModal/`, `clientDetailPage/` (with `ledgerEntryModal`, `contactModal`, `deploymentModal`); pages under `src/app/admin/clients/`.
- API: `src/app/api/clients/` (`route.ts`, `[id]/route.ts`, `[id]/entries/`, `[id]/contacts/`, `[id]/deployments/`, `[id]/entries/[entryId]/reverse/`).
- SQL: `sql/33_add_clients.sql`, `sql/36_add_client_party_kind.sql`. Rule: `.claude/rules/database-and-money.md`.
- Tests: `test/app/api/clients/`, `e2e/features/clients/`.
- Flutter: `mobile_sslogistics/lib/features/clients/` (same routes and shapes).

## Why it works this way

Open questions are in [0011](../decisions/0011-open-client-product-questions.md).

## Not built / open questions

Answered in [0011](../decisions/0011-open-client-product-questions.md). Entries cannot be dated in the future, and only one opening balance stands per client (reverse it to enter another).
