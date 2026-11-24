import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync, readdirSync, rmdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { Mode } from "./modes.js";

/**
 * Installers for coding agents other than Claude Code (which has its own hook installer).
 * Each agent gets files in the format it natively reads. Where the agent has a real permission
 * system (opencode agents, Roo Code modes) read-only and manifest guards are expressed there;
 * everywhere else the guards become explicit rules written into the instructions.
 *
 * Every file we create is namespaced `modedial-*` so uninstall removes only ours. Shared files
 * (AGENTS.md, GEMINI.md, JSON configs) are edited in place with a marked block or a keyed entry.
 */

export type Action =
  | { kind: "file"; path: string; content: string }
  | { kind: "block"; path: string; content: string }
  | { kind: "json"; path: string; merge: (o: any) => any; unmerge: (o: any) => any };

export interface Plan {
  agent: string;
  /** How this agent's format was established. Be honest in the README about anything not "tested". */
  confidence: "tested" | "docs" | "unverified";
  actions: Action[];
  /** Things the installer cannot do for the user (usually user-level config it does not touch). */
  notes: string[];
  enforcement: string;
}

export interface Ctx {
  cwd: string;
  home: string;
  scope: "project" | "user";
  modes: Mode[];
  mcp: { command: string; args: string[] };
}

export const BLOCK_START = "<!-- modedial:start -->";
export const BLOCK_END = "<!-- modedial:end -->";

/** The small always-on snippet. Mode instructions load on demand, so this stays cheap in tokens. */
export function snippet(): string {
  return [
    BLOCK_START,
    "## Modes (modedial)",
    "You have a `modedial` MCP server. When the user asks for a mode (for example \"deep focus\" or \"debug mode\"),",
    "call `list_modes` if unsure, then `set_mode` with the matching id, and follow the returned instructions until",
    "`end_mode` is called or the user picks another mode. When the task type changes, suggest a fitting mode in one",
    "line instead of switching silently.",
    BLOCK_END,
  ].join("\n");
}

const GUARD_RULE: Record<string, (m: Mode) => string> = {
  "read-only": () => "Do not edit files or run commands that change files, git state or packages.",
  "scope-lock": () => "Edit only the files you declared as in scope. Ask the user before widening the scope.",
  "verify-before-finish": () => "Do not finish until you have run something (a test, script or build) after your last edit, or say the result is unconfirmed.",
  "protect-manifests": () => "Do not edit dependency manifests or lockfiles without asking.",
  "require-tell": (m) => `Your final reply must include: ${(m.tell?.required ?? []).map((t) => `"${t}"`).join(", ")}.`,
};

/** Guards written as plain rules, for agents that cannot enforce them. `skip` lists those the agent enforces natively. */
function ruleLines(m: Mode, skip: string[] = []): string[] {
  return m.guards.filter((g) => !skip.includes(g)).map((g) => `- ${GUARD_RULE[g]!(m)}`);
}

export function modeBody(m: Mode, skip: string[] = []): string {
  const rules = ruleLines(m, skip);
  return [`# ${m.name}`, `${m.tagline}`, "", m.instructions, ...(rules.length ? ["", "Rules for this mode:", ...rules] : []), "", `Effort: ${m.effort_hint}. ${m.context_policy}`].join("\n");
}

const q = (s: string) => JSON.stringify(s); // valid YAML and TOML basic string
const triggerText = (m: Mode) => `Use when the user asks for "${m.name}" or "${m.id.replace(/-/g, " ")}" mode, or the task clearly fits: ${m.tagline}`;
const slug = (m: Mode) => `modedial-${m.id}`;

function mdFile(path: string, frontmatter: Record<string, string | boolean | string[]>, body: string): Action {
  const fm = Object.entries(frontmatter).map(([k, v]) => `${k}: ${typeof v === "string" ? q(v) : JSON.stringify(v)}`);
  return { kind: "file", path, content: ["---", ...fm, "---", "", body, ""].join("\n") };
}

const mcpEntry = (c: Ctx) => ({ command: c.mcp.command, args: c.mcp.args });
const setKey = (key: string, value: unknown) => ({
  merge: (o: any) => ({ ...o, [key]: { ...(o[key] ?? {}), modedial: value } }),
  unmerge: (o: any) => {
    if (!o[key]) return o;
    const { modedial: _drop, ...rest } = o[key];
    const out = { ...o, [key]: rest };
    if (!Object.keys(rest).length) delete out[key];
    return out;
  },
});

// ---------------------------------------------------------------- per-agent plans

const proj = (c: Ctx, rel: string, userRel?: string) => (c.scope === "user" && userRel ? join(c.home, userRel) : join(c.cwd, rel));

