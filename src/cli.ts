#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { exportLatestCard, renderModeCard, renderRecapImage } from "./cards.js";
import { runHook, type HookEvent, type HookInput } from "./hook.js";
import { applyClaudeCode } from "./install.js";
import { EventLog } from "./log.js";
import { findMode, loadModes } from "./modes.js";
import { dataDir } from "./paths.js";
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

const HOOK_EVENTS = new Set<HookEvent>(["pre-tool-use", "post-tool-use", "stop", "session-start"]);

if (cmd === "hook") {
  // Called by the agent's hook system. A bug here must never break the user's session, so every
  // failure means "no opinion": print nothing and exit 0.
  try {
    const event = args[1] as HookEvent;
    if (HOOK_EVENTS.has(event)) {
      const raw = readFileSync(0, "utf8");
      const out = runHook(event, (raw.trim() ? JSON.parse(raw) : {}) as HookInput, { base: dataDir(), modes: loadModes() });
      if (out) process.stdout.write(JSON.stringify(out));
    }
  } catch (e) {
    if (process.env.MODEDIAL_DEBUG) console.error(e);
  }
  process.exit(0);
} else if (cmd === "install" || cmd === "uninstall") {
  const agent = args[1];
  if (agent !== "claude-code") fail(`Supported for now: claude-code. Run "modedial --help".`);
  try {
    const dry = args.includes("--dry-run");
    const r = applyClaudeCode({ scope: args.includes("--user") ? "user" : "project", cwd: process.cwd(), dryRun: dry, remove: cmd === "uninstall" });
    if (dry) console.log(`Would write ${r.path}:\n${JSON.stringify(r.after, null, 2)}`);
    else console.log(`${cmd === "install" ? "Installed modedial hooks into" : "Removed modedial hooks from"} ${r.path}`);
  } catch (e) {
    fail((e as Error).message);
  }
} else if (cmd === "list") {
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
      "  modedial install claude-code [--user] [--dry-run]   add enforcement hooks (project, or --user for all projects)",
      "  modedial uninstall claude-code [--user]             remove them again",
      "  modedial card [--out file.png]         export the latest mode card",
      "  modedial card --mode <id> [--out f]    render a card for any mode",
      "  modedial recap [--image] [--out f]     recap from your local log (text, or PNG)",
    ].join("\n"),
  );
} else {
  await createServer().connect(new StdioServerTransport());
}
