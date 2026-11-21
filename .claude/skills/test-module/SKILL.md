---
name: test-module
description: Live-test one SS Logistics module end to end like a senior tester and product owner — real clicks in Chrome, API edge probes, every role, the phone layout, effects on other modules — then fix what breaks with tests, and update the coverage table, the module's feature page and the known-issues list. Use when the user asks to test, QA or verify a module in real time (clients, fundings, drivers, trips, diesel, repairs, warranty, …).
argument-hint: <module name>
---

# Live-test a module: $ARGUMENTS

<!--
WHAT THIS FILE IS: a skill — a written recipe Claude follows in the SAME conversation (unlike an agent).
HOW TO RUN IT: type `/test-module drivers`, or just say "test the drivers module in real time" —
  the `description` above tells Claude when it applies. Whatever follows the name replaces $ARGUMENTS.
WHAT IT DOES: sets the ORDER of work — study, charter (user approves), preflight, test, fix, review,
  close out — and says which agents (live-tester, migration-author, code-reviewer) to hand each step to.
WHY A SKILL AND NOT A RULE: a rule is knowledge ("what is true"); a skill is a procedure ("what to do, in order").
-->

The method, the seven-point checklist and the coverage table are in `.claude/rules/live-testing.md` (always loaded). This skill is the order to apply them in. **Nothing is clicked or changed until the user has approved the charter (step 2).**

## 1. Study (read before planning)

- **What is known already:** the module's row in the coverage table, its page in `docs/features/` if one exists, its rows in `docs/known-issues.md`, and any decision in `docs/decisions/` that mentions it (`Open` ones are unanswered questions — don't re-ask what is answered, don't decide what is open).
- **What the code says:** its rule file in `.claude/rules/`, every route under `src/app/api/` it calls, its page and components under `src/components/` (find every way into a flow — a modal *and* a `/new` page are two flows), and its tests (`test/app/api/…`, `e2e/features/…`).
- **Who else uses it:** grep for its API path and table across `src/` and `../mobile_sslogistics/lib/`. Other screens that read the same data (pickers, dashboards, attendance, salaries) are where a change here shows up, and the Flutter app sends its own requests to the same route.
- **Code scan for the recurring bug classes:** `req.json()`, `Number(…id…)` without an integer check, UTC "today", `.or(\``, a `Boolean(x)` or `.trim()` on an unchecked body field, money or text without an upper bound, a missing `logActivity`, an auth level that differs between methods. Each hit becomes a "suspected" case to confirm live — not a bug until it reproduces.

## 2. Charter — stop here for the user's go-ahead

Write the user a numbered test plan, short enough to read in two minutes:

| Group | What to put in it |
|---|---|
| **A. Flows (clicks)** | Each user flow through the real UI, every entry point, with its expected result. |
| **B. Validation (API probes)** | The edge inputs from the rule's checklist, per method. |
| **C. Roles** | Each role × each action: what the UI shows and what a hand-made request must get. |
| **D. Phone (390px)** | The screens and anything hover-only. |
| **E. Effects on other modules** | Where the change must (or must not) show up: lists, pickers, dashboards, the Flutter app's view of the same route. |
| **F. Suspected from code** | The code-scan hits, each with the probe that would confirm it. |

Give each case an id (`DRV-A1`, `DRV-B4` …) so results and fixes can refer to it. Then add:

- **Test data:** what will be created (`ZZ-E2E-<module>-<n>`), which spare records are used, and what will be left permanently (ledger rows, audit-log entries).
- **Product questions:** behaviour that might be intended — ask now, not halfway through.
- **Roles needed:** in what order the user should sign in.

**Ask the user to approve, trim or add to the plan, and wait.**

## 3. Preflight

Dev server running (`lsof -nP -iTCP -sTCP:LISTEN | grep node`); other app tabs closed; the user signed in as the first role (never type a password; sessions time out after 15 minutes idle). Note the starting state — record counts, any totals — so the end state can be compared.

## 4. Execute

- Keep a results log in the scratchpad: case id → pass / fail / blocked, with the evidence (request + status + body, or what the screen showed).
- Run click flows yourself when the user is switching roles with you, so each step can be seen and discussed.
- Delegate a long single-role sweep (e.g. all of group B as admin) to the **live-tester** agent with the charter cases, the record ids to use and the instruction to report per case id — its output stays out of this conversation.
- Something unexpected that isn't in the charter: test it, add it to the log under a new id.

## 5. Fix

- **Clear bugs** (a 500 on bad input, a wrong total, a missing permission check): find the root cause, fix it in the shared helper where one exists (`readJsonObject`, `parseId`, `todayInIndia`, `moneyProblem`), add a unit test that fails without the fix, then re-run the live probe that found it.
- **Anything that changes what a user can do** (a role gaining or losing an action, a rule becoming stricter): ask first — it may be a product decision.
- A view/constraint cause → the **migration-author** agent, and tell the user to apply the file.
- Not fixed now → a row in `docs/known-issues.md`.

## 6. Review

`npm run lint && npm run typecheck && npx vitest run <changed tests>`, then the **code-reviewer** agent on the diff, and the **mobile-contract-checker** agent if any response shape, status code or auth level changed.

## 7. Close out

- Reverse/close test data; compare with the starting state; list the permanent rows left.
- `.claude/rules/live-testing.md`: update the module's coverage row and the "Not yet covered" list.
- `docs/features/<module>.md`: write or refresh it, using the headings in `docs/features/README.md`, now that every screen has just been driven; update that README's table.
- `docs/known-issues.md`: add what is left, delete what was fixed. `docs/CHANGELOG.md`: one line per user-visible fix.
- `docs/decisions/`: a record for each real choice made while fixing (`/record-decision`); unanswered product questions go in an `Open` record, not only the chat.
- Report: a results table (case id, result), bugs fixed, bugs left, questions, data left behind. **Do not commit** — the user says when (`/ship`).