const PLANS: Record<string, (c: Ctx) => Plan> = {
  "agents-md": (c) => ({
    agent: "agents-md",
    confidence: "docs",
    actions: [{ kind: "block", path: join(c.cwd, "AGENTS.md"), content: snippet() }],
    notes: ["AGENTS.md is read by Codex, Cursor, opencode, GitHub Copilot, Amp and others. You still need to add the modedial MCP server to each agent (see `modedial install <agent>` for the config)."],
    enforcement: "Instructions only. The snippet tells the agent to call set_mode.",
  }),

  cursor: (c) => ({
    agent: "cursor",
    confidence: "docs",
    actions: [
      ...(c.scope === "project" ? c.modes.map((m) => mdFile(join(c.cwd, ".cursor", "rules", `${slug(m)}.mdc`), { description: triggerText(m), alwaysApply: false }, modeBody(m))) : []),
      { kind: "json", path: proj(c, join(".cursor", "mcp.json"), join(".cursor", "mcp.json")), ...setKey("mcpServers", mcpEntry(c)) },
    ],
    notes: ["Cursor asks you to switch the server on in Settings → Tools & MCP the first time.", "Rules are chosen by Cursor from their description, or you can mention one with @modedial-debug."],
    enforcement: "Instructions only. Guards are written into each rule as plain rules.",
  }),

  codex: (c) => ({
    agent: "codex",
    confidence: "tested",
    actions: [{ kind: "block", path: c.scope === "user" ? join(c.home, ".codex", "AGENTS.md") : join(c.cwd, "AGENTS.md"), content: snippet() }],
    notes: [
      "Add the server to ~/.codex/config.toml (this installer does not edit your user config):",
      `[mcp_servers.modedial]\ncommand = ${q(c.mcp.command)}\nargs = ${JSON.stringify(c.mcp.args)}\ndefault_tools_approval_mode = "approve"   # optional: skip the approval prompt`,
      "For Careful Reviewer, Codex's own read-only sandbox is the real guard: run `codex --sandbox read-only`.",
    ],
    enforcement: "Instructions only, plus Codex's read-only sandbox if you choose it for reviews.",
  }),

  opencode: (c) => {
    const base = c.scope === "user" ? join(c.home, ".config", "opencode", "agents") : join(c.cwd, ".opencode", "agents");
    const native = (m: Mode): Record<string, boolean> | undefined =>
      m.guards.includes("read-only") ? { write: false, edit: false, bash: false } : undefined;
    return {
      agent: "opencode",
      confidence: "tested",
      actions: [
        ...c.modes.map((m) => {
          const tools = native(m);
          const fm: Record<string, string | boolean | string[]> = { description: m.tagline, mode: "primary" };
          const body = modeBody(m, tools ? ["read-only"] : []);
          const a = mdFile(join(base, `${slug(m)}.md`), fm, body);
          // opencode reads nested YAML for tools; add it after the simple keys
          if (tools && a.kind === "file") a.content = a.content.replace("\n---\n\n", `\ntools:\n${Object.entries(tools).map(([k, v]) => `  ${k}: ${v}`).join("\n")}\n---\n\n`);
          return a;
        }),
        ...(c.scope === "project"
          ? [{ kind: "json" as const, path: join(c.cwd, "opencode.json"), ...setKey("mcp", { type: "local", command: [c.mcp.command, ...c.mcp.args], enabled: true }) }]
          : []),
      ],
      notes: ["Switch with Tab in the opencode TUI, or start with `opencode --agent modedial-careful-reviewer`."],
      enforcement: "Real: Careful Reviewer's agent has write, edit and bash tools turned off. Other guards are plain rules.",
    };
  },

  "roo-code": (c) => rooPlan(c, "roo-code", ".roomodes", "docs"),
  "kilo-code": (c) => rooPlan(c, "kilo-code", ".kilocodemodes", "unverified"),

  copilot: (c) => ({
    agent: "copilot",
    confidence: "unverified",
    actions: [
      ...c.modes.map((m) =>
        mdFile(join(c.cwd, ".github", "agents", `${slug(m)}.agent.md`), { name: slug(m), description: m.tagline, ...(m.guards.includes("read-only") ? { tools: ["read", "search"] } : {}) }, modeBody(m, m.guards.includes("read-only") ? ["read-only"] : [])),
      ),
      { kind: "json", path: join(c.cwd, ".vscode", "mcp.json"), ...setKey("servers", { type: "stdio", command: c.mcp.command, args: c.mcp.args }) },
    ],
    notes: ["Agents appear in the Copilot Chat agents dropdown in VS Code. Tool names in the `tools` list follow Copilot's aliases; check them against your Copilot version."],
    enforcement: "Careful Reviewer restricts the agent's tools to read and search (not yet verified against a live Copilot). Other guards are plain rules.",
  }),

  windsurf: (c) => ({
    agent: "windsurf",
    confidence: "docs",
    actions: c.modes.map((m) => mdFile(join(c.cwd, ".windsurf", "rules", `${slug(m)}.md`), { trigger: "model_decision", description: triggerText(m) }, modeBody(m))),
    notes: [`Add the server to ~/.codeium/windsurf/mcp_config.json (not edited by this installer):\n${JSON.stringify({ mcpServers: { modedial: mcpEntry(c) } }, null, 2)}`],
    enforcement: "Instructions only. Guards are written into each rule as plain rules.",
  }),

  "gemini-cli": (c) => ({
    agent: "gemini-cli",
    confidence: "unverified",
    actions: [
      { kind: "block", path: c.scope === "user" ? join(c.home, ".gemini", "GEMINI.md") : join(c.cwd, "GEMINI.md"), content: snippet() },
      ...(c.scope === "project"
        ? c.modes.map((m) => ({
            kind: "file" as const,
            path: join(c.cwd, ".gemini", "commands", "modedial", `${m.id}.toml`),
            content: `description = ${q(m.tagline)}\nprompt = ${q(`Call the modedial set_mode tool with id ${m.id} and follow its instructions. {{args}}`)}\n`,
          }))
        : []),
      { kind: "json", path: proj(c, join(".gemini", "settings.json"), join(".gemini", "settings.json")), ...setKey("mcpServers", mcpEntry(c)) },
    ],
    notes: ["Slash commands appear as /modedial:debug, /modedial:deep-focus and so on. The command file format is not yet verified against a live Gemini CLI."],
    enforcement: "Instructions only.",
  }),

  cline: (c) => ({
    agent: "cline",
    confidence: "docs",
    actions: [{ kind: "file", path: join(c.cwd, ".clinerules", "modedial.md"), content: snippet().replace(BLOCK_START, "").replace(BLOCK_END, "").trim() + "\n" }],
    notes: ["Add the server in Cline's MCP settings. Cline has no per-mode permissions, so this is instructions only."],
    enforcement: "Instructions only.",
  }),

  aider: (c) => ({
    agent: "aider",
    confidence: "unverified",
    actions: [{ kind: "file", path: join(c.cwd, ".modedial", "MODES.md"), content: c.modes.map((m) => modeBody(m)).join("\n\n---\n\n") + "\n" }],
    notes: ["Aider has no MCP support, so load a mode by hand: `aider --read .modedial/MODES.md`, then say which mode to follow."],
    enforcement: "Instructions only (a single file with all six modes).",
  }),
};

