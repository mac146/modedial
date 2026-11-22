import { describe, expect, it } from "vitest";
import { loadModes } from "../src/modes.js";

describe("bundled modes", () => {
  const modes = loadModes();

  it("has six valid modes with unique ids", () => {
    expect(modes).toHaveLength(6);
    expect(new Set(modes.map((m) => m.id)).size).toBe(6);
  });

  it("keeps instructions under 150 tokens (rough estimate: 4 chars per token)", () => {
    for (const m of modes) expect(m.instructions.length / 4, m.id).toBeLessThan(150);
  });

  it("has no URLs in instructions (static, never network-derived)", () => {
    for (const m of modes) expect(m.instructions, m.id).not.toMatch(/https?:\/\//i);
  });
});
