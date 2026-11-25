import { closeSync, openSync, readSync, statSync } from "node:fs";
import { evaluatePreToolUse, evaluateStop, emptyState, updateAfterTool, type SessionState } from "./guards.js";
import { findMode } from "./modesLight.js";
import type { Mode } from "./modes.js";
import { pruneOldSessions, readState, writeState } from "./session.js";

/** Subset of the Claude Code hook payload we use. Unknown fields are ignored. */
export interface HookInput {
  session_id?: string;
  cwd?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  stop_hook_active?: boolean;
  transcript_path?: string;
  last_assistant_message?: string;
  source?: string;
}

export type HookEvent = "pre-tool-use" | "post-tool-use" | "stop" | "session-start";

const SET_MODE = /^mcp__.*modedial.*__set_mode$/;
const END_MODE = /^mcp__.*modedial.*__end_mode$/;

/** The text re-injected into the agent's context (system-reminder level), not just a tool result. */
export function contractText(mode: Mode, scope: string[]): string {
  const lines = [`modedial: ${mode.name} mode is active. Follow this until end_mode is called or the user picks another mode.`, mode.instructions];
  if (scope.length) lines.push(`Declared scope: ${scope.join(", ")}.`);
  if (mode.guards.length) lines.push(`Enforced by hooks: ${mode.guards.join(", ")}.`);
  return lines.join("\n");
}

/** Last assistant text from a Claude Code transcript (JSONL). Returns null if it cannot be read. */
export function lastAssistantText(input: HookInput): string | null {
  if (typeof input.last_assistant_message === "string") return input.last_assistant_message;
  if (!input.transcript_path) return null;
  try {
    const size = statSync(input.transcript_path).size;
    const len = Math.min(size, 400_000);
    const buf = Buffer.alloc(len);
    const fd = openSync(input.transcript_path, "r");
    try {
      readSync(fd, buf, 0, len, size - len);
    } finally {
      closeSync(fd);
    }
    const lines = buf.toString("utf8").split("\n").filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      let o: { type?: string; message?: { role?: string; content?: unknown } };
      try {
        o = JSON.parse(lines[i]!);
      } catch {
        continue; // the first line of a tail read may be cut off
      }
      if (o.type !== "assistant" && o.message?.role !== "assistant") continue;
      const c = o.message?.content;
      const text = typeof c === "string" ? c : Array.isArray(c) ? c.filter((b: { type?: string }) => b?.type === "text").map((b: { text?: string }) => b.text ?? "").join("\n") : "";
      if (text.trim()) return text;
    }
  } catch {
    /* fall through */
  }
  return null;
}

const asScope = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.length > 0).slice(0, 50) : []);

/**
 * Handles one hook event. Returns the JSON to print on stdout, or null for "no opinion".
 * Never throws: a hook bug must not break the user's session, so callers treat errors as "allow".
 */
export function runHook(event: HookEvent, input: HookInput, opts: { base: string; modes: Mode[] }): unknown | null {
  const sid = input.session_id;
  const state = readState(opts.base, sid);
  const mode = state.mode ? findMode(opts.modes, state.mode) : undefined;
  const tool = input.tool_name ?? "";

  if (event === "post-tool-use") {
    if (SET_MODE.test(tool)) {
      const id = typeof input.tool_input?.id === "string" ? input.tool_input.id : "";
      const next = findMode(opts.modes, id);
      if (!next) return null;
      const scope = asScope(input.tool_input?.scope);
      writeState(opts.base, sid, { ...emptyState(), mode: next.id, scope });
      return { hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: contractText(next, scope) } };
    }
    if (END_MODE.test(tool)) {
      writeState(opts.base, sid, emptyState());
      return null;
    }
    if (!mode) return null;
    const next = updateAfterTool(state, tool, input.tool_input);
    if (next.dirty !== state.dirty || next.verified !== state.verified || next.edits !== state.edits) writeState(opts.base, sid, next);
    return null;
  }

  if (event === "pre-tool-use") {
    const d = evaluatePreToolUse(mode, state, tool, input.tool_input, input.cwd ?? process.cwd());
    if (d.decision === "allow") return null;
    return { hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: d.decision, permissionDecisionReason: d.reason } };
  }

  if (event === "stop") {
    if (!mode) return null;
    const needsText = mode.guards.includes("require-tell");
    const r = evaluateStop(mode, state, input.stop_hook_active === true, needsText ? lastAssistantText(input) : null);
    if (!r.block) return null;
    writeState(opts.base, sid, { ...state, ...r.patch } as SessionState);
    return { decision: "block", reason: r.reason };
  }

  if (event === "session-start") {
    pruneOldSessions(opts.base);
    if (!mode) return null;
    return { hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: contractText(mode, state.scope) } };
  }
  return null;
}
