import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Mode } from "./modes.js";

/**
 * Startup-cheap mode loading for the hooks, which run on every edit and shell command.
 * It skips schema validation (and the zod import it needs): modes.json is bundled with the
 * package and validated by the test suite and by `loadModes()` everywhere else.
 */
export function loadModesFast(): Mode[] {
  const here = dirname(fileURLToPath(import.meta.url));
  const raw = JSON.parse(readFileSync(join(here, "..", "modes", "modes.json"), "utf8")) as Mode[];
  return raw.map((m) => ({ ...m, guards: m.guards ?? [] }));
}

export function findMode(modes: Mode[], id: string): Mode | undefined {
  return modes.find((m) => m.id === id.trim().toLowerCase());
}
