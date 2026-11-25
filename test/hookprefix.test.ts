import { describe, expect, it } from "vitest";
import { findGlobalBin, resolveHookPrefix } from "../src/install.js";

describe("findGlobalBin (must not mistake npx's temporary copy for a real install)", () => {
  const win = "C:\\Users\\me\\AppData\\Local\\npm-cache\\_npx\\abc\\node_modules\\.bin;C:\\Users\\me\\AppData\\Roaming\\npm;C:\\Windows";
  const nix = "/home/me/.npm/_npx/abc/node_modules/.bin:/usr/local/bin:/usr/bin";
  const has = (...files: string[]) => (p: string) => files.some((f) => p.replace(/\\/g, "/").endsWith(f));

  it("ignores the npx cache folder even when it comes first on the PATH", () => {
    // the temporary copy exists, and so does a real one further along: only the real one counts
    expect(findGlobalBin("modedial", win, "win32", has("_npx/abc/node_modules/.bin/modedial.cmd", "Roaming/npm/modedial.cmd"))).toMatch(/Roaming/);
    const found = findGlobalBin("modedial", nix, "linux", has("_npx/abc/node_modules/.bin/modedial", "/usr/local/bin/modedial"));
    expect(found?.replace(/\\/g, "/")).toBe("/usr/local/bin/modedial");
  });

  it("returns null when the only copy is npx's temporary one", () => {
    expect(findGlobalBin("modedial", win, "win32", has("_npx/abc/node_modules/.bin/modedial.cmd"))).toBeNull();
    expect(findGlobalBin("modedial", nix, "linux", has("_npx/abc/node_modules/.bin/modedial"))).toBeNull();
  });

  it("returns null for an empty PATH", () => {
    expect(findGlobalBin("modedial", "", "linux", () => true)).toBeNull();
  });

  it("an installer running through npx with only the temporary copy refuses", () => {
    const cli = "C:\\Users\\me\\AppData\\Local\\npm-cache\\_npx\\abc\\node_modules\\modedial\\dist\\cli.js";
    const found = () => findGlobalBin("modedial", win, "win32", has("_npx/abc/node_modules/.bin/modedial.cmd")) !== null;
    expect(() => resolveHookPrefix(cli, found)).toThrow(/npm install -g modedial/);
  });
});

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
