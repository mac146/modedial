import { describe, expect, it } from "vitest";
import type { LogEvent } from "../src/log.js";
import { computeRecap, formatRecap, part } from "../src/stats.js";

const ev = (t: string, e: "set" | "end", mode: string | undefined, s = "a"): LogEvent => ({ v: 1, t, e, mode, s });

describe("computeRecap", () => {
  it("handles an empty log", () => {
    const r = computeRecap([]);
    expect(r.totalSwitches).toBe(0);
    expect(r.personality).toBe("The Newcomer");
    expect(formatRecap(r)).toMatch(/No mode switches/);
  });

  it("counts switches, ranks modes and finds the longest stretch", () => {
    const r = computeRecap([
      ev("2026-01-01T10:00:00Z", "set", "debug"),
      ev("2026-01-01T10:30:00Z", "set", "deep-focus"),
      ev("2026-01-01T12:00:00Z", "end", "deep-focus"),
      ev("2026-01-02T10:00:00Z", "set", "debug", "b"),
    ]);
    expect(r.totalSwitches).toBe(3);
    expect(r.topModes[0]).toBe("debug");
    expect(r.longestStreak).toEqual({ mode: "deep-focus", minutes: 90 });
    expect(r.personality).toBe("The Methodical Tinkerer");
  });

  it("caps an unfinished run at 4 hours", () => {
    const r = computeRecap([ev("2026-01-01T00:00:00Z", "set", "debug"), ev("2026-01-02T00:00:00Z", "end", "debug")]);
    expect(r.longestStreak?.minutes).toBe(240);
  });
});

describe("part", () => {
  it("buckets hours", () => {
    expect([part(6), part(13), part(19), part(23), part(2)]).toEqual(["morning", "afternoon", "evening", "night", "night"]);
  });
});
