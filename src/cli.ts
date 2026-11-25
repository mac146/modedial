#!/usr/bin/env node
// Every command loads its modules lazily. The `hook` command runs on every edit and shell command
// inside the agent, so it must start fast: it must not import the MCP SDK, zod or the image renderer.
import { readFileSync } from "node:fs";

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

const HOOK_EVENTS = new Set(["pre-tool-use", "post-tool-use", "stop", "session-start"]);

if (cmd === "hook") {
  // A bug here must never break the user's session, so every failure means "no opinion":
  // print nothing and exit 0.
  try {
    const event = args[1] as "pre-tool-use" | "post-tool-use" | "stop" | "session-start";
    if (HOOK_EVENTS.has(event)) {
      const [{ runHook }, { loadModesFast }, { dataDir }] = await Promise.all([import("./hook.js"), import("./modesLight.js"), import("./paths.js")]);
      const raw = readFileSync(0, "utf8");
      const out = runHook(event, raw.trim() ? JSON.parse(raw) : {}, { base: dataDir(), modes: loadModesFast() });
      if (out) {
        // exit only after stdout is flushed, so a pipe can never truncate the decision
        process.stdout.write(JSON.stringify(out), () => process.exit(0));
        await new Promise(() => {});
      }
    }
  } catch (e) {
    if (process.env.MODEDIAL_DEBUG) console.error(e);
  }
  process.exit(0);
} else if (cmd === "install" || cmd === "uninstall") {
  try {
    const { runInstall } = await import("./installCmd.js");
    console.log(runInstall(cmd, args.slice(1), { cwd: process.cwd() }));
  } catch (e) {
    fail((e as Error).message);
  }
} else if (cmd === "list") {
  const { loadModes } = await import("./modes.js");
  for (const m of loadModes()) console.log(`${m.id.padEnd(18)} ${m.emoji} ${m.name} — ${m.tagline}`);
} else if (cmd === "card") {
  const out = flag("--out") ?? "modedial-card.png";
  const id = flag("--mode");
  try {
    const { exportLatestCard, renderModeCard } = await import("./cards.js");
    if (id) {
      const { findMode, loadModes } = await import("./modes.js");
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
  const [{ loadModes }, { EventLog }, { computeRecap, formatRecap }] = await Promise.all([import("./modes.js"), import("./log.js"), import("./stats.js")]);
  const modes = loadModes();
  const recap = computeRecap(new EventLog().readAll());
  if (args.includes("--image")) {
    if (recap.totalSwitches === 0) fail("No mode switches logged yet, so there is nothing to draw.");
    const { renderRecapImage } = await import("./cards.js");
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
      "  modedial install                       list supported agents",
      "  modedial install <agent|all> [--user] [--dry-run]   set up modes for an agent (claude-code gets enforcement hooks)",
      "  modedial uninstall <agent|all> [--user]             remove exactly what install added",
      "  modedial card [--out file.png]         export the latest mode card",
      "  modedial card --mode <id> [--out f]    render a card for any mode",
      "  modedial recap [--image] [--out f]     recap from your local log (text, or PNG)",
    ].join("\n"),
  );
} else {
  const [{ StdioServerTransport }, { createServer }] = await Promise.all([import("@modelcontextprotocol/sdk/server/stdio.js"), import("./server.js")]);
  await createServer().connect(new StdioServerTransport());
}
