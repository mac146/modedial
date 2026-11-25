import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildClaudeHooks } from "../src/install.js";
import { packageVersion } from "../src/version.js";

const json = (p: string) => JSON.parse(readFileSync(resolve(__dirname, "..", p), "utf8"));

describe("release metadata", () => {
  const pkg = json("package.json");
  const server = json("server.json");

  it("package.json, server.json and the running server agree on name and version", () => {
    expect(server.name).toBe(pkg.mcpName);
    expect(pkg.mcpName).toBe("io.github.mac146/modedial");
    expect(server.version).toBe(pkg.version);
    expect(server.packages).toEqual([{ registryType: "npm", identifier: "modedial", version: pkg.version, transport: { type: "stdio" } }]);
    expect(packageVersion()).toBe(pkg.version);
  });

  it("registry description fits the 100 character limit", () => {
    expect(server.description.length).toBeLessThanOrEqual(100);
  });

  it("the PreToolUse hook also sees modedial's own tools", () => {
    const matcher = new RegExp(`^(?:${buildClaudeHooks("modedial").PreToolUse![0]!.matcher})$`);
    for (const t of ["Write", "Edit", "Bash", "mcp__modedial__end_mode", "mcp__modedial__set_mode"]) expect(t, t).toMatch(matcher);
  });
});
