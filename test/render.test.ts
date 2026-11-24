import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { exportLatestCard, projectFooter, writeLatestCard } from "../src/cards.js";
import { loadModes } from "../src/modes.js";
import { svgToPng } from "../src/render/png.js";
import { cardSvg, cleanLabel, esc, recapSvg, wrap } from "../src/render/templates.js";
import { computeRecap } from "../src/stats.js";

const modes = loadModes();
let dir: string;
beforeEach(() => void (dir = mkdtempSync(join(tmpdir(), "modedial-"))));
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const dims = (png: Buffer) => ({ w: png.readUInt32BE(16), h: png.readUInt32BE(20) });

describe("templates", () => {
  it("escapes XML in dynamic text", () => {
    expect(esc(`<a href="x">&'`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
    expect(cardSvg(modes[0]!, { project: "<script>" })).not.toContain("<script>");
  });

  it("cleans and caps footer labels", () => {
    expect(cleanLabel("  my\u0000app  ")).toBe("myapp");
    expect(cleanLabel("x".repeat(40))).toHaveLength(24);
  });

  it("wraps words greedily", () => {
    expect(wrap("The Methodical Tinkerer", 15)).toEqual(["The Methodical", "Tinkerer"]);
  });

  it("omits the project footer unless provided", () => {
    expect(cardSvg(modes[0]!)).not.toContain("my-app");
    expect(cardSvg(modes[0]!, { project: "my-app" })).toContain("my-app");
  });

  it("project footer is opt-in via env", () => {
    expect(projectFooter({} as NodeJS.ProcessEnv, "/a/b/my-app")).toBeUndefined();
    expect(projectFooter({ MODEDIAL_CARD_PROJECT: "1" } as NodeJS.ProcessEnv, "/a/b/my-app")).toBe("my-app");
  });
});

describe("png output", () => {
  it("renders every mode card at 1200x630", () => {
    for (const m of modes) {
      const png = svgToPng(cardSvg(m));
      expect(png.subarray(1, 4).toString()).toBe("PNG");
      expect(dims(png)).toEqual({ w: 1200, h: 630 });
    }
  }, 30000);

  it("renders the recap at 1080x1350", () => {
    const r = computeRecap([
      { v: 1, t: "2026-01-01T22:00:00Z", e: "set", mode: "debug", s: "a" },
      { v: 1, t: "2026-01-01T22:30:00Z", e: "set", mode: "deep-focus", s: "a" },
    ]);
    expect(dims(svgToPng(recapSvg(r, modes)))).toEqual({ w: 1080, h: 1350 });
  });
});

describe("card files", () => {
  it("writes latest.png and exports a copy", () => {
    const file = writeLatestCard(modes[1]!, dir, undefined);
    expect(existsSync(file)).toBe(true);
    const out = join(dir, "export.png");
    exportLatestCard(out, dir);
    expect(readFileSync(out).equals(readFileSync(file))).toBe(true);
  });

  it("export fails clearly when no card exists", () => {
    expect(() => exportLatestCard(join(dir, "x.png"), dir)).toThrow(/No card yet/);
  });
});
