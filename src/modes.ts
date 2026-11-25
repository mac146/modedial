import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { z } from "zod";

export const ModeSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  tagline: z.string().min(1),
  instructions: z.string().min(1),
  effort_hint: z.enum(["low", "medium", "high"]),
  context_policy: z.string().min(1),
  emoji: z.string().min(1),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  text_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  /**
   * Behavior the modedial hooks enforce on agents that support hooks (today: Claude Code).
   * Without the hooks installed, guards are not enforced and the instructions are advice.
   */
  guards: z.array(z.enum(["read-only", "scope-lock", "verify-before-finish", "protect-manifests", "require-tell"])).default([]),
  /** Phrases the final reply must contain when the "require-tell" guard is on. */
  tell: z.object({ required: z.array(z.string().min(1)).min(1) }).optional(),
});

export type Mode = z.infer<typeof ModeSchema>;

/**
 * Modes are static and bundled with the package. They are never fetched from
 * the network at runtime (prompt-injection risk), and are validated on load.
 */
export function loadModes(): Mode[] {
  const here = dirname(fileURLToPath(import.meta.url));
  const file = join(here, "..", "modes", "modes.json");
  const modes = z.array(ModeSchema).parse(JSON.parse(readFileSync(file, "utf8")));
  const ids = new Set(modes.map((m) => m.id));
  if (ids.size !== modes.length) throw new Error("Duplicate mode id in modes.json");
  return modes;
}

export { findMode } from "./modesLight.js";

/** What the agent receives when a mode is set. */
export function formatModeBundle(m: Mode): string {
  return [
    `Mode set: ${m.emoji} ${m.name} — ${m.tagline}`,
    `Effort hint: ${m.effort_hint}`,
    `Context policy: ${m.context_policy}`,
    "",
    "Follow these instructions until end_mode is called or the user asks for a different mode:",
    m.instructions,
    ...(m.guards.length ? ["", `Guards (enforced only where the modedial hooks are installed): ${m.guards.join(", ")}`] : []),
  ].join("\n");
}
