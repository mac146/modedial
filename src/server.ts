import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { EventLog } from "./log.js";
import { writeLatestCard } from "./cards.js";
import { findMode, formatModeBundle, loadModes, type Mode } from "./modes.js";
import { dataDir } from "./paths.js";
import { computeRecap, formatRecap } from "./stats.js";

const text = (t: string, isError = false) => ({
  content: [{ type: "text" as const, text: t }],
  ...(isError ? { isError: true } : {}),
});

export function createServer(
  opts: { modes?: Mode[]; log?: EventLog; version?: string; cardDir?: string; cards?: boolean } = {},
) {
  const modes = opts.modes ?? loadModes();
  const log = opts.log ?? new EventLog();
  const cardsOn = opts.cards ?? process.env.MODEDIAL_NO_CARD !== "1";
  const session = randomBytes(4).toString("hex");
  let current: Mode | null = null;

  const server = new McpServer({ name: "modedial", version: opts.version ?? "0.1.0" });

  server.registerTool(
    "list_modes",
    { description: "List the available agent modes (id, name, tagline).", inputSchema: {} },
    async () => text(modes.map((m) => `${m.id} | ${m.emoji} ${m.name} | ${m.tagline}`).join("\n")),
  );

  server.registerTool(
    "set_mode",
    {
      description:
        "Activate a mode. Returns short instructions you should follow until end_mode is called or the user picks another mode.",
      inputSchema: { id: z.string().describe("Mode id from list_modes, e.g. deep-focus") },
    },
    async ({ id }) => {
      const m = findMode(modes, id);
      if (!m) return text(`Unknown mode "${id}". Valid ids: ${modes.map((x) => x.id).join(", ")}`, true);
      current = m;
      log.append({ t: new Date().toISOString(), e: "set", mode: m.id, s: session });
      let bundle = formatModeBundle(m);
      if (cardsOn) {
        try {
          const file = writeLatestCard(m, opts.cardDir ?? dataDir());
          bundle += `\n\n(Mode card saved locally: ${file})`;
        } catch {
          /* a card failure must never break a mode switch */
        }
      }
      return text(bundle);
    },
  );

  server.registerTool(
    "current_mode",
    { description: "Return the active mode, if any.", inputSchema: {} },
    async () =>
      text(
        current
          ? `Active mode: ${current.emoji} ${current.name} (${current.id})`
          : "No mode active (default behavior).",
      ),
  );

  server.registerTool(
    "end_mode",
    { description: "Leave the active mode and return to default behavior.", inputSchema: {} },
    async () => {
      if (!current) return text("No mode was active. Default behavior continues.");
      const prev = current;
      current = null;
      log.append({ t: new Date().toISOString(), e: "end", mode: prev.id, s: session });
      return text(`Ended ${prev.name}. Return to default behavior and drop that mode's instructions.`);
    },
  );

  server.registerTool(
    "recap",
    { description: "Usage stats computed from the local log only (nothing is sent anywhere).", inputSchema: {} },
    async () => {
      const names = Object.fromEntries(modes.map((m) => [m.id, `${m.emoji} ${m.name}`]));
      return text(formatRecap(computeRecap(log.readAll()), names));
    },
  );

  return server;
}
