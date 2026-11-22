-- Two clients can't share a name even when the capitals differ ("ACT" / "act").
--
-- The API already refuses this (clients/route.ts: nameTaken, an ilike lookup),
-- but that is a read-then-write check, so two requests landing together can both
-- pass it. The existing constraint clients_name_unique is case-sensitive, so it
-- doesn't catch the pair. This index lets the database decide, atomically; the
-- route already turns a unique violation (23505) into "A client with that name
-- already exists" (409).
--
-- Creating the index fails if two clients already differ only by case. Run this
-- first, rename one of each pair, then apply the file:
--
-- select lower(name), array_agg(id order by id) as ids
-- from clients
-- group by lower(name)
-- having count(*) > 1;

create unique index if not exists uq_clients_name_lower
  on clients (lower(name));

-- DOWN
-- drop index if exists uq_clients_name_lower;
