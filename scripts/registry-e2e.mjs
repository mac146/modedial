// Publish-rehearsal: runs a private npm registry (Verdaccio) on this machine, publishes the package to it,
// then does what real users do (npx, global install, the installer, hooks) against that registry.
// Nothing touches the public npm registry, your real global packages, or your agent settings.
// Usage: node scripts/registry-e2e.mjs
import { spawn, spawnSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const win = process.platform === "win32";
const publicMode = process.env.MODEDIAL_E2E_PUBLIC === "1" || process.argv.includes("--public"); // verify the PUBLISHED package on the real registry instead
const VERDACCIO = "verdaccio@6.2.4"; // 7.x requires Node 24; 6.x supports Node 18+
const work = realpathSync.native(mkdtempSync(join(tmpdir(), "modedial-reg-")));
const results = [];
let server;
let logFd;

// On Windows the command goes through cmd.exe, which splits arguments at spaces, so quote any argument that has one.
const quoteArg = (a) => (win && /\s/.test(a) && !/^".*"$/.test(a) ? `"${a}"` : a);
const sh = (cmd, args, o = {}) => spawnSync(cmd, win ? args.map(quoteArg) : args, { encoding: "utf8", shell: win, timeout: 300000, ...o });
const ok = (name, pass, detail = "") => {
  results.push(pass);
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${pass ? "" : "\n        " + String(detail).slice(0, 700).replace(/\n/g, "\n        ")}`);
};
const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); });
const stop = () => { if (!server) return; try { win ? spawnSync("taskkill", ["/PID", String(server.pid), "/T", "/F"]) : server.kill("SIGKILL"); } catch {} };
process.on("exit", stop);

const hasBin = (dir, bin) => [bin, `${bin}.cmd`, `${bin}.exe`, `${bin}.ps1`].some((n) => existsSync(join(dir, n)));
const pathWithout = (bin) => (process.env.PATH ?? process.env.Path ?? "").split(delimiter).filter((d) => d && !hasBin(d, bin)).join(delimiter);
const cleanBase = win ? ["C:\\Windows\\System32", "C:\\Windows", dirname(process.execPath)] : ["/usr/bin", "/bin", dirname(process.execPath)];

try {
  // ---- registry
  console.log(publicMode ? "PUBLIC MODE: checking the published package on the real npm registry (nothing is published)..." : "building, then starting a private registry (first run downloads Verdaccio)...");
  const build = publicMode ? { status: 0 } : sh("npm", ["run", "build"], { cwd: root });
  if (build.status !== 0) throw new Error("build failed: " + build.stderr);
  let base, port;
  const rc = join(work, "npmrc");
  if (!publicMode) {
  port = await freePort();
  const cfg = join(work, "verdaccio.yaml");
  writeFileSync(cfg, [
    `storage: ${join(work, "storage").replace(/\\/g, "/")}`,
    "auth:", "  htpasswd:", `    file: ${join(work, "htpasswd").replace(/\\/g, "/")}`, "    max_users: 50",
    "uplinks:", "  npmjs:", "    url: https://registry.npmjs.org/",
    "packages:",
    "  'modedial':", "    access: $all", "    publish: $authenticated", // no proxy: only OUR build, never the public one
    "  '@*/*':", "    access: $all", "    proxy: npmjs",
    "  '**':", "    access: $all", "    proxy: npmjs",
    "log: { type: stdout, format: pretty, level: error }",
  ].join("\n"));
  // Install Verdaccio into the temp folder and run it with plain Node: we then own the exact process (no npx or
  // shell wrapper), so it can be stopped precisely, and its output is kept for diagnosing a failed start.
  const vdDir = join(work, "vd");
  const vdInstall = sh("npm", ["install", VERDACCIO, "--prefix", vdDir, "--no-audit", "--no-fund", "--loglevel", "error"], { cwd: work });
  if (vdInstall.status !== 0) throw new Error("could not install Verdaccio: " + vdInstall.stderr);
  const vdLog = join(work, "verdaccio.log");
  logFd = openSync(vdLog, "w");
  server = spawn(process.execPath, [join(vdDir, "node_modules", "verdaccio", "bin", "verdaccio"), "--config", cfg, "--listen", `127.0.0.1:${port}`], { stdio: ["ignore", logFd, logFd], cwd: work });
  base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 120; i++) { try { if ((await fetch(`${base}/-/ping`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 1000)); if (i === 119) throw new Error("registry did not start. Its log:\n" + readFileSync(vdLog, "utf8").slice(0, 1500)); }
  const user = await (await fetch(`${base}/-/user/org.couchdb.user:e2e`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "e2e", password: "e2e-pass-123456", email: "e2e@example.com", type: "user" }) })).json();
  writeFileSync(rc, `registry=${base}/\n//127.0.0.1:${port}/:_authToken=${user.token}\n`);
  } else {
    writeFileSync(rc, "registry=https://registry.npmjs.org/" + String.fromCharCode(10));
  }
  // NPM_CONFIG_PREFIX points npm's global lookups at an empty folder, so a real global install of the same
  // version on this machine can never be picked up by npx in place of the package under test.
  const npmEnv = { ...process.env, NPM_CONFIG_PREFIX: join(work, "no-global"), NPM_CONFIG_USERCONFIG: rc, NPM_CONFIG_CACHE: join(work, "cache"), MODEDIAL_HOME: join(work, "home"), MODEDIAL_NO_CARD: "1" };

  const version = process.env.MODEDIAL_E2E_VERSION ?? JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
  if (publicMode) {
    // a fresh publish can take a few minutes to appear
    let seen = false;
    for (let i = 0; i < 20 && !seen; i++) { seen = sh("npm", ["pack", `modedial@${version}`, "--pack-destination", work, "--prefer-online"], { env: npmEnv }).status === 0; if (!seen) await new Promise((r) => setTimeout(r, 15000)); }
    ok(`modedial@${version} is available on the public registry`, seen);
  } else {
    const pub = sh("npm", ["publish", "--ignore-scripts"], { cwd: root, env: npmEnv });
    ok("publish to the private registry", pub.status === 0, pub.stderr);
  }
  const proj = (name) => { const d = join(work, name); mkdirSync(d, { recursive: true }); return d; };
  const run = (cmd, args, o = {}) => sh(cmd, args, { env: npmEnv, ...o });

  // ---- 1. npx basics, no global install anywhere on the PATH
  const noGlobalEnv = { ...npmEnv, PATH: pathWithout("modedial") };
  const p1 = proj("npx-basic");
  const list = run("npx", ["-y", `modedial@${version}`, "list"], { cwd: p1, env: noGlobalEnv });
  ok("npx: list shows 6 modes", list.status === 0 && list.stdout.trim().split("\n").length === 6, list.stderr + list.stdout);
  const help = run("npx", ["-y", `modedial@${version}`, "--help"], { cwd: p1, env: noGlobalEnv });
  ok("npx: --help documents install and uninstall", /install <agent\|all>/.test(help.stdout) && /uninstall/.test(help.stdout), help.stdout);

  // ---- 2. MCP over stdio, started the way an agent would (npx)
  const mcp = await new Promise((res) => {
    const p = spawn("npx", ["-y", `modedial@${version}`], { cwd: p1, env: noGlobalEnv, shell: win });
    let out = "";
    const msgs = [
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "e2e", version: "0" } } },
      { jsonrpc: "2.0", method: "notifications/initialized" },
      { jsonrpc: "2.0", id: 2, method: "tools/list" },
      { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "set_mode", arguments: { id: "careful-reviewer", scope: ["src"] } } },
    ];
    p.stdout.on("data", (d) => { out += d; if (out.split("\n").filter((l) => l.startsWith("{")).length >= 3) { p.kill(); res(out); } });
    p.stdin.write(msgs.map((m) => JSON.stringify(m)).join("\n") + "\n");
    setTimeout(() => { p.kill(); res(out); }, 90000);
  });
  const lines = String(mcp).split("\n").filter((l) => l.startsWith("{")).map((l) => { try { return JSON.parse(l); } catch { return {}; } });
  const tools = lines.find((l) => l.id === 2)?.result?.tools?.map((t) => t.name) ?? [];
  ok("npx: MCP server exposes the 5 tools (set_mode accepts scope)", ["list_modes", "set_mode", "current_mode", "end_mode", "recap"].every((t) => tools.includes(t)), JSON.stringify(tools));
  ok("npx: set_mode returns the mode and its guards", /Careful Reviewer/.test(lines.find((l) => l.id === 3)?.result?.content?.[0]?.text ?? "") && /read-only/.test(JSON.stringify(lines.find((l) => l.id === 3) ?? {})));

  // ---- 3. installer through npx with NO global install: must refuse, and write nothing
  const p3 = proj("npx-no-global");
  const refuse = run("npx", ["-y", `modedial@${version}`, "install", "claude-code"], { cwd: p3, env: noGlobalEnv });
  const wroteCmd = existsSync(join(p3, ".claude", "settings.json")) ? JSON.parse(readFileSync(join(p3, ".claude", "settings.json"), "utf8")).hooks.PreToolUse[0].hooks[0].command : "(none)";
  ok("npx install claude-code without a global install refuses with instructions", refuse.status !== 0 && /npm install -g modedial/.test(refuse.stderr + refuse.stdout), `status=${refuse.status} wrote hook command: ${wroteCmd}\nPATH had modedial dirs: ${(noGlobalEnv.PATH ?? "").split(delimiter).filter((d) => hasBin(d, "modedial")).length}`);
  ok("... and writes no settings file", !existsSync(join(p3, ".claude", "settings.json")));

  // ---- 4. real global install (into a temp prefix, so your real globals are untouched)
  const prefix = join(work, "global");
  const gi = run("npm", ["install", "-g", `modedial@${version}`, "--prefix", prefix], { cwd: work });
  ok("npm install -g (temp prefix)", gi.status === 0, gi.stderr);
  const globalBin = win ? prefix : join(prefix, "bin");
  const withGlobal = [globalBin, ...cleanBase].join(delimiter);
  const fullWithGlobal = [globalBin, pathWithout("modedial")].join(delimiter);
  const hookRun = (command, payload, env) => sh(command, [], { input: JSON.stringify(payload), env, cwd: work, shell: true });
  const reviewer = [
    { session_id: "reg1", tool_name: "mcp__modedial__set_mode", tool_input: { id: "careful-reviewer" } },
  ];
  const mustDeny = (command, env, label) => {
    const preCmd = command.replace(/ hook \S+/, " hook pre-tool-use");
    const postCmd = command.replace(/ hook \S+/, " hook post-tool-use");
    hookRun(postCmd, reviewer[0], env);
    const deny = hookRun(preCmd, { session_id: "reg1", tool_name: "Write", tool_input: { file_path: "a.txt" }, cwd: work }, env);
    ok(`${label}: the written hook command runs in a clean shell and denies a write`, /"permissionDecision":"deny"/.test(deny.stdout), `status=${deny.status} out=${deny.stdout} err=${deny.stderr}`);
    const pass = hookRun(preCmd, { session_id: "other-session", tool_name: "Write", tool_input: { file_path: "a.txt" }, cwd: work }, env);
    ok(`${label}: and stays silent when no mode is active`, pass.status === 0 && pass.stdout === "");
  };
  const readCmd = (dir) => JSON.parse(readFileSync(join(dir, ".claude", "settings.json"), "utf8")).hooks.PreToolUse[0].hooks[0].command;

  // 4a. installer run through the global command
  const p4 = proj("global-install");
  const gInst = run("modedial", ["install", "claude-code"], { cwd: p4, env: { ...npmEnv, PATH: fullWithGlobal } });
  ok("global `modedial install claude-code` succeeds", gInst.status === 0 && existsSync(join(p4, ".claude", "settings.json")), gInst.stderr + gInst.stdout);
  if (existsSync(join(p4, ".claude", "settings.json"))) mustDeny(readCmd(p4), { MODEDIAL_HOME: join(work, "home-a"), PATH: withGlobal, SystemRoot: process.env.SystemRoot ?? "" }, "global install");

  // 4b. THE bug that shipped in 0.1.1: installer run through npx while a real global exists
  const p5 = proj("npx-with-global");
  const viaNpx = run("npx", ["-y", `modedial@${version}`, "install", "claude-code"], { cwd: p5, env: { ...npmEnv, PATH: fullWithGlobal } });
  ok("npx install claude-code with a global install present succeeds", viaNpx.status === 0 && existsSync(join(p5, ".claude", "settings.json")), viaNpx.stderr + viaNpx.stdout);
  if (existsSync(join(p5, ".claude", "settings.json"))) {
    const cmd = readCmd(p5);
    ok("the command it wrote does not point into npx's temporary cache", !/_npx|npx-cache/.test(cmd), cmd);
    mustDeny(cmd, { MODEDIAL_HOME: join(work, "home-b"), PATH: withGlobal, SystemRoot: process.env.SystemRoot ?? "" }, "npx install + global");
  }

  // ---- 5. hook robustness through the real command: garbage in, silence out, exit 0
  const hookBase = { MODEDIAL_HOME: join(work, "home-c"), PATH: withGlobal, SystemRoot: process.env.SystemRoot ?? "" };
  const junk = ["", "not json", "{", "[]", "null", JSON.stringify({ tool_input: "x".repeat(200000) }), '{"session_id":"../../etc/passwd","tool_name":"Edit","tool_input":{"file_path":5}}'];
  const bad = junk.filter((input) => { const r = sh("modedial hook pre-tool-use", [], { input, env: hookBase, shell: true }); return r.status !== 0 || r.stdout !== ""; });
  ok("hook ignores garbage, empty and huge input (exit 0, no output)", bad.length === 0, `${bad.length} bad inputs`);
  const unknown = sh("modedial hook nonsense-event", [], { input: "{}", env: hookBase, shell: true });
  ok("hook ignores unknown events", unknown.status === 0 && unknown.stdout === "");

  // ---- 6. start-up cost of the hook command (the 3.4 s npx problem must never come back)
  const times = [];
  for (let i = 0; i < 5; i++) { const t = process.hrtime.bigint(); sh("modedial hook pre-tool-use", [], { input: "{}", env: hookBase, shell: true }); times.push(Number(process.hrtime.bigint() - t) / 1e6); }
  times.sort((a, b) => a - b);
  ok(`hook start-up median is under 1.5 s (measured ${times[2].toFixed(0)} ms)`, times[2] < 1500);

  // ---- 7. other agents through npx, then uninstall leaves nothing behind
  const p7 = proj("agents");
  const dry = run("npx", ["-y", `modedial@${version}`, "install", "all", "--dry-run"], { cwd: p7, env: noGlobalEnv });
  ok("npx install all --dry-run covers every agent and writes nothing", dry.status === 0 && /opencode/.test(dry.stdout) && /roo-code/.test(dry.stdout) && readdirSync(p7).length === 0, dry.stderr + dry.stdout.slice(0, 200));
  for (const agent of ["opencode", "cursor", "roo-code", "windsurf", "codex", "agents-md"]) {
    const d = proj(`agent-${agent}`);
    const i = run("npx", ["-y", `modedial@${version}`, "install", agent], { cwd: d, env: noGlobalEnv });
    const wrote = readdirSync(d).length > 0;
    const u = run("npx", ["-y", `modedial@${version}`, "uninstall", agent], { cwd: d, env: noGlobalEnv });
    const left = readdirSync(d).filter((f) => !f.endsWith(".bak"));
    ok(`${agent}: install writes files, uninstall removes them all`, i.status === 0 && wrote && u.status === 0 && left.length === 0, `${i.stderr}${u.stderr} left=${left}`);
  }

  // ---- 8. uninstall of the hooks
  const un = run("modedial", ["uninstall", "claude-code"], { cwd: p4, env: { ...npmEnv, PATH: fullWithGlobal } });
  const after = existsSync(join(p4, ".claude", "settings.json")) ? readFileSync(join(p4, ".claude", "settings.json"), "utf8") : "";
  ok("uninstall claude-code removes the hooks", un.status === 0 && !after.includes("--modedial"), un.stderr + after);
} catch (e) {
  ok("e2e harness", false, e.stack ?? e);
} finally {
  stop();
  try { if (logFd !== undefined) closeSync(logFd); } catch {}
  await new Promise((r) => setTimeout(r, 1500)); // let Windows release the folders the stopped processes used
  // Windows can hold a lock on a folder for a moment after a child process exits; retry, and never fail the run over cleanup.
  try { rmSync(work, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 }); } catch (e) { console.log(`(could not delete ${work}: ${e.code}; safe to delete by hand)`); }
}
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed${failed ? `, ${failed} FAILED` : ""}`);
process.exit(failed ? 1 : 0);
