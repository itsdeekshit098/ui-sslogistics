# Decision records

A short note for each choice a future reader might question: what the situation was, what the options were, what we chose, and what that costs us. Code shows *what* the system does; these say *why*, and what was rejected, which is the part that gets forgotten.

## When to write one

- A reasonable person could have chosen the other way (auto-settle EMIs or not; reject or silently fix bad input).
- It cost real debate, or a live test showed the obvious design was wrong.
- A rule looks like a bug until you know the reason ("a day with no mark is paid").
- You are deliberately *not* doing something, or leaving a question open.

Skip it for routine fixes: the commit message covers those. Run `/record-decision` and Claude fills the template from the current conversation.

## Rules

- **Short.** Half a page. If it needs more, link to a rule file or feature page.
- **Numbered, never renumbered.** `NNNN-short-title.md`, next free number.
- **Never delete or rewrite history.** When a decision is reversed, set the old one to `Superseded by NNNN` and write a new one. The old reasoning stays readable.
- **Status** is one of: `Accepted` · `Open` (a question the user still has to answer) · `Superseded by NNNN`.
- **Dates are absolute** (`2026-10-31`), never "last week".
- Link it from the rule file or feature page it explains, so it is found from the code side too.

## Template

Copy [TEMPLATE.md](TEMPLATE.md).

## Index

| # | Decision | Status | Date |
|---|---|---|---|
| [0001](0001-auto-settle-overdue-emis.md) | Overdue EMIs are auto-settled by a nightly script | Accepted | 2026-08-16 |
| [0002](0002-reject-duplicate-shifts.md) | Attendance rejects a repeated shift instead of fixing it | Accepted | 2026-10 |
| [0003](0003-shift-count-change-warns-not-rewrites.md) | Lowering a driver's shift count warns about old marks, never rewrites them | Accepted | 2026-10 |
| [0004](0004-settled-month-is-locked.md) | A settled salary month is locked | Accepted | 2026 |
| [0005](0005-closed-loans-are-not-overdue.md) | Closed and foreclosed loans never count as overdue | Accepted | 2026-10 |
| [0006](0006-open-loan-product-questions.md) | Open loan product questions | Open | 2026-10-31 |
| [0007](0007-settle-only-finished-months.md) | A salary month can be settled only after it ends | Accepted | 2026-10-31 |
