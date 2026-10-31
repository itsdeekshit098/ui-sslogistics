# Feature docs

One plain-words page per module: what a person sees, what they can do, who can do it, and where the code is. Written for a developer who has forgotten the screen (or never saw it) and would otherwise have to click around.

**Text only, no committed images.** Screenshots stay out of git: they bloat history permanently, go stale without anyone noticing, and the dev database holds real names, phone numbers and loan amounts. To *see* the screens, run the app and use `npm run visual:baseline` (every admin page at 390px, light and dark, into the git-ignored `visual-snapshots/`), or `/screenshots <module>`.

## What each page contains

Every page uses the same headings so they can be scanned the same way:

1. **Purpose** — one or two sentences: what the module is for, in business terms.
2. **Who can do what** — a table of admin / staff / driver. Say what is hidden, what is disabled, and what the server refuses.
3. **The screen** — the layout top to bottom in words, desktop first, then what changes on a phone (390px).
4. **Flows** — numbered steps for each thing a person does, including what they see afterwards and what errors they can hit.
5. **Rules the user can notice** — behaviour that looks odd unless you know the rule (a locked month, an unmarked day being paid, a closed loan).
6. **Where it lives** — page and component folder, API routes, SQL files, rule file, tests, Flutter folder.
7. **Why it works this way** — links to the decision records in `../decisions/`.
8. **Not built / open questions** — gaps and undecided product questions, so nobody mistakes them for bugs.

## Keeping them true

- Change the screen or a flow → change its page in the same commit. `/ship` asks.
- Describe what the code does today, not what was intended. If you are unsure, open the component and check.
- Keep it short: a page you can read in five minutes gets read. Link to the rule file for the detailed invariants instead of copying them.

## Pages

| Module | Page | Last verified against the code |
|---|---|---|
| Attendance | [attendance.md](attendance.md) | 2026-10-31 |
| Salaries | [salaries.md](salaries.md) | 2026-10-31 |
| Loans | [loans.md](loans.md) | 2026-10-31 |

Not yet written: Vehicles, Clients, Fundings, Drivers, Trips, Diesel, Repair records, Warranty, Technicians, Firms & Owners, Bank accounts, Activity log, Sessions, Settings. Add one when you next work on that module (`/test-module` does this as part of its close-out).
