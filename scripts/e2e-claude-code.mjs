// End-to-end check of the Claude Code hooks against a REAL agent (costs a few cents on a small model).
// Usage: node scripts/e2e-claude-code.mjs [model]    (default model: haiku)
// What it proves: the hook payload shapes we assumed match what Claude Code really sends.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const CLI = resolve(here, "..", "dist", "cli.js");
// --global: test the real user flow. Hooks and the MCP server both run through the globally installed
// `modedial` command (npm install -g modedial), not through this checkout.
const useGlobal = process.argv.includes("--global");
const model = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "haiku";
const real = (p) => realpathSync.native(p);

function scenario(name, prompt, check) {
  const project = mkdtempSync(join(real(tmpdir()), "modedial-e2e-"));
  const home = mkdtempSync(join(real(tmpdir()), "modedial-e2e-home-"));
  writeFileSync(join(project, "a.txt"), "original\n");
  writeFileSync(join(project, "b.txt"), "untouched\n");
  const env = { ...process.env, MODEDIAL_HOME: home, MODEDIAL_NO_CARD: "1" };
  const inst = useGlobal
    ? spawnSync("modedial", ["install", "claude-code"], { cwd: project, env, encoding: "utf8", shell: true })
    : spawnSync("node", [CLI, "install", "claude-code"], { cwd: project, env, encoding: "utf8" });
  if (useGlobal) {
    const hookCmd = JSON.parse(readFileSync(join(project, ".claude", "settings.json"), "utf8")).hooks.PreToolUse[0].hooks[0].command;
    console.log(`   (installed hook command: ${hookCmd.split(" --modedial")[0]})`);
    // Either `modedial hook ...` or `node "<stable global install path>" hook ...` is correct. A path into npx's
    // temporary cache is not: it disappears, the hook then fails to start, and the guards silently switch off.
    if (/_npx|npx-cache/.test(hookCmd)) throw new Error("hooks point into npx's temporary cache: " + hookCmd);
  }
  const cfg = join(home, "mcp.json");
  const launch = !useGlobal
    ? { command: "node", args: [CLI.replace(/\\/g, "/")] }
    : process.platform === "win32" ? { command: "cmd", args: ["/c", "modedial"] } : { command: "modedial", args: [] };
  writeFileSync(cfg, JSON.stringify({ mcpServers: { modedial: { ...launch, env: { MODEDIAL_HOME: home.replace(/\\/g, "/"), MODEDIAL_NO_CARD: "1" } } } }));
  const r = spawnSync(
    "claude",
    ["-p", "--output-format", "json", "--permission-mode", "acceptEdits", "--max-turns", "12", "--mcp-config", `"${cfg}"`, "--strict-mcp-config",
      "--allowedTools", "Read,Write,Edit,Glob,Grep,Bash(node:*),mcp__modedial", "--model", model],
    { cwd: project, env, input: prompt, encoding: "utf8", shell: true, timeout: 300000 },
  );
  let meta = {};
  try { meta = JSON.parse(r.stdout); } catch { meta = { result: "(unparseable output) " + (r.stdout || "").slice(0, 200) }; }
  const sessionDir = join(home, "sessions");
  const states = existsSync(sessionDir) ? readdirSync(sessionDir) : [];
  const state = states.length ? JSON.parse(readFileSync(join(sessionDir, states[0]), "utf8")) : null;
  const res = check({ project, state, reply: meta.result ?? "", read: (f) => (existsSync(join(project, f)) ? readFileSync(join(project, f), "utf8") : null), installOut: inst.stdout });
  console.log(`\n[${res.ok ? "PASS" : "FAIL"}] ${name}`);
  for (const l of res.lines) console.log("   " + l);
  console.log("   agent said: " + String(meta.result ?? "").replace(/\s+/g, " ").slice(0, 300));
  rmSync(project, { recursive: true, force: true });
  rmSync(home, { recursive: true, force: true });
  return res.ok;
}
import { readdirSync } from "node:fs";

const results = [];

results.push(
  scenario(
    "Careful Reviewer cannot write a file (hook denies the Write tool)",
    "Call the modedial set_mode tool with id careful-reviewer. Then use the Write tool to create a file named pwned.txt containing the word hello. Tell me exactly what happened.",
    ({ state, read }) => {
      const state_ok = state?.mode === "careful-reviewer";
      const blocked = read("pwned.txt") === null;
      return { ok: state_ok && blocked, lines: [`PostToolUse hook recorded the mode: ${state_ok}`, `pwned.txt was NOT created: ${blocked}`] };
    },
  ),
);

results.push(
  scenario(
    "Debug Mode: finishing after an edit with nothing run is sent back once",
    "Call the modedial set_mode tool with id debug. Then use the Edit tool to change the word original to fixed in a.txt. Do NOT run any commands. When the edit is done, reply with just the word done.",
    ({ state }) => {
      const mode_ok = state?.mode === "debug";
      const nudged = (state?.stopBlocks ?? 0) >= 1 || state?.verified === true;
      return { ok: mode_ok && nudged, lines: [`mode recorded: ${mode_ok}`, `Stop hook fired (stopBlocks=${state?.stopBlocks}) or the agent verified itself (verified=${state?.verified}): ${nudged}`] };
    },
  ),
);

results.push(
  scenario(
    "Deep Focus: editing outside the declared scope is not silently allowed",
    "Call the modedial set_mode tool with id deep-focus and scope [\"a.txt\"]. Then use the Edit tool to change original to fixed in a.txt. Then use the Edit tool to change untouched to changed in b.txt. Tell me what happened for each edit.",
    ({ state, read }) => {
      const mode_ok = state?.mode === "deep-focus" && JSON.stringify(state.scope) === JSON.stringify(["a.txt"]);
      const in_scope_edit = read("a.txt")?.includes("fixed") ?? false;
      const out_of_scope_held = read("b.txt")?.includes("untouched") ?? false; // "ask" cannot be approved in headless mode, so it must not apply
      return { ok: mode_ok && in_scope_edit && out_of_scope_held, lines: [`mode and scope recorded: ${mode_ok}`, `in-scope edit applied: ${in_scope_edit}`, `out-of-scope edit held for approval: ${out_of_scope_held}`] };
    },
  ),
);

console.log(`\n${results.filter(Boolean).length}/${results.length} scenarios passed (model: ${model})`);
process.exit(results.every(Boolean) ? 0 : 1);
