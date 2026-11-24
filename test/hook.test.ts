import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { lastAssistantText, runHook, type HookInput } from "../src/hook.js";
import { loadModes } from "../src/modes.js";
import { readState, sessionsDir } from "../src/session.js";

const modes = loadModes();
let base: string;
beforeEach(() => void (base = mkdtempSync(join(tmpdir(), "modedial-hook-"))));
afterEach(() => rmSync(base, { recursive: true, force: true }));
const run = (e: Parameters<typeof runHook>[0], i: HookInput) => runHook(e, { cwd: "/proj", session_id: "s1", ...i }, { base, modes }) as any;
const setMode = (id: string, extra: object = {}, session = "s1", tool = "mcp__modedial__set_mode") =>
  run("post-tool-use", { session_id: session, tool_name: tool, tool_input: { id, ...extra } });

describe("set_mode and end_mode", () => {
  it("records the mode and re-injects the contract as context", () => {
    const out = setMode("careful-reviewer");
    expect(out.hookSpecificOutput.hookEventName).toBe("PostToolUse");
    expect(out.hookSpecificOutput.additionalContext).toMatch(/Careful Reviewer mode is active/);
    expect(out.hookSpecificOutput.additionalContext).toMatch(/read-only/);
    expect(readState(base, "s1").mode).toBe("careful-reviewer");
  });

  it("stores the declared scope", () => {
    setMode("deep-focus", { scope: ["src/a.js", 5, ""] });
    expect(readState(base, "s1").scope).toEqual(["src/a.js"]);
  });

  it("works with plugin-style tool names and ignores other servers' tools", () => {
    setMode("debug", {}, "s2", "mcp__plugin_modedial_modedial__set_mode");
    expect(readState(base, "s2").mode).toBe("debug");
    run("post-tool-use", { session_id: "s3", tool_name: "mcp__other__set_mode", tool_input: { id: "debug" } });
    expect(readState(base, "s3").mode).toBeNull();
  });

  it("ignores unknown mode ids", () => {
    expect(setMode("nope")).toBeNull();
    expect(readState(base, "s1").mode).toBeNull();
  });

  it("end_mode clears the mode, so nothing is enforced any more", () => {
    setMode("careful-reviewer");
    run("post-tool-use", { tool_name: "mcp__modedial__end_mode" });
    expect(run("pre-tool-use", { tool_name: "Edit", tool_input: { file_path: "a.js" } })).toBeNull();
  });

  it("keeps sessions separate", () => {
    setMode("careful-reviewer", {}, "A");
    expect(run("pre-tool-use", { session_id: "A", tool_name: "Edit", tool_input: { file_path: "a.js" } })).not.toBeNull();
    expect(run("pre-tool-use", { session_id: "B", tool_name: "Edit", tool_input: { file_path: "a.js" } })).toBeNull();
  });

  it("sanitizes hostile session ids so state cannot escape its folder", () => {
    setMode("debug", {}, "../../evil");
    expect(readState(base, "../../evil").mode).toBe("debug");
    expect(() => readFileSync(join(base, "..", "evil.json"))).toThrow();
  });
});

describe("enforcement through the hook payloads", () => {
  it("denies writes in Careful Reviewer with a reason the agent sees", () => {
    setMode("careful-reviewer");
    const out = run("pre-tool-use", { tool_name: "Write", tool_input: { file_path: "x.txt", content: "hi" } });
    expect(out.hookSpecificOutput).toMatchObject({ hookEventName: "PreToolUse", permissionDecision: "deny" });
    expect(out.hookSpecificOutput.permissionDecisionReason).toMatch(/read-only/);
    expect(run("pre-tool-use", { tool_name: "Read", tool_input: { file_path: "x.txt" } })).toBeNull();
  });

  it("Deep Focus asks outside the scope that set_mode declared", () => {
    setMode("deep-focus", { scope: ["src/paginate.js"] });
    expect(run("pre-tool-use", { tool_name: "Edit", tool_input: { file_path: "src/paginate.js" } })).toBeNull();
    expect(run("pre-tool-use", { tool_name: "Edit", tool_input: { file_path: "src/format.js" } }).hookSpecificOutput.permissionDecision).toBe("ask");
  });

  it("Debug mode: edit, then stop is blocked once until something runs", () => {
    setMode("debug");
    run("post-tool-use", { tool_name: "Edit", tool_input: { file_path: "a.js" } });
    const first = run("stop", {});
    expect(first).toMatchObject({ decision: "block" });
    expect(run("stop", {})).toBeNull(); // one nudge only

    run("post-tool-use", { tool_name: "Edit", tool_input: { file_path: "b.js" } });
    run("post-tool-use", { tool_name: "Bash", tool_input: { command: "node test.js" } });
    expect(run("stop", {})).toBeNull();
  });

  it("Deep Focus: a reply without the tell is sent back once", () => {
    setMode("deep-focus");
    expect(run("stop", { last_assistant_message: "Done." })).toMatchObject({ decision: "block" });
    expect(run("stop", { last_assistant_message: "Done." })).toBeNull();
    setMode("deep-focus");
    expect(run("stop", { last_assistant_message: "Goal: fix x\nDone\nSet aside: nothing" })).toBeNull();
  });

  it("does nothing at all when no mode is active", () => {
    expect(run("pre-tool-use", { tool_name: "Bash", tool_input: { command: "rm -rf /" } })).toBeNull();
    expect(run("post-tool-use", { tool_name: "Edit", tool_input: { file_path: "a.js" } })).toBeNull();
    expect(run("stop", {})).toBeNull();
  });
});

describe("session-start (compaction)", () => {
  it("re-injects the active mode, and stays silent otherwise", () => {
    expect(run("session-start", { source: "compact" })).toBeNull();
    setMode("debug");
    expect(run("session-start", { source: "compact" }).hookSpecificOutput.additionalContext).toMatch(/Debug Mode mode is active/);
  });
});

describe("robustness", () => {
  it("a corrupted state file is treated as no mode", () => {
    mkdirSync(sessionsDir(base), { recursive: true });
    writeFileSync(join(sessionsDir(base), "s1.json"), "{not json");
    expect(run("pre-tool-use", { tool_name: "Edit", tool_input: { file_path: "a.js" } })).toBeNull();
  });
});

describe("lastAssistantText", () => {
  const transcript = (lines: object[]) => {
    const f = join(base, "t.jsonl");
    writeFileSync(f, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
    return f;
  };
  it("reads the last assistant text, skipping tool-only turns", () => {
    const f = transcript([
      { type: "user", message: { role: "user", content: "hi" } },
      { type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "Goal: x. Set aside: nothing" }] } },
      { type: "assistant", message: { role: "assistant", content: [{ type: "tool_use", name: "Read" }] } },
    ]);
    expect(lastAssistantText({ transcript_path: f })).toBe("Goal: x. Set aside: nothing");
  });
  it("prefers last_assistant_message, and returns null when unreadable", () => {
    expect(lastAssistantText({ last_assistant_message: "A", transcript_path: "/nope" })).toBe("A");
    expect(lastAssistantText({ transcript_path: join(base, "missing.jsonl") })).toBeNull();
    expect(lastAssistantText({})).toBeNull();
  });
});