/** Roo Code (and its fork Kilo Code) have real modes with tool groups and file-pattern restrictions. */
function rooPlan(c: Ctx, agent: string, file: string, confidence: Plan["confidence"]): Plan {
  const MANIFEST_SAFE = "^(?!.*(package(-lock)?\\.json|pnpm-lock\\.yaml|yarn\\.lock|requirements\\.txt|pyproject\\.toml|Cargo\\.(toml|lock)|go\\.(mod|sum))$).*$";
  const mk = (m: Mode) => {
    const ro = m.guards.includes("read-only");
    const pm = m.guards.includes("protect-manifests");
    const groups: unknown[] = ["read"];
    if (!ro) groups.push(pm ? ["edit", { fileRegex: MANIFEST_SAFE, description: "Any file except dependency manifests" }] : "edit", "command");
    groups.push("mcp");
    return {
      slug: slug(m),
      name: `${m.emoji} ${m.name}`,
      roleDefinition: `${m.name}: ${m.tagline}`,
      whenToUse: triggerText(m),
      customInstructions: modeBody(m, [...(ro ? ["read-only"] : []), ...(pm ? ["protect-manifests"] : [])]),
      groups,
    };
  };
  const ours = c.modes.map(mk);
  return {
    agent,
    confidence,
    actions: [
      {
        kind: "json",
        path: join(c.cwd, file),
        merge: (o: any) => ({ ...o, customModes: [...(o.customModes ?? []).filter((x: any) => !String(x.slug).startsWith("modedial-")), ...ours] }),
        unmerge: (o: any) => ({ ...o, customModes: (o.customModes ?? []).filter((x: any) => !String(x.slug).startsWith("modedial-")) }),
      },
    ],
    notes: [`Add the modedial MCP server in ${agent === "roo-code" ? "Roo Code" : "Kilo Code"}'s MCP settings. Command: ${c.mcp.command} ${c.mcp.args.join(" ")}`, ...(confidence === "unverified" ? [`The ${file} filename for Kilo Code is not verified.`] : [])],
    enforcement: "Real: Careful Reviewer has only read and MCP tool groups (no edit, no commands). Chill Refactor may edit any file except dependency manifests (enforced by a file pattern).",
  };
}

