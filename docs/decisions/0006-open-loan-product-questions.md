# 0006 — Open loan product questions

- **Status:** Open — needs the product owner's answer; nothing below has been changed in code
- **Date:** 2026-10-31
- **Area:** loans — payments, waiving, foreclosure, edit screens

## Situation

Live testing of Loans turned up behaviour that may be intended or may be a gap. These are product decisions, not bugs, so they were left alone and recorded here instead of guessed at.

## Questions

1. **Should a waived EMI reduce the loan's outstanding?** Today it does not reduce what is owed. *Options:* keep (waiving is a status only), or treat a waiver as a credit.
2. **Should payments be blocked on CLOSED or FORECLOSED loans?** Today they are accepted. *Options:* block with a clear message, or allow so a late settlement can still be recorded.
3. **Should "Foreclose" suggest the outstanding amount and close the loan in one step?** Today foreclosure is a status change only.
4. **Closing a loan cannot be done from the web.** The edit form has no status field, so CLOSED, FORECLOSED and DEFAULTED can only be set through the API. Deleting a loan that has payments is refused with "Mark it CLOSED, FORECLOSED, or DEFAULTED instead", which the web gives no way to follow. There is also no Waive button on the web, though the API supports waiving. *Options:* add a status field to the edit form (and a Waive action), or keep these admin-by-API and change the delete message to say so.
5. **A DEFAULTED loan still appears under "Overdue only".** The filter drops CLOSED and FORECLOSED ([0005](0005-closed-loans-are-not-overdue.md)) but not DEFAULTED. *Options:* keep it (a defaulted loan is the most overdue kind), or exclude it from the overdue count and list it separately. The status chips also offer only All / Active / Closed, with no Foreclosed or Defaulted.
6. **Unpaid rows of a closed loan still show "Mark Paid".** The schedule offers it, and the server accepts it (see question 2).

(Trip Sheets and Reports being reachable by URL for every role, though hidden in the sidebar, was raised separately and the user said the locks are intentional.)

## Decision

None yet. When answered, change the status here to `Accepted` with the answer, or write a new record and mark this one `Superseded by NNNN`.

## Where it shows up

[loans feature page](../features/loans.md) · [.claude/rules/live-testing.md](../../.claude/rules/live-testing.md) (the same questions are listed there for the next tester)
