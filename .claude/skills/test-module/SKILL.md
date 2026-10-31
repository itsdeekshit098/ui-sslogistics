---
name: test-module
description: Live-test one SS Logistics module end to end like a senior tester and product owner — real clicks in Chrome, API edge probes, every role, the phone layout — then fix what breaks with tests and update the coverage table. Use when the user asks to test, QA or verify a module in real time (clients, fundings, drivers, trips, diesel, repairs, warranty, …).
argument-hint: <module name>
---

# Live-test a module: $ARGUMENTS

<!--
WHAT THIS FILE IS: a skill — a written recipe Claude follows in the SAME conversation (unlike an agent).
HOW TO RUN IT: type `/test-module clients`. Whatever you type after the name replaces $ARGUMENTS.
  Claude may also pick it up by itself when you say "test the fundings module in real time",
  because the `description` in the frontmatter says when it applies.
WHAT IT DOES: sets the ORDER of work — plan, preflight, test, fix, review, close out — and says which
  agents (live-tester, migration-author, code-reviewer) to hand each step to.
WHY A SKILL AND NOT A RULE: a rule is knowledge ("what is true"); a skill is a procedure ("what to do, in order").
-->

The method and the coverage table are in `.claude/rules/live-testing.md` (always loaded). This skill is the order to apply them in.

## 1. Charter (before touching the browser)

- Read the module's rule file in `.claude/rules/`, its routes under `src/app/api/`, its page under `src/components/`, and its existing tests (`test/app/api/…`, `e2e/features/…`).
- Grep the module for the recurring bug classes first — `req.json()`, `new Date().toISOString().slice(0, 10)`, `Number(…id…)` without an integer check, `.or(\``, money fields without an upper bound or decimal check. Every hit is a test case.
- Write the user a short charter: flows to click, API probes, roles, money totals to cross-check, and which spare/`ZZ-E2E` records you will use. Ask the open product questions now, not halfway through.

## 2. Preflight

Dev server running; other app tabs closed; ask the user to sign in as the role you need (never type a password).

## 3. Execute

- Run the flows yourself when the user is switching roles with you, so each step can be seen and discussed.
- Delegate to the **live-tester** agent for a long single-role sweep (e.g. all API probes as admin), so the output doesn't fill this conversation. Give it the charter and the record ids to use.

## 4. Fix

For each confirmed bug: find the root cause, fix it in the shared helper where one exists (`readJsonObject`, `parseId`, `todayInIndia`, `moneyProblem`), add a unit test that fails without the fix, then re-run the live probe that found it. A view/constraint cause → the **migration-author** agent, and tell the user to apply the file.

## 5. Review

`npm run lint && npm run typecheck && npx vitest run <changed tests>`, then the **code-reviewer** agent on the diff, and the **mobile-contract-checker** agent if any response shape changed.

## 6. Close out

- Reverse/close test data; list the permanent rows left.
- Update the coverage table and "Not yet covered" list in `.claude/rules/live-testing.md`; add any new product question to its list.
- Write or refresh the module's page in `docs/features/` (text only), now that you have just driven every screen. Record each real choice made while fixing as a decision (`/record-decision`), and put unanswered product questions in an `Open` record rather than only in the chat.
- Report: bugs fixed, bugs left, questions, data left behind. **Do not commit** — the user says when (`/ship`).
