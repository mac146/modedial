import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Every hook entry we write carries this flag in its command, so we can find and replace only ours. */
export const MARKER = "--modedial";

type HookEntry = { matcher?: string; hooks: { type: string; command: string; timeout?: number }[] };
type Settings = { hooks?: Record<string, HookEntry[]>; [k: string]: unknown };

const isNpxCache = (cliPath: string): boolean => /[\\/](_npx|npx-cache)[\\/]/i.test(cliPath);

/**
 * How the hooks call modedial. They run on every edit and shell command, so start-up time matters:
 * measured on the published package, `npx -y modedial hook` costs about 3.4 s per call while a
 * global `modedial` costs about 0.1 s. So when we are running through npx we refuse to write npx
 * hooks, and use the global command if there is one. (A path into the npx cache is not an option:
 * it can be cleaned up, and a hook that cannot start silently turns the guards off.)
 */
export function resolveHookPrefix(cliPath: string, hasGlobalBin: () => boolean): string {
  const cli = cliPath.replace(/\\/g, "/");
  if (!isNpxCache(cli)) return `node "${cli}"`;
  if (hasGlobalBin()) return "modedial";
  throw new Error(
    "The hooks run on every edit and need a fast start. Through npx each call would take seconds.\n" +
      "Install modedial globally, then run the installer again:\n  npm install -g modedial\n  modedial install claude-code",
  );
}

/**
 * Finds a real, installed `bin` on the PATH. Directories inside npx's cache are skipped on purpose:
 * while running through npx, npx puts its own temporary .bin folder on the PATH, so a plain
 * `which`/`where` finds a copy that vanishes as soon as npx exits. Hooks written against that copy
 * would fail to start later and silently turn every guard off.
 */
export function findGlobalBin(
  bin: string,
  pathVar: string = process.env.PATH ?? process.env.Path ?? "",
  platform: string = process.platform,
  exists: (p: string) => boolean = existsSync,
): string | null {
  const names = platform === "win32" ? [`${bin}.cmd`, `${bin}.exe`, `${bin}.bat`, bin] : [bin];
  for (const dir of pathVar.split(platform === "win32" ? ";" : ":")) {
    if (!dir || isNpxCache(dir + "/")) continue;
    for (const n of names) {
      const p = join(dir, n);
      if (exists(p)) return p;
    }
  }
  return null;
}

const globalBinExists = (): boolean => findGlobalBin("modedial") !== null;

export function hookCommandPrefix(): string {
  return resolveHookPrefix(join(dirname(fileURLToPath(import.meta.url)), "cli.js"), globalBinExists);
}

const WRITE_TOOLS = "Edit|Write|MultiEdit|NotebookEdit";

export function buildClaudeHooks(prefix: string): Record<string, HookEntry[]> {
  const cmd = (event: string) => ({ type: "command", command: `${prefix} hook ${event} ${MARKER}`, timeout: 10 });
  return {
    PreToolUse: [{ matcher: `${WRITE_TOOLS}|Bash|mcp__.*modedial.*`, hooks: [cmd("pre-tool-use")] }],
    PostToolUse: [{ matcher: `${WRITE_TOOLS}|Bash|mcp__.*modedial.*`, hooks: [cmd("post-tool-use")] }],
    Stop: [{ hooks: [cmd("stop")] }],
    SessionStart: [{ matcher: "compact", hooks: [cmd("session-start")] }],
  };
}

const isOurs = (e: HookEntry): boolean => Array.isArray(e.hooks) && e.hooks.some((h) => typeof h.command === "string" && h.command.includes(MARKER));

/** Adds our hooks, replacing any earlier modedial hooks and leaving everyone else's alone. */
export function mergeClaudeSettings(existing: Settings, prefix: string): Settings {
  const out: Settings = { ...existing, hooks: { ...(existing.hooks ?? {}) } };
  for (const [event, entries] of Object.entries(buildClaudeHooks(prefix))) {
    out.hooks![event] = [...(out.hooks![event] ?? []).filter((e) => !isOurs(e)), ...entries];
  }
  return out;
}

export function removeClaudeHooks(existing: Settings): Settings {
  const out: Settings = { ...existing };
  if (!existing.hooks) return out;
  const hooks: Record<string, HookEntry[]> = {};
  for (const [event, entries] of Object.entries(existing.hooks)) {
    const keep = entries.filter((e) => !isOurs(e));
    if (keep.length) hooks[event] = keep;
  }
  if (Object.keys(hooks).length) out.hooks = hooks;
  else delete out.hooks;
  return out;
}

export const claudeSettingsPath = (scope: "project" | "user", cwd: string, home = homedir()): string =>
  scope === "user" ? join(home, ".claude", "settings.json") : join(cwd, ".claude", "settings.json");

function readSettings(path: string): Settings {
  if (!existsSync(path)) return {};
  const raw = readFileSync(path, "utf8");
  try {
    return raw.trim() ? (JSON.parse(raw) as Settings) : {};
  } catch {
    throw new Error(`${path} is not valid JSON. Fix or remove it, then rerun; nothing was changed.`);
  }
}

export function applyClaudeCode(opts: { scope: "project" | "user"; cwd: string; home?: string; prefix?: string; dryRun?: boolean; remove?: boolean }) {
  const path = claudeSettingsPath(opts.scope, opts.cwd, opts.home);
  const before = readSettings(path);
  const after = opts.remove ? removeClaudeHooks(before) : mergeClaudeSettings(before, opts.prefix ?? hookCommandPrefix());
  if (!opts.dryRun) {
    mkdirSync(dirname(path), { recursive: true });
    if (existsSync(path)) writeFileSync(`${path}.modedial.bak`, readFileSync(path, "utf8"), "utf8"); // one backup of what was there
    const tmp = `${path}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(after, null, 2) + "\n", "utf8");
    renameSync(tmp, path);
  }
  return { path, before, after };
}

/** How an MCP client should start the modedial server: npx when run through it, otherwise this exact build. */
export function mcpCommand(): { command: string; args: string[] } {
  const cli = join(dirname(fileURLToPath(import.meta.url)), "cli.js").replace(/\\/g, "/");
  return /[\\/](_npx|npx-cache)[\\/]/i.test(cli) ? { command: "npx", args: ["-y", "modedial"] } : { command: "node", args: [cli] };
}
