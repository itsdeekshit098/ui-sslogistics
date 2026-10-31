---
name: ship
description: Get the current ui-sslogistics changes ready to commit — fast checks, code review, SQL and docs bookkeeping, a commit message — and commit only when the user says so. Never pushes unless asked.
argument-hint: "[commit] [push] [--skip-review]"
disable-model-invocation: true
---

# Ship: $ARGUMENTS

<!--
WHAT THIS FILE IS: a skill — the "get this ready to commit" routine.
HOW TO RUN IT: only you can start it (`disable-model-invocation: true` in the frontmatter stops Claude
  from running it by itself, since it ends in a commit).
  `/ship`              -> checks and review only, then asks before committing
  `/ship commit`       -> checks, review, then commits
  `/ship commit push`  -> also pushes (you are still asked to approve the push)
WHY: it runs the quick checks first (lint, typecheck, changed tests) so the slow pre-commit gate
  (full tests, e2e, build) doesn't fail late, then does the SQL/docs bookkeeping people forget.
SAFETY: the guard hook blocks --no-verify and force-push even if these steps were ignored.
-->

## 1. What's changing

`git status --porcelain` and `git diff --stat`. Group the changes by module and say in two lines what this commit is. If unrelated work is mixed in, propose separate commits.

## 2. Fast checks first

`npm run lint && npm run typecheck`, then `npx vitest run` on the changed test folders. Fix failures before anything slower — the pre-commit hook runs the full gate (lint, typecheck, unit, e2e, build) and a failure there costs minutes.

## 3. Review

Unless `--skip-review` was given: run the **code-reviewer** agent on the diff, and the **mobile-contract-checker** agent if a route's response changed. Fix confirmed findings (with tests) and say which you skipped and why.

## 4. Bookkeeping

- New `sql/NN_*.sql`: "currently up to" updated in `CLAUDE.md` and `.claude/rules/database-and-money.md`; tell the user plainly which files they still need to apply in Supabase.
- Live-tested a module: its row in `.claude/rules/live-testing.md` is current.
- A new rule or carve-out: recorded in the right `.claude/rules/` file.
- **The reasons, for someone 100 days from now.** Ask: did this change involve a choice a reasonable person could have made differently, reject an obvious approach, or leave a product question open? If yes, run `/record-decision` (or add the record yourself) and link it from the rule file and feature page. Routine fixes need none — the commit message covers them.
- **The screen.** If a page's layout, buttons, flows or who-can-do-what changed, update its page in `docs/features/` in this commit (text only — no screenshots in git). No page yet for the module? Say so rather than skipping silently.
- **Changelog:** add one line under "Unreleased" in `docs/CHANGELOG.md` — what changed for a user or an operator, not how.

## 5. Commit — only if `$ARGUMENTS` contains `commit` or the user confirms

- Message: imperative summary line under ~72 chars in the style of `git log --oneline -10`, a blank line, then what changed and why, grouped by module. End with the attribution line from the session instructions.
- Use a heredoc for the message. Never `--no-verify` (a hook blocks it anyway). If the hook fails, fix the cause and make a **new** commit attempt — don't amend someone else's commit.
- After it succeeds, show `git log --oneline -3`.

## 6. Push — only if `$ARGUMENTS` contains `push`

`git push -u origin <branch>` (the user is asked to approve). Never force-push. Offer a PR description; if it touches API routes, say whether the Flutter app needs a matching change.
