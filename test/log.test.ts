import { appendFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EventLog } from "../src/log.js";
import { dataDir } from "../src/paths.js";

let dir: string;
beforeEach(() => void (dir = mkdtempSync(join(tmpdir(), "modedial-"))));
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("EventLog", () => {
  it("stores only version, time, event, mode and session id", () => {
    const log = new EventLog(dir, true);
    log.append({ t: "2026-01-01T10:00:00.000Z", e: "set", mode: "debug", s: "abc" });
    const line = JSON.parse(readFileSync(log.file, "utf8").trim());
    expect(Object.keys(line).sort()).toEqual(["e", "mode", "s", "t", "v"]);
  });

  it("skips malformed lines when reading", () => {
    const log = new EventLog(dir, true);
    log.append({ t: "2026-01-01T10:00:00.000Z", e: "set", mode: "debug", s: "abc" });
    appendFileSync(log.file, "not json\n{\"v\":9}\n");
    expect(log.readAll()).toHaveLength(1);
  });

  it("writes nothing when disabled", () => {
    const log = new EventLog(dir, false);
    log.append({ t: "2026-01-01T10:00:00.000Z", e: "set", mode: "debug", s: "abc" });
    expect(log.readAll()).toEqual([]);
  });

  it("never throws if the directory is unwritable", () => {
    const log = new EventLog(join(dir, "log.jsonl", "nope"), true);
    appendFileSync(join(dir, "log.jsonl"), "x"); // a file where a directory is needed
    expect(() => log.append({ t: "2026-01-01T10:00:00.000Z", e: "end", s: "abc" })).not.toThrow();
  });
});

describe("dataDir", () => {
  it("honors MODEDIAL_HOME and OS conventions", () => {
    expect(dataDir({ MODEDIAL_HOME: "/x" } as NodeJS.ProcessEnv, "linux")).toBe("/x");
    expect(dataDir({ APPDATA: "C:\\A" } as NodeJS.ProcessEnv, "win32")).toContain("modedial");
    expect(dataDir({ XDG_DATA_HOME: "/d" } as NodeJS.ProcessEnv, "linux")).toBe(join("/d", "modedial"));
  });
});
