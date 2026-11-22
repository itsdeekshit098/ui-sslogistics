# 0011 — Client product questions (answered)

- **Status:** Accepted — answered 2026-11-22 and built
- **Date:** 2026-11-22
- **Area:** clients — create, delete, statement entries

## Situation

The live test of Clients (Nov 2026) found behaviour that may be intended or may be a gap. These are product decisions, so they were left alone.

## Questions

1. **If an opening balance is invalid, should the client still be created?** Today the client is created and the answer carries a warning ("Client created, but the opening balance was not a valid amount"). *Options:* keep (the client is the important part), or refuse the whole request so nothing is half done.
2. **Should deleting a client remove its contacts and vehicles silently?** Today it does, once the account is settled and the statement is empty. *Options:* keep, or refuse until they are removed.
3. **Should entries be refused on an inactive client?** Today bills and payments are accepted.
4. **Should an entry be allowed a future date?** Today it is (the date picker has no upper limit either). Loans refuse a future payment date.
5. **Should `POST /api/clients/<id>/entries` accept `OPENING`?** Today anyone can add more "opening balance" entries after creation (a second ₹1 opening dated 2020 was accepted). *Options:* only the create-client path writes openings, or keep it for corrections.
6. **Should the web be able to mark a client inactive and active again?** Today the Edit form has no switch, yet the delete message says "Mark them inactive instead".

## Decision

1. **Invalid opening balance:** refuse the whole create. The amount and its date (not in the future) are checked before anything is saved, so a client is never created with its starting balance missing. Rejected: keeping the warning (the user can close the window believing a balance exists).
2. **Delete with contacts or vehicles:** refused, naming what is attached ("it has 2 contacts and 1 vehicle assignment. Remove them first, or mark the client inactive").
3. **Inactive client:** bills, payments and adjustments are refused with a clear message; the Add Bill and Record Payment buttons are disabled with the reason. Reversals stay allowed so a mistake can still be corrected.
4. **Future dates:** refused on entries (and on the opening date); the date picker stops at today.
5. **Extra `OPENING` entries:** one standing opening balance per client. To correct it, reverse it and enter a new one.
6. **Active/Inactive:** an "Active" switch in the Edit Client form.

Cost: a client that was deactivated must be reactivated before a late payment can be recorded; entries cannot be pre-dated for a bill known to be coming.

## Where it shows up

[clients feature page](../features/clients.md) · [.claude/rules/live-testing.md](../../.claude/rules/live-testing.md)
