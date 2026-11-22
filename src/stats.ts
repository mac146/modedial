import type { LogEvent } from "./log.js";

export interface Recap {
  totalSwitches: number;
  perMode: Record<string, { switches: number; minutes: number }>;
  topModes: string[];
  byTimeOfDay: Record<"morning" | "afternoon" | "evening" | "night", string | null>;
  longestStreak: { mode: string; minutes: number } | null;
  personality: string;
}

const CAP_MINUTES = 240; // a mode with no later event counts as at most 4h

export function part(hour: number): "morning" | "afternoon" | "evening" | "night" {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

/** Playful label, for fun only; not a claim about the agent. */
export function personality(topMode: string | undefined, total: number): string {
  if (!topMode || total === 0) return "The Newcomer";
  const labels: Record<string, string> = {
    "deep-focus": "The Steady Beam",
    debug: "The Methodical Tinkerer",
    "chill-refactor": "The Tidy Gardener",
    "creative-sprint": "The Idea Fountain",
    "careful-reviewer": "The Careful Reader",
    "fast-prototype": "The Quick Builder",
  };
  return labels[topMode] ?? "The Mode Explorer";
}

export function computeRecap(events: LogEvent[]): Recap {
  const sorted = [...events].sort((a, b) => a.t.localeCompare(b.t));
  const perMode: Recap["perMode"] = {};
  const timeCounts: Record<string, Record<string, number>> = {
    morning: {},
    afternoon: {},
    evening: {},
    night: {},
  };
  let total = 0;
  let longest: Recap["longestStreak"] = null;

  // A mode run lasts from its set event to the next event in the same session.
  const bySession = new Map<string, LogEvent[]>();
  for (const e of sorted) {
    if (!bySession.has(e.s)) bySession.set(e.s, []);
    bySession.get(e.s)!.push(e);
  }
  for (const evs of bySession.values()) {
    evs.forEach((e, i) => {
      if (e.e !== "set" || !e.mode) return;
      total++;
      const m = (perMode[e.mode] ??= { switches: 0, minutes: 0 });
      m.switches++;
      const next = evs[i + 1];
      const minutes = next ? Math.min((Date.parse(next.t) - Date.parse(e.t)) / 60000, CAP_MINUTES) : 0;
      m.minutes += minutes;
      if (!longest || minutes > longest.minutes) longest = { mode: e.mode, minutes };
      const bucket = timeCounts[part(new Date(e.t).getHours())]!;
      bucket[e.mode] = (bucket[e.mode] ?? 0) + 1;
    });
  }

  const topModes = Object.entries(perMode)
    .sort((a, b) => b[1].switches - a[1].switches || a[0].localeCompare(b[0]))
    .map(([id]) => id);
  const byTimeOfDay = {} as Recap["byTimeOfDay"];
  for (const k of ["morning", "afternoon", "evening", "night"] as const) {
    const top = Object.entries(timeCounts[k]!).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    byTimeOfDay[k] = top ? top[0] : null;
  }
  return {
    totalSwitches: total,
    perMode,
    topModes,
    byTimeOfDay,
    longestStreak: longest,
    personality: personality(topModes[0], total),
  };
}

export function formatRecap(r: Recap, names: Record<string, string> = {}): string {
  if (r.totalSwitches === 0) return "No mode switches logged yet. Call set_mode to get started.";
  const n = (id: string) => names[id] ?? id;
  const lines = [
    `Recap (from local log only): ${r.totalSwitches} mode switches`,
    `Top modes: ${r.topModes
      .slice(0, 3)
      .map((id) => `${n(id)} (${r.perMode[id]!.switches})`)
      .join(", ")}`,
    ...(["morning", "afternoon", "evening", "night"] as const)
      .filter((k) => r.byTimeOfDay[k])
      .map((k) => `Most used in the ${k}: ${n(r.byTimeOfDay[k]!)}`),
  ];
  if (r.longestStreak) {
    lines.push(`Longest stretch in one mode: ${n(r.longestStreak.mode)}, ${Math.round(r.longestStreak.minutes)} min`);
  }
  lines.push(`Personality label (just for fun): ${r.personality}`);
  return lines.join("\n");
}
