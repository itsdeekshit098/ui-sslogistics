// ============================================================================
// reminders.mjs — the "proofreader"
//
// WHEN IT RUNS: just AFTER Claude edits or creates a file.
// WHAT IT DOES: reads the file and looks for mistakes this project has made
//               before. For each one it finds, it whispers a one-line reminder
//               to Claude. It NEVER blocks: a reminder can be a false alarm, and
//               the code-reviewer agent has the final say.
//
// Example: Claude edits src/app/api/loans/route.ts and the file contains
//   new Date().toISOString().slice(0, 10)
// -> Claude is told: "that date is UTC; use todayInIndia() instead".
//
// Each reminder is shown once per file per chat (see remind() in lib.mjs).
// It is wired up in .claude/settings.json under "PostToolUse".
// ============================================================================
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { projectDir, readInput, remind, repoPath } from "./lib.mjs";

const input = readInput();

// Which file did Claude just touch? (null if it is outside this repo)
const file = repoPath(input.tool_input?.file_path);
if (!file || !existsSync(join(projectDir, file))) process.exit(0); // nothing to check

const src = readFileSync(join(projectDir, file), "utf8"); // the file's full text
const notes = []; // reminders we collect; sent at the very end

// Is this file in a COMMIT? (used for the "don't edit old SQL" check)
// Not `git ls-files`: that also counts a file that is only staged (`git add`),
// which is still a draft and safe to edit.
function isCommitted(path) {
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%h", "--", path], {
      cwd: projectDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return out.trim() !== ""; // a commit touched it
  } catch {
    return false; // not a git repo, or git failed: don't nag
  }
}

