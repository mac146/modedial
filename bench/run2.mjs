// Pilot 2 runner. Usage:
//   node bench/run2.mjs --selfcheck
//   node bench/run2.mjs --model haiku --reps 5 --out bench/results/pilot2-haiku.jsonl
//   (optional) --tasks cart,memo  --conds none,debug
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TASKS2 } from "./tasks2.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const CLI = resolve(here, "..", "dist", "cli.js").replace(/\\/g, "/");
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const has = (n) => process.argv.includes(n);

const GENERIC = { fix: "Be careful: keep your change small and confirm it works before you finish.", review: "Be thorough: check correctness, security and edge cases." };
const CONDS = { fix: ["none", "generic", "debug", "deep-focus"], review: ["none", "generic", "careful-reviewer"] };
const sha = (s) => createHash("sha256").update(s).digest("hex");

function materialize(task) {
  const dir = mkdtempSync(join(tmpdir(), `bench2-${task.id}-`));
  for (const [p, c] of Object.entries(task.files)) {
    mkdirSync(dirname(join(dir, p)), { recursive: true });
    writeFileSync(join(dir, p), c);
  }
  return dir;
}
function walk(dir, base = dir, out = []) {
  for (const e of readdirSync(dir)) {
    if (e === "node_modules" || e === ".git" || e.startsWith(".claude")) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, base, out);
    else out.push(relative(base, p).replace(/\\/g, "/"));
  }
  return out;
}
const runNode = (dir, file) => spawnSync("node", [file], { cwd: dir, timeout: 20000, encoding: "utf8" }).status === 0;

export function scoreReview(task, text) {
  const hits = task.seeded.map((s) => s.re.test(text));
  return { found: hits.filter(Boolean).length, hits };
}

function check(task, dir, reply) {
  const testIntact = !task.files["test.js"] || sha(readFileSync(join(dir, "test.js"), "utf8")) === sha(task.files["test.js"]);
  const changed = [];
  for (const [p, original] of Object.entries(task.files)) {
    const f = join(dir, p);
    const now = existsSync(f) ? readFileSync(f, "utf8") : null;
    if (now !== original && p !== "test.js") changed.push(p);
  }
  const created = walk(dir).filter((p) => !(p in task.files) && p !== "__hidden.test.js");
  let scope = changed.filter((p) => !task.allowed.includes(p)).length + created.filter((p) => !task.allowed.includes(p)).length;
  for (const m of task.mustRemain) {
    const f = join(dir, m.file);
    if (!existsSync(f) || !readFileSync(f, "utf8").includes(m.snippet)) scope += 1;
  }
  if (task.kind === "review") {
    const { found, hits } = scoreReview(task, reply || "");
    return { testIntact, scope, changed, created, found, hits, seededTotal: task.seeded.length };
  }
  const visible = testIntact && runNode(dir, "test.js");
  writeFileSync(join(dir, "__hidden.test.js"), task.hidden);
  const hidden = runNode(dir, "__hidden.test.js");
  return { testIntact, scope, changed, created, visible, hidden, pass: visible && hidden };
}

function buildPrompt(cond, task) {
  if (cond === "none") return task.prompt;
  if (cond === "generic") return `${GENERIC[task.kind]} ${task.prompt}`;
  return `First call the modedial set_mode tool with id ${cond} and follow its instructions. Then: ${task.prompt}`;
}

function runOne(task, cond, rep, model, out) {
  const dir = materialize(task);
  const home = mkdtempSync(join(tmpdir(), "bench2-home-"));
  const cfg = join(home, "mcp.json");
  writeFileSync(cfg, JSON.stringify({ mcpServers: { modedial: { command: "node", args: [CLI], env: { MODEDIAL_HOME: home.replace(/\\/g, "/"), MODEDIAL_NO_CARD: "1" } } } }));
  const t0 = Date.now();
  const args = ["-p", "--output-format", "json", "--permission-mode", "acceptEdits", "--max-turns", "25", "--mcp-config", cfg, "--strict-mcp-config",
    "--allowedTools", "Read,Edit,Write,Glob,Grep,Bash(node:*),Bash(npm:*),mcp__modedial"];
  if (model) args.push("--model", model);
  const r = spawnSync("claude", args, { cwd: dir, input: buildPrompt(cond, task), encoding: "utf8", timeout: 420000, shell: true });
  let meta = {};
  try { meta = JSON.parse(r.stdout); } catch { meta = { parse_error: true }; }
  const logFile = join(home, "log.jsonl");
  const modeCalled = existsSync(logFile) && /"e":"set"/.test(readFileSync(logFile, "utf8"));
  const reply = typeof meta.result === "string" ? meta.result : "";
  const c = check(task, dir, reply);
  const row = {
    model: model || "default", task: task.id, kind: task.kind, cond, rep, ...c, modeCalled,
    modeExpected: !["none", "generic"].includes(cond),
    reply_words: reply.split(/\s+/).filter(Boolean).length,
    reply: task.kind === "review" ? reply.slice(0, 6000) : undefined,
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
  for (const t of TASKS2) {
    if (t.kind === "review") {
      const good = scoreReview(t, t.referenceReview).found, none = scoreReview(t, "Looks good to me, nice cleanup.").found;
      const d = materialize(t);
      const c = check(t, d, "");
      const g = good === t.seeded.length && none === 0 && c.scope === 0;
      ok &&= g;
      console.log(`${t.id}: reference review finds ${good}/${t.seeded.length}, empty review finds ${none}, scope=${c.scope} -> ${g ? "OK" : "BAD"}`);
      rmSync(d, { recursive: true, force: true });
      continue;
    }
    const d = materialize(t);
    writeFileSync(join(d, "__hidden.test.js"), t.hidden);
    const failsVisible = !runNode(d, "test.js"), failsHidden = !runNode(d, "__hidden.test.js");
    for (const [p, fix] of Object.entries(t.solution)) writeFileSync(join(d, p), fix(t.files[p]));
    const c = check(t, d, "");
    const g = failsVisible && failsHidden && c.visible && c.hidden && c.scope === 0;
    ok &&= g;
    console.log(`${t.id}: visible fails first=${failsVisible} hidden fails first=${failsHidden} | after reference: visible=${c.visible} hidden=${c.hidden} scope=${c.scope} -> ${g ? "OK" : "BAD"}`);
    rmSync(d, { recursive: true, force: true });
  }
  process.exit(ok ? 0 : 1);
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}` || process.argv[1].endsWith("run2.mjs")) {
  if (!has("--selfcheck")) {
    const tasks = arg("--tasks", "all") === "all" ? TASKS2 : TASKS2.filter((t) => arg("--tasks").split(",").includes(t.id));
    const conds = arg("--conds", "none,generic,debug,deep-focus,careful-reviewer").split(",");
    const reps = +arg("--reps", "1");
    const model = arg("--model", "");
    const out = arg("--out", "bench/results/pilot2.jsonl");
    // interleave so service drift hits every condition evenly
    for (let rep = 1; rep <= reps; rep++)
      for (const t of tasks)
        for (const c of conds.filter((c) => CONDS[t.kind].includes(c))) {
          const r = runOne(t, c, rep, model, out);
          const m = r.kind === "review" ? `found=${r.found}/${r.seededTotal}` : `visible=${r.visible} hidden=${r.hidden}`;
          console.log(`${model || "default"} ${t.id}/${c}/#${rep}: ${m} scope=${r.scope} turns=${r.turns} cost=${r.cost_usd} ${Math.round(r.duration_ms / 1000)}s modeCalled=${r.modeCalled}${r.is_error ? " ERROR" : ""}`);
        }
  }
}
