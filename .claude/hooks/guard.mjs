// ============================================================================
// guard.mjs — the "security guard"
//
// WHEN IT RUNS: just BEFORE Claude uses a tool (edit a file, run a command).
// WHAT IT DOES: refuses the few actions that are never right in this repo.
// HOW IT SAYS NO: exit code 2 + a reason on stderr. Claude sees the reason and
//                 picks another way. Exit code 0 (the default) means "go ahead".
//
// It is wired up in .claude/settings.json under "PreToolUse".
// Everything not refused here is handled by the permission lists in that file
// (e.g. `git push` is allowed here, but settings.json makes Claude ask first).
// ============================================================================
import { basename } from "node:path";
import { block, readInput } from "./lib.mjs";

// The system gives us one JSON note on stdin describing what Claude is about to
// do. Two examples of what that note contains:
//   { tool_name: "Edit",  tool_input: { file_path: "/repo/.env.local", ... } }
//   { tool_name: "Bash",  tool_input: { command: "git push -f origin main" } }
const input = readInput();
const tool = input.tool_name; // which tool: "Edit", "Write", "Bash", ...
const args = input.tool_input || {}; // the details: which file, which command

// ---------------------------------------------------------------------------
// GUARD 1 — never edit secret files
// ---------------------------------------------------------------------------
// If Claude is about to WRITE to a file (any of these four tools writes files)...
if (["Edit", "Write", "MultiEdit", "NotebookEdit"].includes(tool)) {
  // basename keeps only the file name:  "/a/b/.env.local"  ->  ".env.local"
  const name = basename(args.file_path || args.notebook_path || "");

  // The pattern matches: ".env", ".env.local", ".env.production"
  // It does NOT match:   "environment.ts", "my.env.ts"
  // ".env.example" is allowed because it holds no real secrets.
  if (/^\.env(\..+)?$/.test(name) && name !== ".env.example") {
    block(
      `Editing ${name} is blocked: it holds secrets (Supabase service key, Sentry token). ` +
        "Tell the user which variable to change and let them edit it.",
    );
  }
}

// ---------------------------------------------------------------------------
// GUARDS 2 and 3 — dangerous git commands (only checked for shell commands)
// ---------------------------------------------------------------------------
if (tool === "Bash") {
  const cmd = String(args.command || ""); // the full command text, e.g. "git commit -m 'x'"

  // Only commands that actually run git are checked, so searching for the text
  // (e.g.  grep -rn "no-verify" .claude ) is never blocked by mistake.
  const runsGit = /(^|[\s;&|(])git\s/.test(cmd);

  // GUARD 2 — never skip the pre-commit checks.
  // Every commit here runs lint, typecheck, tests, e2e and build (husky).
  // Ways to skip that, all blocked:
  //   git commit --no-verify -m "x"            <- long flag
  //   HUSKY=0 git commit -m "x"                <- turns husky off
  //   git commit -n -m "x" / -nm "x"           <- the short flag for --no-verify
  //   git -c core.hooksPath=/dev/null commit   <- points git at an empty hooks folder
  //   git config core.hooksPath ...            <- same, but permanently
  //
  // The `-n` pattern is the tricky one. It looks ONLY at the flags of the
  // `git commit` part and stops at a quote mark, so it never reads the message.
  // That way a harmless  git commit -m "Fix loans -n option"  is NOT blocked.
  // (`\b` = word boundary, `\s` = whitespace.)
  if (
    runsGit &&
    (/--no-verify\b|\bHUSKY=0\b|core\.hooksPath/.test(cmd) ||
      /\bgit\s+commit\b[^|;&"']*\s-[a-zA-Z]*n[a-zA-Z]*(\s|$)/.test(cmd))
  ) {
    block(
      "Skipping the pre-commit gate is blocked. Every commit runs lint, typecheck, unit, e2e and build; " +
        "fix what fails instead, or tell the user why it can't pass.",
    );
  }

  // GUARD 3 — never force-push.
  // A force push can erase other people's commits on the remote.
  // Blocked:  git push -f origin x  |  --force  |  --force-with-lease
  //           git push origin +feat/x   <- a "+" before the branch also forces
  // Allowed:  git push origin feat/x  (settings.json makes Claude ask you first)
  if (runsGit && /\bgit\s+push\b[^|;&]*(\s--force(-with-lease|-if-includes)?\b|\s-f\b|\s\+\S)/.test(cmd)) {
    block("Force-pushing is blocked. Ask the user to do it themselves if it is really needed.");
  }
}

// If nothing above matched, the script just ends: exit code 0 = "allowed".
