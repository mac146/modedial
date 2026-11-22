#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { EventLog } from "./log.js";
import { loadModes } from "./modes.js";
import { createServer } from "./server.js";
import { computeRecap, formatRecap } from "./stats.js";

const [cmd] = process.argv.slice(2);

if (cmd === "list") {
  for (const m of loadModes()) console.log(`${m.id.padEnd(18)} ${m.emoji} ${m.name} — ${m.tagline}`);
} else if (cmd === "recap") {
  const modes = loadModes();
  const names = Object.fromEntries(modes.map((m) => [m.id, `${m.emoji} ${m.name}`]));
  console.log(formatRecap(computeRecap(new EventLog().readAll()), names));
} else if (cmd === "--help" || cmd === "-h") {
  console.log(
    "modedial: MCP server (stdio). Run with no args to start it.\n  modedial list    show modes\n  modedial recap   show local usage recap",
  );
} else {
  await createServer().connect(new StdioServerTransport());
}
