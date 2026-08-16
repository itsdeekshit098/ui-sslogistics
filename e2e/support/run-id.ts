import fs from "fs";
import path from "path";

/**
 * Every record this suite creates carries the run prefix somewhere
 * identifiable (an entity/lender/client's `name`, a loan's `loan_number`, a
 * funding's `notes`) — global-teardown.ts greps for it to sweep up anything
 * a failed test's own cleanup didn't reach.
 *
 * global-setup, global-teardown and each worker are separate Node processes,
 * so the prefix is generated once in global-setup and persisted to disk for
 * everyone else to read. It's read lazily (a function, not a module-level
 * constant) rather than cached at import time: Playwright's test-discovery
 * pass imports spec files — and transitively this module — before
 * global-setup has written the run's actual prefix, and possibly in the same
 * process global-teardown later runs in. A top-level `const` computed at
 * that first import freezes whatever was on disk at that moment (a stale
 * prefix from a previous run, or nothing) into every later reference,
 * regardless of what global-setup writes afterward — this happened for real
 * during development: global-teardown's own log showed one prefix while the
 * records worker processes had actually created that run carried another.
 * A function call re-reads the file every time instead, so there's no
 * import-order race to get wrong.
 */
const PREFIX_FILE = path.resolve(__dirname, "../.auth/run-prefix.txt");

export function generateRunPrefix(): string {
  const prefix = `E2E_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  fs.mkdirSync(path.dirname(PREFIX_FILE), { recursive: true });
  fs.writeFileSync(PREFIX_FILE, prefix);
  return prefix;
}

export function getRunPrefix(): string {
  return fs.existsSync(PREFIX_FILE)
    ? fs.readFileSync(PREFIX_FILE, "utf8").trim()
    : generateRunPrefix();
}

/**
 * A unique, greppable label for one test's records, e.g.
 * "E2E_m1a2b3_x7y8 Borrower jk3f9x". Suffixed with randomness rather than a
 * monotonic counter — `fullyParallel: true` runs this file's `beforeAll`
 * hooks in more than one worker process, each with its own counter starting
 * from zero, so two workers calling `testLabel("Borrower")` first would
 * otherwise generate the exact same name and collide on a real uniqueness
 * constraint (as happened once already).
 */
export function testLabel(hint: string): string {
  return `${getRunPrefix()} ${hint} ${Math.random().toString(36).slice(2, 8)}`;
}
