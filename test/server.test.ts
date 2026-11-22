import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EventLog } from "../src/log.js";
import { createServer } from "../src/server.js";

let dir: string;
let client: Client;
let log: EventLog;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "modedial-"));
  log = new EventLog(dir, true);
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer({ log }).connect(b);
  client = new Client({ name: "test", version: "0" });
  await client.connect(a);
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const call = async (name: string, args: Record<string, unknown> = {}) => {
  const r = (await client.callTool({ name, arguments: args })) as { content: { text: string }[]; isError?: boolean };
  return { text: r.content[0]!.text, isError: !!r.isError };
};

describe("tools", () => {
  it("exposes the five tools", async () => {
    const names = (await client.listTools()).tools.map((t) => t.name).sort();
    expect(names).toEqual(["current_mode", "end_mode", "list_modes", "recap", "set_mode"]);
  });

  it("lists six modes", async () => {
    expect((await call("list_modes")).text.split("\n")).toHaveLength(6);
  });

  it("set_mode returns instructions, tracks state and logs the switch", async () => {
    const r = await call("set_mode", { id: "deep-focus" });
    expect(r.text).toMatch(/Deep Focus/);
    expect(r.text).toMatch(/Follow these instructions/);
    expect((await call("current_mode")).text).toMatch(/deep-focus/);
    expect(readFileSync(log.file, "utf8")).toMatch(/"mode":"deep-focus"/);
  });

  it("rejects unknown ids with the valid list", async () => {
    const r = await call("set_mode", { id: "nope" });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/deep-focus/);
  });

  it("end_mode returns to default", async () => {
    await call("set_mode", { id: "debug" });
    await call("end_mode");
    expect((await call("current_mode")).text).toMatch(/No mode active/);
  });

  it("recap reflects the local log", async () => {
    await call("set_mode", { id: "debug" });
    expect((await call("recap")).text).toMatch(/1 mode switches/);
  });
});
