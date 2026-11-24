import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runInstall } from "../src/installCmd.js";
import { loadModes } from "../src/modes.js";
import { AGENTS, BLOCK_END, BLOCK_START, applyPlan, planFor, snippet, type Ctx } from "../src/targets.js";

const modes = loadModes();
let dir: string, home: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "modedial-tg-"));
  home = mkdtempSync(join(tmpdir(), "modedial-home-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  rmSync(home, { recursive: true, force: true });
});
const ctx = (scope: "project" | "user" = "project"): Ctx => ({ cwd: dir, home, scope, modes, mcp: { command: "node", args: ["/x/cli.js"] } });
const files = (root = dir): string[] => {
  const out: string[] = [];
  const walk = (d: string) => readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(join(d, e.name)) : out.push(join(d, e.name).slice(root.length + 1).replace(/\\/g, "/"))));
  walk(root);
  return out.sort();
};
const install = (agent: string, extra: string[] = []) => runInstall("install", [agent, ...extra], { cwd: dir, home, mcp: { command: "node", args: ["/x/cli.js"] } });
const uninstall = (agent: string, extra: string[] = []) => runInstall("uninstall", [agent, ...extra], { cwd: dir, home, mcp: { command: "node", args: ["/x/cli.js"] } });
const frontmatter = (text: string) => {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  expect(m, "has YAML frontmatter").not.toBeNull();
  return m![1]!;
};

describe("every agent", () => {
  it.each(AGENTS)("%s: installs, is idempotent, and uninstall leaves nothing behind", (agent) => {
    install(agent);
    const after1 = files().filter((f) => !f.endsWith(".bak"));
    expect(after1.length, "wrote something").toBeGreaterThan(0);
    const snapshot = Object.fromEntries(after1.map((f) => [f, readFileSync(join(dir, f), "utf8")]));
    install(agent); // second run must change nothing
    for (const f of after1) expect(readFileSync(join(dir, f), "utf8"), f).toBe(snapshot[f]);
    expect(files().filter((f) => !f.endsWith(".bak"))).toEqual(after1);
    uninstall(agent);
    expect(files().filter((f) => !f.endsWith(".bak")), "uninstall removes everything we added").toEqual([]);
  });

  it.each(AGENTS)("%s: dry run writes nothing", (agent) => {
    const out = install(agent, ["--dry-run"]);
    expect(files()).toEqual([]);
    expect(out).toMatch(/would/);
  });

  it.each(AGENTS)("%s: states its enforcement and how well it is verified", (agent) => {
    const p = planFor(agent, ctx());
    expect(p.enforcement.length).toBeGreaterThan(10);
    expect(["tested", "docs", "unverified"]).toContain(p.confidence);
  });
});

