import { basename, isAbsolute, relative, resolve } from "node:path";
import type { Mode } from "./modes.js";

/**
 * Pure guard logic. No I/O, so every rule can be unit-tested without running an agent.
 * The hook runner (hook.ts) feeds it parsed hook payloads and session state.
 */

export type Decision = { decision: "allow" } | { decision: "deny" | "ask"; reason: string };

export interface SessionState {
  v: 1;
  mode: string | null;
  scope: string[];
  startedAt: string;
  /** Files were edited since the mode was set or since the last verification. */
  dirty: boolean;
  /** Something ran after the most recent edit. */
  verified: boolean;
  /** Number of edits this session. Only a count: no file names are stored. */
  edits: number;
  stopBlocks: number;
  tellBlocks: number;
}

export const emptyState = (): SessionState => ({
  v: 1, mode: null, scope: [], startedAt: new Date().toISOString(),
  dirty: false, verified: false, edits: 0, stopBlocks: 0, tellBlocks: 0,
});

const WRITE_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);
export const isWriteTool = (name: string): boolean => WRITE_TOOLS.has(name);

export function toolPath(input: Record<string, unknown> | undefined): string | undefined {
  if (!input) return undefined;
  for (const k of ["file_path", "notebook_path", "path"]) if (typeof input[k] === "string") return input[k] as string;
  return undefined;
}

/**
 * Best-effort detection of shell commands that change files, git state or installed packages.
 * It cannot be airtight (a shell can always be clever); the file-edit tools are the hard guarantee.
 */
const MUTATING_BASH: RegExp[] = [
  /(?<![0-9&<>])>>?(?![&>])\s*[^\s&]/, // redirect into a file (after /dev/null is stripped)
  /\btee\b/,
  /\bsed\b[^|;&]*\s-[a-zA-Z]*i/,
  /\b(rm|mv|cp|mkdir|rmdir|touch|chmod|chown|ln|truncate|dd|install)\s/,
  /\bgit\s+(add|commit|push|pull|checkout|switch|reset|clean|stash|rebase|merge|cherry-pick|restore|rm|mv|apply|am|tag)\b/,
  /\b(npm|pnpm|yarn|bun)\s+(i|install|add|remove|rm|uninstall|publish|link|update|upgrade|ci)\b/,
  /\bpip3?\s+(install|uninstall)\b/,
  /\b(apt|apt-get|brew|choco|winget)\s+(install|remove|uninstall)\b/,
  /\bcurl\b[^|;&]*\s(-o|-O|--output)\b/,
  /\bwget\b/,
];

export function isMutatingBash(command: string): boolean {
  const c = command.replace(/\d?>\s*\/dev\/null/g, " ").replace(/\d?>&\d/g, " ");
  return MUTATING_BASH.some((re) => re.test(c));
}

/** A command that runs code or tests counts as "something ran" for verify-before-finish. */
const VERIFY_RE =
  /\b(test|tests|pytest|jest|vitest|mocha|tsc|lint|eslint|ruff|mypy|cargo\s+(test|check|build)|go\s+(test|vet|build)|make|mvn|gradle|dotnet\s+test|npm\s+run|npx|node|python3?|deno|bun)\b/;
export const isVerifyCommand = (command: string): boolean => VERIFY_RE.test(command);

const MANIFESTS = new Set([
  "package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lockb", "requirements.txt",
  "pyproject.toml", "poetry.lock", "Pipfile", "Pipfile.lock", "Cargo.toml", "Cargo.lock", "go.mod", "go.sum", "Gemfile", "Gemfile.lock",
]);
export const isManifest = (path: string): boolean => MANIFESTS.has(basename(path));

function globToRegExp(glob: string): RegExp {
  const esc = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "\u0000").replace(/\*/g, "[^/]*").replace(/\u0000/g, ".*");
  return new RegExp(`^${esc}$`);
}

/** Is `filePath` inside one of the scope entries (a file, a directory, or a glob), resolved against `cwd`? */
export function inScope(filePath: string, scope: string[], cwd: string): boolean {
  const abs = resolve(cwd, filePath);
  const rel = relative(cwd, abs).replace(/\\/g, "/");
  if (rel.startsWith("..") || isAbsolute(rel)) return scope.some((s) => resolve(cwd, s) === abs);
  return scope.some((entry) => {
    const e = entry.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
    if (e.includes("*")) return globToRegExp(e).test(rel);
    return rel === e || rel.startsWith(e + "/");
  });
}

export function evaluatePreToolUse(
  mode: Mode | undefined,
  state: SessionState,
  tool: string,
  input: Record<string, unknown> | undefined,
  cwd: string,
): Decision {
  if (!mode) return { decision: "allow" };
  const write = isWriteTool(tool);
  const path = toolPath(input);

  if (mode.guards.includes("read-only")) {
    if (write) return { decision: "deny", reason: `${mode.name} is read-only. Report the change you would make instead of editing.` };
    if (tool === "Bash" && typeof input?.command === "string" && isMutatingBash(input.command))
      return { decision: "deny", reason: `${mode.name} is read-only. This command looks like it changes files, git state or packages.` };
  }
  if (write && path && mode.guards.includes("protect-manifests") && isManifest(path))
    return { decision: "ask", reason: `${mode.name}: ${basename(path)} is a dependency manifest. Refactors should not change dependencies.` };
  if (write && path && mode.guards.includes("scope-lock") && state.scope.length > 0 && !inScope(path, state.scope, cwd))
    return { decision: "ask", reason: `${mode.name}: ${path} is outside the declared scope (${state.scope.join(", ")}). Approve to widen it.` };
  return { decision: "allow" };
}

/** Track edits and verification after each tool call. Returns a new state. */
export function updateAfterTool(state: SessionState, tool: string, input: Record<string, unknown> | undefined): SessionState {
  const s = { ...state };
  if (isWriteTool(tool)) {
    s.dirty = true;
    s.verified = false;
    s.stopBlocks = 0;
    s.edits = Math.min(state.edits + 1, 1_000_000);
  } else if (tool === "Bash" && s.dirty && typeof input?.command === "string" && isVerifyCommand(input.command)) {
    s.verified = true;
  }
  return s;
}

export type StopResult = { block: false } | { block: true; reason: string; patch: Partial<SessionState> };

export function evaluateStop(
  mode: Mode | undefined,
  state: SessionState,
  stopHookActive: boolean,
  lastAssistantText: string | null,
): StopResult {
  if (!mode || stopHookActive) return { block: false };
  if (mode.guards.includes("verify-before-finish") && state.dirty && !state.verified && state.stopBlocks < 1)
    return {
      block: true,
      patch: { stopBlocks: state.stopBlocks + 1 },
      reason: `${mode.name}: you edited files but nothing has run since. Run the failing case or the tests and report the result, or say plainly that the fix is unconfirmed.`,
    };
  if (mode.guards.includes("require-tell") && mode.tell && lastAssistantText !== null && state.tellBlocks < 1) {
    const text = lastAssistantText.toLowerCase();
    const missing = mode.tell.required.filter((p) => !text.includes(p.toLowerCase()));
    if (missing.length)
      return {
        block: true,
        patch: { tellBlocks: state.tellBlocks + 1 },
        reason: `${mode.name}: your reply is missing ${missing.map((m) => `"${m}"`).join(" and ")}. Add it (write "nothing" where there is nothing to list) and finish.`,
      };
  }
  return { block: false };
}
