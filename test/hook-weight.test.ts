import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runHook } from "../src/hook.js";
import { loadModesFast } from "../src/modesLight.js";

/**
 * The hook runs on every edit and shell command, so its start-up time is paid constantly.
 * Walk the runtime imports of the hook entry points and fail if anything heavy sneaks in.
 */
const SRC = resolve(__dirname, "..", "src");
const HEAVY = [/^zod/, /^@modelcontextprotocol/, /^@resvg/];

function runtimeImports(file: string, seen = new Set<string>()): { files: Set<string>; external: Set<string> } {
  const external = new Set<string>();
  const walk = (f: string) => {
    if (seen.has(f)) return;
    seen.add(f);
    const text = readFileSync(f, "utf8");
    for (const m of text.matchAll(/^(?:import|export)\s+(?!type\b)[^;]*?from\s+"([^"]+)"/gm)) {
      const spec = m[1]!;
      if (spec.startsWith(".")) walk(resolve(f, "..", spec.replace(/\.js$/, ".ts")));
      else external.add(spec);
    }
  };
  walk(file);
  return { files: seen, external };
}

describe("hook start-up weight", () => {
  it.each(["hook.ts", "modesLight.ts", "paths.ts"])("%s does not import zod, the MCP SDK or the image renderer", (entry) => {
    const { external, files } = runtimeImports(join(SRC, entry));
    for (const e of external) expect(HEAVY.some((re) => re.test(e)), `${entry} imports ${e}`).toBe(false);
    for (const f of files) expect(f.endsWith("cards.ts") || f.endsWith("server.ts") || f.endsWith("modes.ts"), `${entry} reaches ${f}`).toBe(false);
  });

  it("cli.ts loads everything else lazily", () => {
    const text = readFileSync(join(SRC, "cli.ts"), "utf8");
    const staticImports = [...text.matchAll(/^import\s+[^;]*?from\s+"([^"]+)"/gm)].map((m) => m[1]);
    expect(staticImports).toEqual(["node:fs"]);
  });
});

describe("session state privacy", () => {
  let base: string;
  beforeEach(() => void (base = mkdtempSync(join(tmpdir(), "modedial-priv-"))));
  afterEach(() => rmSync(base, { recursive: true, force: true }));

  it("never stores the names of edited files or any command text", () => {
    const modes = loadModesFast();
    const run = (e: Parameters<typeof runHook>[0], i: object) => runHook(e, { session_id: "p1", cwd: "/proj", ...i }, { base, modes });
    run("post-tool-use", { tool_name: "mcp__modedial__set_mode", tool_input: { id: "debug" } });
    run("post-tool-use", { tool_name: "Edit", tool_input: { file_path: "/secret/client-acme/payroll.ts", old_string: "SECRET_TOKEN_123" } });
    run("post-tool-use", { tool_name: "Bash", tool_input: { command: "curl https://internal.example/api?key=SECRET_TOKEN_123" } });
    const saved = readFileSync(join(base, "sessions", "p1.json"), "utf8");
    for (const leak of ["secret", "acme", "payroll", "SECRET_TOKEN", "internal.example", "curl"]) expect(saved, leak).not.toContain(leak);
    expect(JSON.parse(saved).edits).toBe(1);
  });
});
