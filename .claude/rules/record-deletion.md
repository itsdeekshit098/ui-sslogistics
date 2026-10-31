---
paths:
  - "sql/**"
  - "src/app/api/vehicles/**"
  - "src/app/api/drivers/**"
  - "src/components/*river*/**"
---

# Deleting vehicles and drivers

<!--
WHAT THIS FILE IS: a rule — project knowledge that Claude reads, not a program.
WHEN IT LOADS: automatically when Claude reads sql/, the vehicles or drivers API routes, or driver components.
WHY: a vehicle/driver can't be deleted while anything points at it, and the API must say so in plain words
  instead of a raw 500. The one standing rule: any NEW table with `driver_id ... references drivers(id)` (or
  vehicles) must be added to that route's dependent check in the SAME change.
EXAMPLE: you add a diesel_limits table with driver_id -> also add "diesel_limits" to dependentChecks in
  src/app/api/drivers/route.ts. The reminders hook nudges you when it sees such a SQL file.
-->

## Deleting a vehicle

A vehicle delete has to pass two gates, in this order:

1. **Nothing still points at it.** `DELETE /api/vehicles` counts rows in `repair_records`, `warranty`, `repair_parts`, `external_trips`, `diesel_records`, `trip_bookings` and `loans`, and answers 400 with one message listing everything attached ("…still has 6 repair records and 1 loan"). A table that doesn't exist is skipped, not treated as an error. See the standing rule under "Deleting a driver" below — it applies here too: any new `references vehicles(id)` table must be added to this check in the same change that creates it.
2. **The row is unlocked.** `vehicles.allow_permanent_delete` must be `true`. The database enforces this itself and rejects the delete otherwise; the column and its enforcement predate the files in `sql/`, so they are not recorded there. Nothing in the web or mobile UI can set the flag — it is flipped by hand in the Supabase SQL editor, per vehicle, immediately before deleting:

   ```sql
   -- change the id to the vehicle being deleted
   UPDATE vehicles
   SET allow_permanent_delete = TRUE
   WHERE id = 35;
   ```

   Then delete from the Vehicles page as usual. While the flag is false the API answers 400 with `code: "VEHICLE_DELETE_LOCKED"` rather than letting the database's refusal surface as a 500.

There is currently no UI toggle for the flag and the API never sets it. The delete also removes the vehicle's documents and photos from storage, which a raw `DELETE FROM vehicles` in SQL would leave orphaned, so prefer the page over deleting in SQL.

## Deleting a driver

`DELETE /api/drivers` (`src/app/api/drivers/route.ts`) counts rows in every table that references `driver_id`, and answers 400 with one message naming what's attached ("Cannot delete driver because they are linked to 12 attendance record(s). Deactivate them instead.") — nothing is deleted while anything is attached. A table that doesn't exist yet is skipped, not treated as an error, same as the vehicle delete.

**The checked tables, kept in sync with `sql/` by hand:** `external_trips`, `trip_bookings`, `driver_attendance`, `driver_salary_rates`, `driver_salary_entries`, `driver_salary_settlements`, `driver_shift_counts`.

**Standing rule:** any new table with a `driver_id bigint references drivers(id)` column must be added to `dependentChecks` in that route in the same change that creates the table. The foreign key means an unguarded delete still fails safely (Postgres refuses it) rather than orphaning rows, but it surfaces as a raw 500 instead of the friendly message, which is the bug this rule exists to prevent. The same applies to vehicles — see below — and to any future `references drivers(id)` / `references vehicles(id)` table.

In practice, almost no driver can actually be deleted once they've been used anywhere (marked attendance, paid a salary, had their shift count set, booked on a trip). **Deactivate is the real workflow**; delete only clears out a driver who was added by mistake and never touched.

Adding a driver also warns on near-duplicates: `src/lib/similarName.ts` compares the new name/license against existing active drivers, and `AddDriverModal` surfaces a non-blocking warning (not an error — a genuine duplicate name is still legal, e.g. two different people). `sql/49_drivers_normalized_name_unique.sql` backs this with a normalized-name uniqueness constraint at the database level for exact collisions after normalization (case/whitespace), which *does* block the insert — the two are different lines of defense: client-side similarity warning (soft) vs. DB-level exact-normalized uniqueness (hard).
