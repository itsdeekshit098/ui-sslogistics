// Tests for the Claude Code hooks in .claude/hooks/. They are plain Node
// scripts the harness runs on every tool call, so a broken one either blocks
// all work (guard) or silently stops checking (reminders). Each test feeds a
// script the same JSON the harness would send on stdin and checks the exit
// code (2 = blocked) and what it prints.
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const hook = (name: string) => join(root, ".claude", "hooks", `${name}.mjs`);

function run(name: string, input: unknown) {
  const r = spawnSync("node", [hook(name)], {
    input: JSON.stringify(input),
    env: { ...process.env, CLAUDE_PROJECT_DIR: root },
    encoding: "utf8",
  });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

const bash = (command: string) => ({ tool_name: "Bash", tool_input: { command } });
const edit = (file: string) => ({
  session_id: randomUUID(), // fresh session, so no reminder is deduped away
  tool_name: "Edit",
  tool_input: { file_path: join(root, file) },
});
const context = (stdout: string) =>
  stdout ? (JSON.parse(stdout).hookSpecificOutput.additionalContext as string) : "";

describe("guard.mjs (PreToolUse)", () => {
  it.each([
    [".env.local", 2],
    [".env", 2],
    [".env.production", 2],
    [".env.example", 0],
    ["src/lib/env.ts", 0],
  ])("editing %s exits %i", (file, code) => {
    expect(run("guard", { tool_name: "Write", tool_input: { file_path: join(root, file) } }).code).toBe(code);
  });

  it.each([
    "git commit --no-verify -m x",
    "HUSKY=0 git commit -m x",
    "git commit -n -m x",
    "git commit -nm x",
    "git -c core.hooksPath=/dev/null commit -m x",
    "git config core.hooksPath /tmp/none",
    "git add . && git commit --no-verify -m x",
  ])("blocks skipping the pre-commit gate: %s", (cmd) => {
    const r = run("guard", bash(cmd));
    expect(r.code).toBe(2);
    expect(r.stderr).toMatch(/pre-commit gate/);
  });

  it.each([
    "git push -f origin feat/x",
    "git push --force",
    "git push --force-with-lease origin x",
    "git push origin +feat/x",
  ])("blocks force-push: %s", (cmd) => {
    expect(run("guard", bash(cmd)).code).toBe(2);
  });

  it.each([
    'git commit -m "Fix loans -n option"',
    "git commit -m \"$(cat <<'EOF'\nHarden loans\n\nCo-Authored-By: x\nEOF\n)\"",
    "git push origin feat/x",
    "git push -u origin feat/x",
    'grep -rn "no-verify" .claude',
    "npm run test",
    "git status",
  ])("allows: %s", (cmd) => {
    expect(run("guard", bash(cmd)).code).toBe(0);
  });

  it("ignores tools it does not guard and a missing payload", () => {
    expect(run("guard", { tool_name: "Read", tool_input: { file_path: join(root, ".env.local") } }).code).toBe(0);
    expect(run("guard", {}).code).toBe(0);
  });
});

describe("reminders.mjs (PostToolUse)", () => {
  // A throwaway project laid out like this repo, with a sibling Flutter folder,
  // so these tests don't depend on which bugs the real code still has or on
  // ../mobile_sslogistics being checked out (it isn't on CI).
  const fixture = (() => {
    const parent = mkdtempSync(join(tmpdir(), "claude-hooks-"));
    const project = join(parent, "web");
    const write = (rel: string, text: string) => {
      mkdirSync(dirname(join(project, rel)), { recursive: true });
      writeFileSync(join(project, rel), text);
    };
    write(
      "src/app/api/loans/route.ts",
      [
        "export async function POST(req: Request) {",
        "  const body = await req.json();",
        "  const today = new Date().toISOString().slice(0, 10);",
        "  const id = Number(body.loanId);",
        "  query.or(`name.ilike.${body.q}`);",
        "  await requireAdminAuth();",
        "}",
      ].join("\n"),
    );
    write("sql/07_add_things.sql", "create table things (driver_id bigint references drivers(id));\n");
    write(".claude/rules/database-and-money.md", "currently up to `06_old.sql`\n");
    write("CLAUDE.md", "# fixture\n");
    mkdirSync(join(parent, "mobile_sslogistics", "lib", "features", "loans", "data"), { recursive: true });
    return project;
  })();
  const runIn = (file: string, session = randomUUID()) => {
    const r = spawnSync("node", [hook("reminders")], {
      input: JSON.stringify({ session_id: session, tool_name: "Edit", tool_input: { file_path: join(fixture, file) } }),
      env: { ...process.env, CLAUDE_PROJECT_DIR: fixture },
      encoding: "utf8",
    });
    return r.stdout;
  };

  it("flags every known bug class in a route", () => {
    const out = context(runIn("src/app/api/loans/route.ts"));
    expect(out).toMatch(/logActivity/); // mutating route without an audit entry
    expect(out).toMatch(/readJsonObject/); // req.json() -> 500
    expect(out).toMatch(/todayInIndia/); // UTC "today"
    expect(out).toMatch(/Number\.isInteger/); // Number(id) accepts 1.5
    expect(out).toMatch(/escapeLike/); // .or() from a template string
    expect(out).toMatch(/requireStrictAdminAuth/); // money route on the loose check
    expect(out).toMatch(/mobile_sslogistics\/lib\/features\/loans/); // Flutter reads it
  });

  it("checks a SQL file's header, rollback, RLS, delete check and number", () => {
    const out = context(runIn("sql/07_add_things.sql"));
    expect(out).toMatch(/`--` header/);
    expect(out).toMatch(/DOWN/);
    expect(out).toMatch(/row level security/);
    expect(out).toMatch(/dependentChecks/);
    expect(out).toMatch(/Latest SQL file is 7/);
  });

  it("says each reminder once per file per session", () => {
    const session = randomUUID();
    expect(runIn("src/app/api/loans/route.ts", session)).not.toBe("");
    expect(runIn("src/app/api/loans/route.ts", session)).toBe("");
  });

  // This one runs on the REAL repo on purpose: it fails the build if someone adds
  // a sql/ file without updating the number in .claude/rules/database-and-money.md.
  it("the real rule file names the newest sql/ file", () => {
    const newest = readdirSync(join(root, "sql"))
      .filter((f) => /^\d+_.+\.sql$/.test(f))
      .sort((a, b) => parseInt(a) - parseInt(b))
      .at(-1)!;
    const out = context(run("reminders", edit(`sql/${newest}`)).stdout);
    expect(out).not.toMatch(/Latest SQL file is/);
    expect(out).toMatch(/applied to Supabase by hand/);
  });

  it("stays silent for files outside the repo or not in scope", () => {
    expect(run("reminders", { tool_name: "Edit", tool_input: { file_path: "/tmp/x.ts" } }).stdout).toBe("");
    expect(run("reminders", edit("README.md")).stdout).toBe("");
  });
});

describe("session-start.mjs (SessionStart)", () => {
  it("runs cleanly and never claims zero commits are ahead", () => {
    const r = run("session-start", {});
    expect(r.code).toBe(0);
    expect(r.stdout).not.toMatch(/\b0 commit/);
  });
});

describe("settings.json", () => {
  const settings = JSON.parse(readFileSync(join(root, ".claude", "settings.json"), "utf8"));

  it("wires every hook script that exists", () => {
    const commands = JSON.stringify(settings.hooks);
    for (const name of ["guard", "reminders", "session-start"]) expect(commands).toContain(`${name}.mjs`);
  });

  it("never auto-allows pushing or denies less than the .env files", () => {
    expect(settings.permissions.allow.some((p: string) => p.startsWith("Bash(git push"))).toBe(false);
    expect(settings.permissions.ask).toContain("Bash(git push:*)");
    expect(settings.permissions.deny).toEqual(expect.arrayContaining(["Read(./.env)", "Read(./.env.*)"]));
  });
});
