// Pilot runner. Usage:
//   node bench/run.mjs --selfcheck
//   node bench/run.mjs --tasks paginate,dedupe --conds none,debug --reps 1 --out bench/results/smoke.jsonl
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TASKS } from "./tasks.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const CLI = resolve(here, "..", "dist", "cli.js").replace(/\\/g, "/");
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const has = (n) => process.argv.includes(n);

const GENERIC = "Be careful: keep your change small and confirm it works before you finish.";
const MODE_OF = { debug: "debug", "deep-focus": "deep-focus" };

// Reference solutions, used only by --selfcheck to prove each task is solvable.
const SOLUTIONS = {
  paginate: ["src/paginate.js", (s) => s.replace("start + size - 1", "start + size")],
  dedupe: ["src/dedupe.js", (s) => s.replace("seen.set(item.id, item);", "if (!seen.has(item.id)) seen.set(item.id, item);")],
  money: ["src/money.js", (s) => s.replace("Math.floor(total)", "Math.round(total)")],
  slug: ["src/slug.js", (s) => s.replace('.replace(/[^a-z0-9]/g, "-")', '.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")')],
};

function materialize(task) {
  const dir = mkdtempSync(join(tmpdir(), `bench-${task.id}-`));
  for (const [p, c] of Object.entries(task.files)) {
    mkdirSync(dirname(join(dir, p)), { recursive: true });
    writeFileSync(join(dir, p), c);
  }
  return dir;
}
const sha = (s) => createHash("sha256").update(s).digest("hex");
const runTest = (dir) => spawnSync("node", ["test.js"], { cwd: dir, timeout: 20000, encoding: "utf8" }).status === 0;

function check(task, dir) {
  const testIntact = sha(readFileSync(join(dir, "test.js"), "utf8")) === sha(task.files["test.js"]);
  const pass = testIntact && runTest(dir);
  let scope = 0;
  const changed = [];
  for (const [p, original] of Object.entries(task.files)) {
    const f = join(dir, p);
    const now = existsSync(f) ? readFileSync(f, "utf8") : null;
    if (now !== original && p !== "test.js") changed.push(p);
  }
  scope += changed.filter((p) => !task.allowed.includes(p)).length;
  for (const m of task.mustRemain) {
    const f = join(dir, m.file);
    if (!existsSync(f) || !readFileSync(f, "utf8").includes(m.snippet)) scope += 1;
  }
  return { pass, testIntact, scope, changed };
}

function buildPrompt(cond, task) {
  if (cond === "none") return task.prompt;
  if (cond === "generic") return `${GENERIC} ${task.prompt}`;
  return `First call the modedial set_mode tool with id ${MODE_OF[cond]} and follow its instructions. Then: ${task.prompt}`;
}

function runOne(task, cond, rep, out) {
  const dir = materialize(task);
  const home = join(dir, "..", `home-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  mkdirSync(home, { recursive: true });
  const cfg = join(home, "mcp.json");
  writeFileSync(cfg, JSON.stringify({ mcpServers: { modedial: { command: "node", args: [CLI], env: { MODEDIAL_HOME: home.replace(/\\/g, "/"), MODEDIAL_NO_CARD: "1" } } } }));
  const t0 = Date.now();
  const r = spawnSync(
    "claude",
    ["-p", "--output-format", "json", "--permission-mode", "acceptEdits", "--max-turns", "25", "--mcp-config", cfg, "--strict-mcp-config",
      "--allowedTools", "Read,Edit,Write,Glob,Grep,Bash(node:*),mcp__modedial"],
    { cwd: dir, input: buildPrompt(cond, task), encoding: "utf8", timeout: 420000, shell: true },
  );
  let meta = {};
  try { meta = JSON.parse(r.stdout); } catch { meta = { parse_error: true, stderr: (r.stderr || "").slice(0, 200) }; }
  const logFile = join(home, "log.jsonl");
  const modeCalled = existsSync(logFile) && /"e":"set"/.test(readFileSync(logFile, "utf8"));
  const c = check(task, dir);
  const row = {
    task: task.id, cond, rep, ...c, modeCalled,
    modeExpected: cond === "debug" || cond === "deep-focus",
    cost_usd: meta.total_cost_usd ?? null, turns: meta.num_turns ?? null, duration_ms: meta.duration_ms ?? Date.now() - t0,
    is_error: !!meta.is_error || !!meta.parse_error || r.status !== 0, ts: new Date().toISOString(),
  };
  mkdirSync(dirname(out), { recursive: true });
  appendFileSync(out, JSON.stringify(row) + "\n");
  rmSync(dir, { recursive: true, force: true });
  rmSync(home, { recursive: true, force: true });
  return row;
}

if (has("--selfcheck")) {
  let ok = true;
  for (const t of TASKS) {
    const d = materialize(t);
    const failsBefore = !runTest(d);
    const [p, fix] = SOLUTIONS[t.id];
    writeFileSync(join(d, p), fix(t.files[p]));
    const c = check(t, d);
    const good = failsBefore && c.pass && c.scope === 0;
    ok &&= good;
    console.log(`${t.id}: fails-before=${failsBefore} passes-after-reference=${c.pass} scope=${c.scope} -> ${good ? "OK" : "BAD"}`);
    rmSync(d, { recursive: true, force: true });
  }
  process.exit(ok ? 0 : 1);
}

const tasks = (arg("--tasks", "all") === "all" ? TASKS : TASKS.filter((t) => arg("--tasks").split(",").includes(t.id)));
const conds = arg("--conds", "none,debug,deep-focus,generic").split(",");
const reps = +arg("--reps", "1");
const out = arg("--out", "bench/results/run.jsonl");
// interleave conditions so any drift in the service affects all conditions evenly
for (let rep = 1; rep <= reps; rep++)
  for (const t of tasks)
    for (const c of conds) {
      const r = runOne(t, c, rep, out);
      console.log(`${t.id}/${c}/#${rep}: pass=${r.pass} scope=${r.scope} turns=${r.turns} cost=${r.cost_usd} ${Math.round(r.duration_ms / 1000)}s modeCalled=${r.modeCalled}${r.is_error ? " ERROR" : ""}`);
    }