describe("shared files are edited, not replaced", () => {
  it("AGENTS.md keeps the user's text and gets one block", () => {
    writeFileSync(join(dir, "AGENTS.md"), "# My project\n\nUse tabs.\n");
    install("agents-md");
    const t = readFileSync(join(dir, "AGENTS.md"), "utf8");
    expect(t).toContain("Use tabs.");
    expect(t.split(BLOCK_START).length - 1).toBe(1);
    install("agents-md");
    expect(readFileSync(join(dir, "AGENTS.md"), "utf8").split(BLOCK_START).length - 1).toBe(1);
    uninstall("agents-md");
    expect(readFileSync(join(dir, "AGENTS.md"), "utf8").trim()).toBe("# My project\n\nUse tabs.".trim());
  });

  it("a new AGENTS.md is deleted again on uninstall, an existing one is not", () => {
    install("agents-md");
    expect(existsSync(join(dir, "AGENTS.md"))).toBe(true);
    uninstall("agents-md");
    expect(existsSync(join(dir, "AGENTS.md"))).toBe(false);
  });

  it("JSON configs keep the user's other servers and settings", () => {
    mkdirSync(join(dir, ".cursor"));
    writeFileSync(join(dir, ".cursor", "mcp.json"), JSON.stringify({ mcpServers: { other: { command: "x" } }, extra: 1 }));
    install("cursor");
    const j = JSON.parse(readFileSync(join(dir, ".cursor", "mcp.json"), "utf8"));
    expect(j.mcpServers.other).toEqual({ command: "x" });
    expect(j.mcpServers.modedial).toEqual({ command: "node", args: ["/x/cli.js"] });
    expect(j.extra).toBe(1);
    uninstall("cursor");
    expect(JSON.parse(readFileSync(join(dir, ".cursor", "mcp.json"), "utf8"))).toEqual({ mcpServers: { other: { command: "x" } }, extra: 1 });
  });

  it("refuses a config file it cannot parse, and changes nothing", () => {
    mkdirSync(join(dir, ".cursor"));
    writeFileSync(join(dir, ".cursor", "mcp.json"), "{ // comment\n}");
    expect(() => install("cursor")).toThrow(/not valid JSON/);
    expect(readFileSync(join(dir, ".cursor", "mcp.json"), "utf8")).toBe("{ // comment\n}");
  });

  it("keeps a backup of a shared file the first time it is changed", () => {
    writeFileSync(join(dir, "AGENTS.md"), "original\n");
    install("agents-md");
    expect(readFileSync(join(dir, "AGENTS.md.modedial.bak"), "utf8")).toBe("original\n");
  });
});