export const AGENTS = Object.keys(PLANS);
export const planFor = (agent: string, ctx: Ctx): Plan => {
  const f = PLANS[agent];
  if (!f) throw new Error(`Unknown agent "${agent}". Supported: claude-code, ${AGENTS.join(", ")}.`);
  return f(ctx);
};

// ---------------------------------------------------------------- applying a plan

export interface Change { path: string; what: "create" | "update" | "remove" | "unchanged" }

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const BLOCK_RE = new RegExp(`${esc(BLOCK_START)}[\\s\\S]*?${esc(BLOCK_END)}`);
/** The block plus the blank space we added around it, so removal leaves the user's text as it was. */
const BLOCK_WITH_SPACE_RE = new RegExp(`\\r?\\n*${esc(BLOCK_START)}[\\s\\S]*?${esc(BLOCK_END)}\\r?\\n?`);
/** A config that only held our entry is empty after removal; delete the file we created instead of leaving `{}`. */
const isEmptyConfig = (o: any): boolean =>
  Object.values(o).every((v) => v == null || (Array.isArray(v) ? v.length === 0 : typeof v === "object" && Object.keys(v as object).length === 0));

function writeAtomic(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, content, "utf8");
  renameSync(tmp, path);
}
const backup = (path: string): void => {
  if (existsSync(path) && !existsSync(`${path}.modedial.bak`)) writeFileSync(`${path}.modedial.bak`, readFileSync(path, "utf8"), "utf8");
};
function pruneEmptyDirs(path: string, stop: string): void {
  let d = dirname(path);
  while (d.startsWith(stop) && d !== stop) {
    try {
      if (readdirSync(d).length) return;
      rmdirSync(d);
    } catch {
      return;
    }
    d = dirname(d);
  }
}

export function applyPlan(plan: Plan, opts: { dryRun?: boolean; remove?: boolean; root: string }): Change[] {
  const changes: Change[] = [];
  const emit = (path: string, what: Change["what"], write?: () => void) => {
    changes.push({ path, what });
    if (!opts.dryRun && write && what !== "unchanged") write();
  };
  for (const a of plan.actions) {
    const exists = existsSync(a.path);
    const current = exists ? readFileSync(a.path, "utf8") : "";
    if (a.kind === "file") {
      if (opts.remove) {
        if (exists) emit(a.path, "remove", () => { rmSync(a.path); pruneEmptyDirs(a.path, opts.root); });
      } else if (current === a.content) emit(a.path, "unchanged");
      else emit(a.path, exists ? "update" : "create", () => writeAtomic(a.path, a.content));
    } else if (a.kind === "block") {
      const has = BLOCK_RE.test(current);
      if (opts.remove) {
        if (has) emit(a.path, "remove", () => {
          const next = current.replace(BLOCK_WITH_SPACE_RE, "\n");
          if (next.trim() === "") { rmSync(a.path); pruneEmptyDirs(a.path, opts.root); } else writeAtomic(a.path, next);
        });
      } else {
        const next = has ? current.replace(BLOCK_RE, a.content) : `${current}${current && !current.endsWith("\n") ? "\n" : ""}${current ? "\n" : ""}${a.content}\n`;
        if (next === current) emit(a.path, "unchanged");
        else emit(a.path, exists ? "update" : "create", () => { backup(a.path); writeAtomic(a.path, next); });
      }
    } else {
      let obj: any = {};
      if (exists && current.trim()) {
        try { obj = JSON.parse(current); } catch { throw new Error(`${a.path} is not valid JSON (it may be YAML or have comments). Nothing was changed.`); }
      }
      if (opts.remove && !exists) continue;
      const result = opts.remove ? a.unmerge(obj) : a.merge(obj);
      const next = JSON.stringify(result, null, 2) + "\n";
      if (opts.remove && JSON.stringify(result) === JSON.stringify(obj)) emit(a.path, "unchanged");
      else if (opts.remove && isEmptyConfig(result)) emit(a.path, "remove", () => { rmSync(a.path); pruneEmptyDirs(a.path, opts.root); });
      else if (next === current) emit(a.path, "unchanged");
      else emit(a.path, exists ? "update" : "create", () => { backup(a.path); writeAtomic(a.path, next); });
    }
  }
  return changes;
}

export const defaultHome = () => homedir();
