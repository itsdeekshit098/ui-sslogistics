// ============================================================================
// lib.mjs — small helpers shared by the other hook scripts
//
// A "hook" is a tiny program the system runs automatically. It receives one JSON
// note on stdin ("Claude is about to edit file X") and answers by:
//   - exit code 2 + message on stderr  -> BLOCK the action (PreToolUse only)
//   - JSON printed on stdout           -> add a note to Claude's context
//   - nothing / exit code 0            -> fine, carry on
// Docs: https://docs.claude.com/en/docs/claude-code/hooks
// ============================================================================
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

/** Read the JSON note from stdin. If it is missing or broken, use an empty note. */
export function readInput() {
  try {
    return JSON.parse(readFileSync(0, "utf8")); // file descriptor 0 = stdin
  } catch {
    return {}; // a hook must never crash the session, so fail quietly
  }
}

// The folder of the repo. Claude Code sets CLAUDE_PROJECT_DIR for every hook;
// process.cwd() is the fallback when we run a script by hand to test it.
export const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

/**
 * Turn an absolute path into a repo-relative one, or null if it is outside the repo.
 *   repoPath("/Users/me/ss/ui/src/app/api/loans/route.ts") -> "src/app/api/loans/route.ts"
 *   repoPath("/tmp/notes.txt")                              -> null  (outside the repo)
 */
export function repoPath(filePath) {
  if (!filePath) return null;
  const rel = relative(projectDir, filePath).split("\\").join("/");
  return rel.startsWith("..") ? null : rel; // ".." means "outside the project"
}

/**
 * Block the tool call. Exit code 2 is the special "no" signal; the text on
 * stderr is shown to Claude as the reason, so it can change course.
 */
export function block(reason) {
  process.stderr.write(reason + "\n");
  process.exit(2);
}

/**
 * Add short reminders to Claude's context AFTER it edited a file.
 * Never blocks; it only whispers.
 *
 * Each reminder is shown ONCE per file per chat. Why: if Claude edits the same
 * route ten times, hearing "use readJsonObject" ten times is just noise.
 * We remember what was already said in a small file in the temp folder, named
 * after the chat's session id (so each chat starts with a clean slate).
 *
 *   remind(input, "src/app/api/loans/route.ts", ["use todayInIndia()"])
 *   -> first call: Claude is told. Second call, same file + same text: silent.
 */
export function remind(input, file, messages) {
  const seenPath = join(tmpdir(), `claude-ss-hooks-${input.session_id || "nosession"}.json`);

  // Load the "already said" list (empty on the first call).
  let seen = {};
  try {
    seen = JSON.parse(readFileSync(seenPath, "utf8"));
  } catch {}

  // Keep only the reminders we haven't shown for this file yet.
  const fresh = messages.filter((m) => !seen[`${file}::${m}`]);
  if (fresh.length === 0) return; // nothing new to say

  // Remember them, so we don't repeat next time.
  for (const m of fresh) seen[`${file}::${m}`] = true;
  try {
    writeFileSync(seenPath, JSON.stringify(seen));
  } catch {}

  // Printing this exact JSON shape on stdout is how a PostToolUse hook adds
  // text to what Claude reads next. Claude sees it as a short bulleted note.
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: `Project checks for ${file}:\n- ${fresh.join("\n- ")}`,
      },
    }),
  );
}