describe("native formats", () => {
  it("cursor: one .mdc rule per mode with the frontmatter Cursor reads", () => {
    install("cursor");
    const rule = readFileSync(join(dir, ".cursor", "rules", "modedial-debug.mdc"), "utf8");
    const fm = frontmatter(rule);
    expect(fm).toMatch(/^description: ".*[Dd]ebug/m);
    expect(fm).toMatch(/^alwaysApply: false$/m);
    expect(rule).toContain(modes.find((m) => m.id === "debug")!.instructions);
    expect(rule).toMatch(/Do not finish until you have run something/); // guard turned into an explicit rule
    expect(files().filter((f) => f.endsWith(".mdc"))).toHaveLength(6);
  });

  it("windsurf: model_decision rules with a description", () => {
    install("windsurf");
    const fm = frontmatter(readFileSync(join(dir, ".windsurf", "rules", "modedial-deep-focus.md"), "utf8"));
    expect(fm).toMatch(/^trigger: "model_decision"$/m);
    expect(fm).toMatch(/^description: /m);
  });

  it("opencode: reviewer agent has write, edit and bash turned off; others do not", () => {
    install("opencode");
    const rev = readFileSync(join(dir, ".opencode", "agents", "modedial-careful-reviewer.md"), "utf8");
    expect(frontmatter(rev)).toMatch(/tools:\n {2}write: false\n {2}edit: false\n {2}bash: false/);
    expect(rev).not.toMatch(/Do not edit files or run commands/); // enforced natively, so not repeated as a rule
    const dbg = readFileSync(join(dir, ".opencode", "agents", "modedial-debug.md"), "utf8");
    expect(frontmatter(dbg)).not.toMatch(/tools:/);
    expect(frontmatter(dbg)).toMatch(/^mode: "primary"$/m);
    const cfg = JSON.parse(readFileSync(join(dir, "opencode.json"), "utf8"));
    expect(cfg.mcp.modedial).toEqual({ type: "local", command: ["node", "/x/cli.js"], enabled: true });
  });

  it("roo-code: valid JSON modes; reviewer has no edit or command group; refactor protects manifests", () => {
    install("roo-code");
    const cfg = JSON.parse(readFileSync(join(dir, ".roomodes"), "utf8"));
    const by = (slug: string) => cfg.customModes.find((m: any) => m.slug === slug);
    expect(cfg.customModes).toHaveLength(6);
    expect(by("modedial-careful-reviewer").groups).toEqual(["read", "mcp"]);
    expect(by("modedial-debug").groups).toEqual(["read", "edit", "command", "mcp"]);
    const refactor = by("modedial-chill-refactor").groups.find((g: any) => Array.isArray(g) && g[0] === "edit");
    const re = new RegExp(refactor[1].fileRegex);
    expect(re.test("src/index.ts")).toBe(true);
    for (const f of ["package.json", "sub/package-lock.json", "go.mod", "requirements.txt", "Cargo.toml"]) expect(re.test(f), f).toBe(false);
  });

  it("roo-code: keeps the user's own modes and replaces only ours on reinstall", () => {
    writeFileSync(join(dir, ".roomodes"), JSON.stringify({ customModes: [{ slug: "mine", name: "Mine", roleDefinition: "x", groups: ["read"] }] }));
    install("roo-code");
    install("roo-code");
    const cfg = JSON.parse(readFileSync(join(dir, ".roomodes"), "utf8"));
    expect(cfg.customModes.filter((m: any) => m.slug === "mine")).toHaveLength(1);
    expect(cfg.customModes).toHaveLength(7);
  });

  it("gemini-cli: TOML commands call set_mode with the right id", () => {
    install("gemini-cli");
    const toml = readFileSync(join(dir, ".gemini", "commands", "modedial", "debug.toml"), "utf8");
    expect(toml).toMatch(/^description = ".+"$/m);
    expect(toml).toMatch(/^prompt = ".*set_mode tool with id debug/m);
    expect(JSON.parse(readFileSync(join(dir, ".gemini", "settings.json"), "utf8")).mcpServers.modedial.command).toBe("node");
  });

  it("copilot: agent files with a name, description and read-only tools for the reviewer", () => {
    install("copilot");
    const fm = frontmatter(readFileSync(join(dir, ".github", "agents", "modedial-careful-reviewer.agent.md"), "utf8"));
    expect(fm).toMatch(/^name: "modedial-careful-reviewer"$/m);
    expect(fm).toMatch(/^tools: \["read","search"\]$/m);
    expect(JSON.parse(readFileSync(join(dir, ".vscode", "mcp.json"), "utf8")).servers.modedial.type).toBe("stdio");
  });

  it("codex: block in AGENTS.md and the config snippet is shown, not written", () => {
    const out = install("codex");
    expect(readFileSync(join(dir, "AGENTS.md"), "utf8")).toContain("set_mode");
    expect(out).toMatch(/\[mcp_servers\.modedial\]/);
    expect(out).toMatch(/--sandbox read-only/);
    expect(existsSync(join(home, ".codex", "config.toml"))).toBe(false);
  });

  it("user scope writes under the home folder, not the project", () => {
    install("codex", ["--user"]);
    expect(existsSync(join(home, ".codex", "AGENTS.md"))).toBe(true);
    expect(files()).toEqual([]);
  });
});

describe("content", () => {
  it("the always-on snippet stays small (token cost matters)", () => {
    expect(snippet().length / 4).toBeLessThan(150);
    expect(snippet()).toContain(BLOCK_END);
  });

  it("every installed mode file carries the mode's own instructions, not a placeholder", () => {
    install("windsurf");
    for (const m of modes) expect(readFileSync(join(dir, ".windsurf", "rules", `modedial-${m.id}.md`), "utf8")).toContain(m.instructions);
  });

  it("unknown agents get a clear error listing the supported ones", () => {
    expect(() => planFor("nope", ctx())).toThrow(/Supported: claude-code, agents-md/);
  });
});

describe("applyPlan", () => {
  it("reports create then unchanged", () => {
    const plan = planFor("cline", ctx());
    expect(applyPlan(plan, { root: dir })[0]!.what).toBe("create");
    expect(applyPlan(plan, { root: dir })[0]!.what).toBe("unchanged");
  });
});
