// ============================================================================
// session-start.mjs — the "morning briefing"
//
// WHEN IT RUNS: once, when a new chat starts (or resumes).
// WHAT IT DOES: prints a few lines about the repo's state. For this hook type,
//               anything printed on stdout is added to Claude's context.
// WHY: these facts are easy to forget between chats, and forgetting them causes
//      real mistakes. Example: relying on a SQL file the user never applied.
//
// Example output:
//   SS Logistics session state:
//   - Branch: feat/mobile-web-parity (12 commits ahead of origin/main, not pushed).
//   - Uncommitted SQL: sql/53_example.sql. These are applied ...
//   - 29 uncommitted file(s) in the working tree.
// ============================================================================
import { execFileSync } from "node:child_process";
import { projectDir } from "./lib.mjs";

// Run a git command and return its text. If git fails (not a repo, no remote
// called origin/main...), return "" so the briefing just skips that line.
function git(...args) {
  try {
    return execFileSync("git", args, { cwd: projectDir, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

const lines = []; // the bullet points we will print

// Line 1 — which branch, and whether commits are waiting to be pushed.
//   `@{u}` is the branch this one pushes to (its "upstream"), e.g. origin/feat/x.
//   `rev-list --count A..B` = "how many commits B has that A doesn't".
// A branch that was never pushed has no upstream, so compare with origin/main.
const branch = git("rev-parse", "--abbrev-ref", "HEAD");
if (branch) {
  const upstream = git("rev-parse", "--abbrev-ref", "@{u}");
  const base = upstream || "origin/main";
  const ahead = Number(git("rev-list", "--count", `${base}..HEAD`)) || 0;
  const note = ahead > 0 ? ` — ${ahead} commit(s) not on ${base}` : "";
  lines.push(`Branch: ${branch}${upstream ? "" : " (never pushed)"}${note}.`);
}

// Line 2 — SQL files that are new or changed but not committed.
// There is no migration runner: the user pastes each SQL file into Supabase by
// hand. So "uncommitted SQL" is the most likely thing to be not-yet-applied, and
// code that depends on it would fail. `--porcelain` gives lines like
// "?? sql/53_x.sql"; slice(3) cuts the 3-character status prefix off.
const sqlChanges = git("status", "--porcelain", "--", "sql/")
  .split("\n")
  .filter(Boolean)
  .map((l) => l.slice(3));
if (sqlChanges.length) {
  lines.push(
    `Uncommitted SQL: ${sqlChanges.join(", ")}. These are applied to Supabase by hand — ask the user whether they have been applied before relying on them.`,
  );
}

// Line 3 — how many files have uncommitted changes (a quick "is the tree clean?").
const dirty = git("status", "--porcelain").split("\n").filter(Boolean).length;
if (dirty) lines.push(`${dirty} uncommitted file(s) in the working tree.`);

// Print only if there is something to say; a clean repo stays silent.
if (lines.length) process.stdout.write(`SS Logistics session state:\n- ${lines.join("\n- ")}\n`);
