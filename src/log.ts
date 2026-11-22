import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "./paths.js";

/**
 * Privacy contract: a log line holds only a schema version, a timestamp, an
 * event type, a mode id and a random per-process session id. Never code,
 * prompts, file paths or file contents.
 */
export interface LogEvent {
  v: 1;
  t: string; // ISO timestamp
  e: "set" | "end";
  mode?: string;
  s: string; // random session id, one per server process
}

const MAX_BYTES = 1_000_000;

export class EventLog {
  constructor(
    private readonly dir: string = dataDir(),
    private readonly enabled: boolean = process.env.MODEDIAL_NO_LOG !== "1",
  ) {}

  get file(): string {
    return join(this.dir, "log.jsonl");
  }

  /** Never throws: logging must not break a tool call. */
  append(event: Omit<LogEvent, "v">): void {
    if (!this.enabled) return;
    try {
      mkdirSync(this.dir, { recursive: true });
      this.rotateIfNeeded();
      appendFileSync(this.file, JSON.stringify({ v: 1, ...event }) + "\n", "utf8");
    } catch {
      /* ignore */
    }
  }

  private rotateIfNeeded(): void {
    if (existsSync(this.file) && statSync(this.file).size > MAX_BYTES) {
      renameSync(this.file, join(this.dir, "log.1.jsonl"));
    }
  }

  /** Reads rotated + current log, skipping malformed lines. */
  readAll(): LogEvent[] {
    const events: LogEvent[] = [];
    for (const f of [join(this.dir, "log.1.jsonl"), this.file]) {
      if (!existsSync(f)) continue;
      for (const line of readFileSync(f, "utf8").split("\n")) {
        if (!line.trim()) continue;
        try {
          const e = JSON.parse(line) as LogEvent;
          if (e.v === 1 && typeof e.t === "string" && (e.e === "set" || e.e === "end")) events.push(e);
        } catch {
          /* skip bad line */
        }
      }
    }
    return events;
  }
}
