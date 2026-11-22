#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { exportLatestCard, renderModeCard, renderRecapImage } from "./cards.js";
import { EventLog } from "./log.js";
import { findMode, loadModes } from "./modes.js";
import { createServer } from "./server.js";
import { computeRecap, formatRecap } from "./stats.js";

const args = process.argv.slice(2);
const [cmd] = args;
const flag = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const fail = (msg: string): never => {
  console.error(msg);
  process.exit(1);
};

if (cmd === "list") {
  for (const m of loadModes()) console.log(`${m.id.padEnd(18)} ${m.emoji} ${m.name} — ${m.tagline}`);
} else if (cmd === "card") {
  const out = flag("--out") ?? "modedial-card.png";
  const id = flag("--mode");
  try {
    if (id) {
      const m = findMode(loadModes(), id);
      if (!m) fail(`Unknown mode "${id}". Run "modedial list".`);
      console.log(`Saved ${renderModeCard(m!, out)}`);
    } else {
      console.log(`Saved ${exportLatestCard(out)}`);
    }
  } catch (e) {
    fail((e as Error).message);
  }
} else if (cmd === "recap") {
  const modes = loadModes();
  const recap = computeRecap(new EventLog().readAll());
  if (args.includes("--image")) {
    if (recap.totalSwitches === 0) fail("No mode switches logged yet, so there is nothing to draw.");
    console.log(`Saved ${renderRecapImage(recap, modes, flag("--out") ?? "modedial-recap.png")}`);
  } else {
    const names = Object.fromEntries(modes.map((m) => [m.id, `${m.emoji} ${m.name}`]));
    console.log(formatRecap(recap, names));
  }
} else if (cmd === "--help" || cmd === "-h") {
  console.log(
    [
      "modedial: MCP server (stdio). Run with no args to start it.",
      "  modedial list                          show modes",
      "  modedial card [--out file.png]         export the latest mode card",
      "  modedial card --mode <id> [--out f]    render a card for any mode",
      "  modedial recap [--image] [--out f]     recap from your local log (text, or PNG)",
    ].join("\n"),
  );
} else {
  await createServer().connect(new StdioServerTransport());
}
