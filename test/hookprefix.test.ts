import { describe, expect, it } from "vitest";
import { resolveHookPrefix } from "../src/install.js";

describe("resolveHookPrefix (hooks run on every edit, so they must start fast)", () => {
  const npxCli = "C:\\Users\\me\\AppData\\Local\\npm-cache\\_npx\\abc123\\node_modules\\modedial\\dist\\cli.js";
  const posixNpx = "/home/me/.npm/_npx/abc123/node_modules/modedial/dist/cli.js";
  const local = "/home/me/proj/node_modules/modedial/dist/cli.js";

  it("uses the exact local build when not running through npx", () => {
    expect(resolveHookPrefix(local, () => false)).toBe(`node "${local}"`);
    expect(resolveHookPrefix("C:\\dev\\tbd\\dist\\cli.js", () => false)).toBe('node "C:/dev/tbd/dist/cli.js"');
  });

  it("through npx, uses the global command when one exists", () => {
    expect(resolveHookPrefix(npxCli, () => true)).toBe("modedial");
    expect(resolveHookPrefix(posixNpx, () => true)).toBe("modedial");
  });

  it("through npx with no global install, refuses to write slow npx hooks and says what to do", () => {
    expect(() => resolveHookPrefix(npxCli, () => false)).toThrow(/npm install -g modedial/);
    expect(() => resolveHookPrefix(posixNpx, () => false)).toThrow(/modedial install claude-code/);
  });

  it("never falls back to a path inside the npx cache", () => {
    let out = "";
    try { out = resolveHookPrefix(npxCli, () => false); } catch { /* expected */ }
    expect(out).not.toContain("_npx");
  });
});
