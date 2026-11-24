import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyClaudeCode, buildClaudeHooks, MARKER, mergeClaudeSettings, removeClaudeHooks } from "../src/install.js";

let dir: string;
beforeEach(() => void (dir = mkdtempSync(join(tmpdir(), "modedial-inst-"))));
afterEach(() => rmSync(dir, { recursive: true, force: true }));
const settingsFile = () => join(dir, ".claude", "settings.json");
const readJson = () => JSON.parse(readFileSync(settingsFile(), "utf8"));
const ours = (s: any) => JSON.stringify(s).split(MARKER).length - 1;

describe("hook definitions", () => {
  it("cover the four events with the expected matchers", () => {
    const h = buildClaudeHooks("modedial");
    expect(Object.keys(h).sort()).toEqual(["PostToolUse", "PreToolUse", "SessionStart", "Stop"]);
    expect(h.PreToolUse![0]!.matcher).toMatch(/Edit\|Write.*Bash/);
    expect(h.PostToolUse![0]!.matcher).toMatch(/mcp__\.\*modedial/);
    expect(h.SessionStart![0]!.matcher).toBe("compact");
    expect(h.Stop![0]!.hooks[0]!.command).toBe(`modedial hook stop ${MARKER}`);
  });
});

describe("merge / remove", () => {
  const theirs = { hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "their-linter" }] }] }, permissions: { allow: ["Read"] } };

  it("keeps everything that was already there", () => {
    const merged = mergeClaudeSettings(theirs as any, "modedial") as any;
    expect(merged.permissions).toEqual(theirs.permissions);
    expect(merged.hooks.PreToolUse.some((e: any) => e.hooks[0].command === "their-linter")).toBe(true);
    expect(ours(merged)).toBe(4);
  });

  it("is idempotent: running twice does not duplicate hooks", () => {
    const once = mergeClaudeSettings(theirs as any, "modedial");
    const twice = mergeClaudeSettings(once, "modedial");
    expect(twice).toEqual(once);
  });

  it("updating replaces our old command with the new one", () => {
    const a = mergeClaudeSettings({}, "old-cmd");
    const b = mergeClaudeSettings(a, "new-cmd");
    expect(JSON.stringify(b)).not.toContain("old-cmd");
    expect(ours(b)).toBe(4);
  });

  it("remove deletes only our hooks and cleans up empty sections", () => {
    const removed = removeClaudeHooks(mergeClaudeSettings(theirs as any, "modedial")) as any;
    expect(ours(removed)).toBe(0);
    expect(removed.hooks.PreToolUse).toHaveLength(1);
    expect(removed.hooks.Stop).toBeUndefined();
    expect(removeClaudeHooks(mergeClaudeSettings({}, "modedial"))).toEqual({});
  });
});

describe("applyClaudeCode (files)", () => {
  it("creates the settings file in a project that has none", () => {
    const r = applyClaudeCode({ scope: "project", cwd: dir, prefix: "modedial" });
    expect(r.path).toBe(settingsFile());
    expect(ours(readJson())).toBe(4);
  });

  it("dry run writes nothing", () => {
    applyClaudeCode({ scope: "project", cwd: dir, prefix: "modedial", dryRun: true });
    expect(existsSync(settingsFile())).toBe(false);
  });

  it("backs up existing settings and preserves them", () => {
    mkdirSync(join(dir, ".claude"));
    writeFileSync(settingsFile(), JSON.stringify({ model: "x" }));
    applyClaudeCode({ scope: "project", cwd: dir, prefix: "modedial" });
    expect(readJson().model).toBe("x");
    expect(JSON.parse(readFileSync(settingsFile() + ".modedial.bak", "utf8"))).toEqual({ model: "x" });
  });

  it("refuses to touch a settings file that is not valid JSON", () => {
    mkdirSync(join(dir, ".claude"));
    writeFileSync(settingsFile(), "{ nope");
    expect(() => applyClaudeCode({ scope: "project", cwd: dir, prefix: "modedial" })).toThrow(/not valid JSON/);
    expect(readFileSync(settingsFile(), "utf8")).toBe("{ nope");
  });

  it("uninstall removes the hooks again", () => {
    applyClaudeCode({ scope: "project", cwd: dir, prefix: "modedial" });
    applyClaudeCode({ scope: "project", cwd: dir, remove: true });
    expect(ours(readJson())).toBe(0);
  });

  it("user scope targets the home folder, not the project", () => {
    const home = join(dir, "home");
    const r = applyClaudeCode({ scope: "user", cwd: dir, home, prefix: "modedial" });
    expect(r.path).toBe(join(home, ".claude", "settings.json"));
  });
});
