import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { applyClaudeCode, mcpCommand } from "./install.js";
import { loadModes, type Mode } from "./modes.js";
import { AGENTS, applyPlan, planFor, type Ctx } from "./targets.js";

/** Where each agent leaves a footprint in a project, used only to mark likely agents in the list. */
const DETECT: Record<string, string[]> = {
  "claude-code": [".claude", "CLAUDE.md"], cursor: [".cursor"], codex: [".codex"], opencode: [".opencode", "opencode.json"],
  "roo-code": [".roomodes", ".roo"], "kilo-code": [".kilocodemodes", ".kilocode"], copilot: [".github/copilot-instructions.md", ".github/agents"],
  windsurf: [".windsurf"], "gemini-cli": ["GEMINI.md", ".gemini"], cline: [".clinerules"], aider: [".aider.conf.yml"], "agents-md": ["AGENTS.md"],
};

const CONF: Record<string, string> = { tested: "tested with a real agent", docs: "format from the agent's docs, not run here", unverified: "unverified: format not confirmed" };

export interface InstallEnv { cwd: string; home?: string; modes?: Mode[]; mcp?: { command: string; args: string[] } }

export function runInstall(cmd: "install" | "uninstall", args: string[], env: InstallEnv): string {
  const home = env.home ?? homedir();
  const modes = env.modes ?? loadModes();
  const dryRun = args.includes("--dry-run");
  const scope = args.includes("--user") ? "user" : "project";
  const target = args.find((a) => !a.startsWith("--"));
  const out: string[] = [];

  if (!target) {
    out.push(`Usage: modedial ${cmd} <agent|all> [--user] [--dry-run]`, "", "Agents (✓ = looks present in this project):");
    for (const a of ["claude-code", ...AGENTS]) {
      const seen = (DETECT[a] ?? []).some((p) => existsSync(join(env.cwd, p)));
      const c = a === "claude-code" ? "tested with a real agent" : CONF[planFor(a, { cwd: env.cwd, home, scope: "project", modes, mcp: { command: "x", args: [] } }).confidence];
      out.push(`  ${seen ? "✓" : " "} ${a.padEnd(12)} ${c}`);
    }
    return out.join("\n");
  }

  const agents = target === "all" ? ["claude-code", ...AGENTS] : [target];
  const ctx: Ctx = { cwd: env.cwd, home, scope, modes, mcp: env.mcp ?? mcpCommand() };
  for (const agent of agents) {
    out.push(`\n== ${agent}`);
    if (agent === "claude-code") {
      let r;
      try {
        r = applyClaudeCode({ scope, cwd: env.cwd, home, dryRun, remove: cmd === "uninstall" });
      } catch (e) {
        if (agents.length === 1) throw e;
        out.push("  skipped: " + (e as Error).message.split("\n").join("\n  "));
        continue;
      }
      out.push(`  ${dryRun ? "would update" : cmd === "install" ? "updated" : "cleaned"} ${r.path}`);
      out.push("  enforcement: real, via hooks (read-only reviewer, verify-before-finish, scope lock, manifest guard, required tells)");
      if (cmd === "install") out.push("  MCP server: claude mcp add modedial -- npx -y modedial");
      continue;
    }
    const plan = planFor(agent, ctx);
    const changes = applyPlan(plan, { dryRun, remove: cmd === "uninstall", root: scope === "user" ? home : env.cwd });
    for (const c of changes) out.push(`  ${dryRun ? "would " : ""}${c.what.padEnd(9)} ${c.path}`);
    if (!changes.length) out.push("  nothing to do");
    out.push(`  confidence: ${CONF[plan.confidence]}`, `  enforcement: ${plan.enforcement}`);
    if (cmd === "install") for (const n of plan.notes) out.push(`  note: ${n.replace(/\n/g, "\n        ")}`);
  }
  return out.join("\n").trimStart();
}
