# `.claude/` — how Claude Code works in this repo

Everything here is checked in and shared, except `settings.local.json` (personal permissions, git-ignored). `CLAUDE.md` at the repo root is the entry point; it stays short and indexes what is below.

```
.claude/
├── settings.json            shared permissions + hook wiring
├── rules/                   project knowledge, split by area
│   ├── live-testing.md        always loaded: what is tested live, what isn't, how to test
│   ├── database-and-money.md  sql/ conventions, loans, fundings, clients, entities, …
│   ├── attendance-and-salaries.md
│   ├── record-deletion.md     vehicle/driver delete gates
│   ├── phone-layout.md        max-md: phone layout that mirrors Flutter
│   └── platform-ops.md        activity log, scheduled scripts, maintenance, push, Sentry
├── agents/                  subagents with one job each
│   ├── live-tester.md         drives the real app in Chrome; reports, never edits
│   ├── code-reviewer.md       verified correctness findings on the diff; read-only
│   ├── migration-author.md    writes sql/NN files + the code a schema change needs
│   └── mobile-contract-checker.md  API response vs Flutter Dart models; read-only
├── skills/                  workflows, run as slash commands
│   ├── test-module/           /test-module <module>
│   ├── new-api-route/         /new-api-route <path> <what>
│   ├── record-decision/       /record-decision <title>  → docs/decisions/
│   ├── screenshots/           /screenshots <module>  → git-ignored folder (user-invoked only)
│   └── ship/                  /ship [commit] [push] [--skip-review]  (user-invoked only)
└── hooks/                   Node scripts the harness runs; no dependencies
    ├── guard.mjs              PreToolUse — blocks .env edits, skipping the pre-commit gate, force-push
    ├── reminders.mjs          PostToolUse — flags known bug classes in edited routes and sql/ files
    ├── session-start.mjs      SessionStart — branch, unpushed commits, uncommitted SQL
    └── lib.mjs
```

## Outside `.claude/`: the project's memory (`docs/`)

`.claude/` tells Claude how to work. `docs/` keeps what a person needs in 100 days:

| Question | Where | Written by |
|---|---|---|
| How does it work now? | `.claude/rules/` | updated with the code |
| Why was it done this way, what was rejected? | `docs/decisions/` (ADRs) | `/record-decision` |
| What does the screen do, for each role? | `docs/features/` (text only) | `/test-module`, `/ship` |
| What changed, when? | `docs/CHANGELOG.md` | `/ship` |
| What is broken but not fixed yet? | `docs/known-issues.md` | whoever finds it; the fix deletes the row |
| What does it look like? | not stored — `/screenshots` or `npm run visual:baseline` | on demand |

**One fact, one home.** Each fact lives in exactly one file and everything else links to it: the latest SQL number only in `rules/database-and-money.md`, open product questions only in `docs/decisions/` (status `Open`), unfixed bugs only in `docs/known-issues.md`. Copies drift — the SQL number already did once.

Images stay out of git on purpose: they bloat history for good, go stale silently, and show real names and loan amounts.

## How the pieces fit

| Layer | Loaded / runs | Use it for |
|---|---|---|
| `CLAUDE.md` | every session | commands, architecture, conventions, index of rules |
| `rules/*.md` with `paths:` | when Claude reads a matching file | module invariants and the reasons behind them |
| `rules/*.md` without `paths:` | every session | things Claude must always know (live-testing method) |
| skills | when invoked (`/name`) or when the task matches the description | repeatable multi-step workflows |
| agents | when delegated to | long or independent work kept out of the main context |
| hooks | always, enforced by the harness | rules that must hold even if Claude forgets |
| permissions | always | `git push`, `reset --hard`, `rebase`, PR creation ask first; `.env*` can't be read |

A typical change: `/test-module clients` → bugs found → fixes, with `reminders.mjs` flagging bug classes as files are edited → `migration-author` if the database is the cause → `code-reviewer` + `mobile-contract-checker` → `/ship commit`.

## `settings.json` explained (JSON can't hold comments, so it is described here)

| Key | What it does | Example from this repo |
|---|---|---|
| `permissions.allow` | Commands Claude may run **without asking** | `npm run lint`, `git status`, `git diff` |
| `permissions.ask` | Commands that **always ask you first** | `git push`, `git reset --hard`, `gh pr create` |
| `permissions.deny` | Things Claude can **never** do | reading `.env` and `.env.*` |
| `hooks.SessionStart` | Runs when a chat starts | `session-start.mjs` prints branch + uncommitted SQL |
| `hooks.PreToolUse` | Runs **before** a tool; exit code 2 blocks it | `guard.mjs` on edits and Bash commands |
| `hooks.PostToolUse` | Runs **after** a tool; can add a note for Claude | `reminders.mjs` on Edit/Write |
| `matcher` | Which tools a hook applies to (`\|` = or) | `"Edit\|Write"` (`MultiEdit` is a legacy name; not used) |
| `timeout` | Seconds before a hook is killed (default 600) | `10` — a hook that hangs must not stall the session |
| `$CLAUDE_PROJECT_DIR` | The repo folder, set by Claude Code, so paths work from any directory | used in every hook command |

