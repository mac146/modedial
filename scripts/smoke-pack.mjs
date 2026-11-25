// Clean-room check of what users will actually get: pack the package, install the tarball into an empty
// folder, and exercise it. Runs the same on Windows, macOS and Linux. Usage: node scripts/smoke-pack.mjs
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const work = mkdtempSync(join(tmpdir(), "modedial-smoke-"));
const sh = process.platform === "win32";
let failed = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  " + detail}`);
  if (!ok) failed++;
};
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: "utf8", shell: sh, ...opts });

try {
  const packDir = join(work, "pack");
  mkdirSync(packDir);
  const pack = run("npm", ["pack", "--pack-destination", packDir], { cwd: root });
  check("npm pack", pack.status === 0, pack.stderr);
  const tgz = join(packDir, readdirSync(packDir).find((f) => f.endsWith(".tgz")));

  const proj = join(work, "proj");
  mkdirSync(proj);
  run("npm", ["init", "-y"], { cwd: proj });
  const inst = run("npm", ["install", `"${tgz}"`], { cwd: proj });
  check("npm install of the packed tarball", inst.status === 0, inst.stderr.slice(0, 300));

  const home = join(work, "home");
  const env = { ...process.env, MODEDIAL_HOME: home };
  const cli = join(proj, "node_modules", "modedial", "dist", "cli.js");
  const node = (args, input) => spawnSync(process.execPath, [cli, ...args], { cwd: proj, env, input, encoding: "utf8", timeout: 60000 });

  const list = node(["list"]);
  check("list shows 6 modes", list.status === 0 && list.stdout.trim().split("\n").length === 6, list.stderr);

  const agents = node(["install"]);
  check("install lists agents", /opencode/.test(agents.stdout) && /claude-code/.test(agents.stdout), agents.stderr);

  const dry = node(["install", "cursor", "--dry-run"]);
  check("install --dry-run works and writes nothing", /would create/.test(dry.stdout) && readdirSync(proj).every((f) => f !== ".cursor"), dry.stderr);

  // MCP over stdio
  const msgs = [
    { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "smoke", version: "0" } } },
    { jsonrpc: "2.0", method: "notifications/initialized" },
    { jsonrpc: "2.0", id: 2, method: "tools/list" },
    { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "set_mode", arguments: { id: "careful-reviewer" } } },
  ];
  const mcp = await new Promise((res) => {
    const p = spawn(process.execPath, [cli], { cwd: proj, env });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stdin.write(msgs.map((m) => JSON.stringify(m)).join("\n") + "\n");
    const t = setTimeout(() => { p.kill(); res(out); }, 25000);
    p.stdout.on("data", () => { if (out.split("\n").filter(Boolean).length >= 3) { clearTimeout(t); p.kill(); res(out); } });
  });
  const lines = String(mcp).split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return {}; } });
  const tools = lines.find((l) => l.id === 2)?.result?.tools?.map((t) => t.name) ?? [];
  check("MCP: 5 tools", ["list_modes", "set_mode", "current_mode", "end_mode", "recap"].every((t) => tools.includes(t)), JSON.stringify(tools));
  check("MCP: set_mode returns the mode", /Careful Reviewer/.test(lines.find((l) => l.id === 3)?.result?.content?.[0]?.text ?? ""));

  const card = node(["card", "--out", join(work, "card.png")]);
  check("card export (bundled fonts + renderer work on this OS)", card.status === 0, card.stderr.slice(0, 300));

  // hooks: reviewer mode must deny a write
  node(["hook", "post-tool-use"], JSON.stringify({ session_id: "smoke", tool_name: "mcp__modedial__set_mode", tool_input: { id: "careful-reviewer" } }));
  const deny = node(["hook", "pre-tool-use"], JSON.stringify({ session_id: "smoke", tool_name: "Write", tool_input: { file_path: "a.txt" }, cwd: proj }));
  check("hook denies a write in Careful Reviewer mode", /"permissionDecision":"deny"/.test(deny.stdout), deny.stdout + deny.stderr);
  const allow = node(["hook", "pre-tool-use"], JSON.stringify({ session_id: "other", tool_name: "Write", tool_input: { file_path: "a.txt" }, cwd: proj }));
  check("hook stays silent when no mode is active", allow.status === 0 && allow.stdout === "");
} finally {
  rmSync(work, { recursive: true, force: true });
}
console.log(failed ? `\n${failed} check(s) failed` : "\nall smoke checks passed");
process.exit(failed ? 1 : 0);