// ============================================================================
// PART 1 — SQL files in sql/   (e.g. sql/54_add_diesel_limits.sql)
// Why so strict: SQL here is applied to Supabase BY HAND, one time, so a mistake
// in the file is expensive and there is no tool to catch it.
// ============================================================================
const sqlMatch = file.match(/^sql\/(\d+)_.+\.sql$/); // matches "sql/<number>_<name>.sql"
if (sqlMatch) {
  // Every file must open with a "--" comment saying WHY the change exists.
  if (!/^\s*--/.test(src)) notes.push("Start the file with a `--` header explaining why the change is needed.");

  // Every file must be undoable: a commented-out "-- DOWN" section with the rollback.
  if (!/--\s*DOWN/i.test(src)) notes.push("Add a commented-out `-- DOWN` rollback section.");

  // A new table must turn on row level security (RLS), with no policies.
  // That makes it deny-all for the public; only our server (service role) can use it.
  if (/create\s+table/i.test(src) && !/enable\s+row\s+level\s+security/i.test(src)) {
    notes.push("New tables need `enable row level security` with no policies (all access is service-role).");
  }

  // A table that points at drivers(id) means deleting a driver can now fail with
  // an ugly 500. The delete route must list the table so it shows a friendly message.
  //   e.g.  driver_id bigint references drivers(id)
  if (/references\s+(public\.)?drivers\s*\(/i.test(src)) {
    notes.push("This references drivers(id): add the table to `dependentChecks` in src/app/api/drivers/route.ts in this change.");
  }
  // Same rule for vehicles.
  if (/references\s+(public\.)?vehicles\s*\(/i.test(src)) {
    notes.push("This references vehicles(id): add the table to the delete check in src/app/api/vehicles/route.ts in this change.");
  }

  // Postgres rule: "create or replace view" may only ADD columns at the end. It
  // cannot remove, rename or reorder existing ones.
  if (/create\s+or\s+replace\s+view/i.test(src)) {
    notes.push("`create or replace view` cannot drop, rename or reorder existing columns — keep the old column list and only append.");
  }

  // If the file is already committed, it may ALREADY be applied in Supabase.
  // Editing it changes the file but not the database, so they drift apart.
  // The safe way is a new numbered file.
  if (isCommitted(file)) {
    notes.push("This SQL file is already committed and may already be applied to Supabase. Prefer a new numbered file over editing it.");
  }

  // The rule file says "currently up to `52_...`" — the ONE place that number
  // lives (keeping it in two places is how it drifted before). Find the highest
  // number on disk and warn if the rule file names a different one.
  const latest = Math.max(
    ...readdirSync(join(projectDir, "sql"))
      .map((f) => Number(f.match(/^(\d+)_/)?.[1])) // "52_vehicle_x.sql" -> 52
      .filter(Number.isFinite), // drop files with no number
  );
  const rulePath = join(projectDir, ".claude", "rules", "database-and-money.md");
  const rule = existsSync(rulePath) ? readFileSync(rulePath, "utf8") : "";
  if (!new RegExp(`up to \`${latest}_`).test(rule)) {
    notes.push(`Latest SQL file is ${latest}: update "currently up to" in .claude/rules/database-and-money.md (the only place that number is kept).`);
  }

  // Always said for SQL: Claude can't run it, the user has to.
  notes.push("SQL is applied to Supabase by hand. Tell the user to apply it, and keep a PGRST205/42P01 fallback in routes until they have.");
}

// ============================================================================
// PART 2 — API routes   (e.g. src/app/api/loans/route.ts)
// These are the bug types found again and again during live testing.
// ============================================================================
if (/^src\/app\/api\/.+\/route\.ts$/.test(file)) {
  // Does the file define a write method (POST/PUT/PATCH/DELETE)?
  const mutates = /export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)\b/.test(src);
  // Small self-service routes (own notifications, login) are allowed to skip the audit log.
  const selfService = /notifications\/|auth\//.test(file);

  // Every write must be recorded in the activity log, so "who changed what" is traceable.
  if (mutates && !selfService && !/logActivity\s*\(/.test(src)) {
    notes.push("Mutating route with no logActivity(): add an AuditAction literal in src/lib/activityLog.ts and log it.");
  }

  // `await req.json()` THROWS if the client sends broken JSON, giving a 500.
  // It should be a clean 400 "bad request". readJsonObject() does that safely.
  if (/\b(req|request)\.json\(\)/.test(src)) {
    notes.push("`req.json()` throws a 500 on malformed JSON — use readJsonObject() from src/lib/apiResponse.ts and answer 400.");
  }

  // `.or(\`name.ilike.${text}\`)` pastes user text into a database filter.
  // A comma or bracket typed by the user can change the filter's meaning
  // (like SQL injection). Values must be validated numbers or escaped first.
  if (/\.or\(\s*`/.test(src)) {
    notes.push("A PostgREST `.or()` is built from a template string: check every interpolated value is a validated integer or passed through escapeLike(), since commas/parentheses in user text change the filter.");
  }

  // "Today" taken from the server clock in UTC is wrong for India (UTC+5:30):
  // between midnight and 5:30am IST it gives YESTERDAY's date.
  // (A month-end built with Date.UTC(...) is fine, so only `new Date()` is flagged.)
  if (/new Date\(\)\.toISOString\(\)\s*\.(slice\(0,\s*10\)|split\(["']T["']\))/.test(src)) {
    notes.push("A date from toISOString() is UTC; for 'today' use todayInIndia() from src/lib/dateOnly.ts.");
  }

  // `Number("1.5")` is 1.5 and `Number("")` is 0: both pass as "a number" but are
  // not valid ids. An id must be a whole number above zero.
  //   matches  Number(id)  Number(params.id)  Number(body.loan_id)  Number(driverIdParam)
  if (/Number\(\s*[\w.]*[iI]d\w*\s*\)/.test(src) && !/Number\.isInteger|parseId\(/.test(src)) {
    notes.push("An id parsed with Number() accepts 1.5 and \"\" — check Number.isInteger(id) && id > 0 (see parseId in src/app/api/loans/loans.utils.ts).");
  }

  // Money routes must be admin-only on EVERY method, even reading (GET).
  // `requireAdminAuth` also lets staff in; money needs the strict version.
  if (/requireAdminAuth\(/.test(src) && /api\/(loans|fundings|clients|lenders|lookups|bank-accounts|driver-salaries)\//.test(file)) {
    notes.push("Money-module routes use requireStrictAdminAuth() on every method, GET included.");
  }

  // The Flutter app calls these same routes. If the route's response changed,
  // the app can break. Work out which Flutter folder matches this route:
  //   /api/driver-attendance -> lib/features/attendance   (a few names differ)
  //   /api/trip-bookings     -> lib/features/trip_bookings (dashes become _)
  const segment = file.split("/")[3]; // "src/app/api/<segment>/..."
  const feature = { "driver-attendance": "attendance", "driver-salaries": "salaries", "vehicle-owners": "owners" }[segment] ??
    segment.replace(/-/g, "_");
  const dataDir = join(projectDir, "..", "mobile_sslogistics", "lib", "features", feature, "data");
  if (existsSync(dataDir)) {
    // Only mention it if that Flutter folder really exists.
    notes.push(`The Flutter app reads this route (../mobile_sslogistics/lib/features/${feature}/data/). If the response shape changed, run the mobile-contract-checker agent.`);
  }
}

// ============================================================================
// Send whatever we collected (silent if the list is empty).
// remind() skips anything already said for this file in this chat.
// ============================================================================
if (notes.length) remind(input, file, notes);
