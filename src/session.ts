import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { emptyState, type SessionState } from "./guards.js";

/**
 * Per-session mode state, written by the hooks. Keyed by the agent's session id, so two
 * sessions in different terminals never share a mode. Holds only the mode id, a scope list,
 * and edit/verify flags. File names the agent edited are paths only, never contents.
 */
export const sessionsDir = (base: string) => join(base, "sessions");
export const safeId = (id: unknown): string => String(id ?? "default").replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 80) || "default";

export function readState(base: string, sessionId: unknown): SessionState {
  try {
    const s = JSON.parse(readFileSync(join(sessionsDir(base), `${safeId(sessionId)}.json`), "utf8")) as SessionState;
    return s && s.v === 1 ? s : emptyState();
  } catch {
    return emptyState();
  }
}

/** Atomic write: a hook killed mid-write must not leave a half-written file. */
export function writeState(base: string, sessionId: unknown, state: SessionState): void {
  const dir = sessionsDir(base);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${safeId(sessionId)}.json`);
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(state), "utf8");
  renameSync(tmp, file);
}

export function pruneOldSessions(base: string, maxAgeMs = 7 * 24 * 3600 * 1000, now = Date.now()): void {
  const dir = sessionsDir(base);
  if (!existsSync(dir)) return;
  for (const f of readdirSync(dir)) {
    try {
      if (now - statSync(join(dir, f)).mtimeMs > maxAgeMs) unlinkSync(join(dir, f));
    } catch {
      /* ignore */
    }
  }
}