`settings.json` is shared (committed). `settings.local.json` is yours alone (git-ignored): permissions you clicked "always allow" on end up there. Lists such as `allow` merge across both files; deny beats ask beats allow at any level. The `.env` read deny also stops `cat`/`head`/`tail` on those files through Bash and blocks editing them, but not a script that opens the file itself — the guard hook is the second line.

## Security and limits

- **Hooks are code that runs on every teammate's machine** whenever they use Claude in this repo. Review changes to `.claude/hooks/` and `.claude/settings.json` like production code (a CODEOWNERS entry for `.claude/` is recommended).
- **The guard is a safety net, not a security boundary.** It catches the realistic mistakes (skipping the pre-commit gate, force-push, editing `.env`); someone determined can always get past a regex. Real secrets protection is the `.env` deny rule plus keeping service keys out of the repo.
- **Hooks fail open.** If Node is missing or a script crashes (any exit code except 2), the tool call goes ahead. That is deliberate: a broken reminder must never stop work. The tests below are what catch a broken hook.
- **Comments cost tokens outside `CLAUDE.md`.** Claude Code strips HTML comments only from `CLAUDE.md`. The short explanatory headers in rules, agents and skills are kept for people reading them, so keep them brief.
- **Agents' tool limits are real, their instructions are not.** `code-reviewer` and `mobile-contract-checker` have no Edit/Write tools; `live-tester` has them removed with `disallowedTools`. "Never run SQL" in `migration-author` is an instruction only.

## What this is called, and how to ask for it

The setup has no single official name. People call it a **Claude Code project configuration**, an **agent harness**, or **context engineering** (the broader practice of giving an AI the knowledge and guardrails it needs). The parts have exact names:

| Part | Software term | Lives in |
|---|---|---|
| Project overview | memory file / project instructions | `CLAUDE.md` |
| Detailed knowledge | rules (path-scoped memory) | `.claude/rules/` |
| Repeatable workflows | skills / slash commands | `.claude/skills/` |
| Specialist workers | subagents | `.claude/agents/` |
| Automatic enforcement | hooks (lifecycle events) | `.claude/hooks/` + `settings.json` |
| Allowed / denied actions | permissions | `settings.json` |
| External tools and data | MCP servers | `.mcp.json` |
| Bundle to share across repos | plugin | a plugin package |

To set this up on a project (any model or teammate), describe the goal and the parts. A prompt that works:

> Set up a production-grade Claude Code configuration for this repo. First read the code, the existing CLAUDE.md and the git log, and tell me what you found. Then propose, before creating anything: (1) a slim CLAUDE.md that indexes the rest; (2) path-scoped rules in `.claude/rules/` split by area; (3) subagents for the jobs that fill the context (testing, review, migrations); (4) skills for repeatable workflows; (5) hooks that enforce the rules that must never be broken, with blocking hooks only for clearly unsafe actions; (6) shared permissions in `.claude/settings.json`. Test every hook with sample input, comment each file so a newcomer can follow it, and don't invent rules the code doesn't follow.

Shortcuts: `/init` drafts a first `CLAUDE.md`; the `claude-automation-recommender` skill analyses a codebase and recommends hooks, agents and skills.

## Maintaining this

- **When a rule changes, edit the rule file** in the same commit as the code. A rule that disagrees with the code is worse than none.
- **Keep files short and specific.** Agents and skills follow concrete steps; long general advice gets skipped.
- **New area?** Add a rule file with `paths:` globs for its routes, components and tests, and a row in the `CLAUDE.md` index.
- **Changing a hook:** hooks run on every tool call, so they have tests: `npx vitest run test/claude-config` (part of `npm run test`, so the pre-commit gate runs them). Add a case for every new block or reminder — one that must trigger and one that must not. To try a single input by hand:
  `echo '{"tool_name":"Bash","tool_input":{"command":"git push -f"}}' | CLAUDE_PROJECT_DIR=$PWD node .claude/hooks/guard.mjs; echo $?` (2 = blocked).
  Reminders only add context and never block; a false positive costs one line, a false block stops work.
- **Health check:** `/doctor prompt-audit` (Claude Code 2.1.283+; this machine has 2.1.263 — run `claude update`) reports stale or conflicting instructions across these files.
- **The Flutter repo** (`../mobile_sslogistics`) has its own `CLAUDE.md`; the cross-repo contract lives in `../CLAUDE.md` (that folder is not a git repo).
