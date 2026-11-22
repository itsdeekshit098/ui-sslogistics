# 0010 — Open funding product questions

- **Status:** Open — needs the product owner's answer; nothing below has been changed in code
- **Date:** 2026-11-22
- **Area:** fundings — entries, settling, deleting

## Situation

The live test of Fundings (Nov 2026) found behaviour that may be intended or may be a gap. These are product decisions, so they were left alone.

## Questions

1. **Should an entry be allowed to have a future date?** Today `POST /api/fundings/<id>/entries` accepts any valid date (a ₹100 principal dated 2030 was stored), and the date picker has no upper limit, so it also happens from the screen. Loans refuse a future payment date. *Options:* refuse dates after today in India (like loans), or keep allowing them (a scheduled repayment). Note a future-dated principal or repayment already changes the balances shown today.
2. **Should entries and rate changes be refused on a SETTLED funding?** Today both are accepted. *Options:* lock a settled funding like a settled salary month ([0004](0004-settled-month-is-locked.md)), or keep it open so a late interest payment can still be recorded.
3. **Should the web be able to settle, reopen or delete a funding?** Today only the API can settle or reopen (`PUT` with `status`), and no funding can be deleted because creating one always writes an entry. *Options:* add Settle/Reopen to the detail page; decide whether Delete should exist at all.
4. **Should the funding list's Total/summary show paise?** Money is shown in whole rupees in some places and with paise in others on the same page (tiles show ₹6,333.33, "Total owed" shows ₹1,06,333). See the display row in `docs/known-issues.md`.

## Decision

None yet. When answered, change the status here to `Accepted` with the answer, or write a new record and mark this one `Superseded by NNNN`.

## Where it shows up

[fundings feature page](../features/fundings.md) · [.claude/rules/live-testing.md](../../.claude/rules/live-testing.md)
