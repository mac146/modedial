import type { Mode } from "../modes.js";
import type { Recap } from "../stats.js";
import { glyph } from "./glyphs.js";

const INK = "#14161B";
const INK_2 = "#4A5160";
const BG = "#EDF0F5";
const DISPLAY = "Bricolage Grotesque";
const BODY = "Instrument Sans";
const MONO = "JetBrains Mono";

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Keep footer text short and free of control characters. */
export function cleanLabel(s: string, max = 24): string {
  return s.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
}

/** Greedy word wrap by character count (SVG has no auto-wrap). */
export function wrap(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (line && (line + " " + word).length > maxChars) {
      lines.push(line);
      line = word;
    } else {
      line = line ? line + " " + word : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export const CARD_SIZE = { width: 1200, height: 630 };
export const RECAP_SIZE = { width: 1080, height: 1350 };

/** "Mode card": 1200x630, ready for social previews. */
export function cardSvg(mode: Mode, opts: { project?: string } = {}): string {
  const { width: W, height: H } = CARD_SIZE;
  const bandW = 168;
  const nameLines = wrap(mode.name, 9).slice(0, 2);
  const nameSize = nameLines.length > 1 ? 118 : 150;
  const nameY0 = nameLines.length > 1 ? 270 : 330;
  const footer = "modedial · modes for coding agents" + (opts.project ? ` · ${cleanLabel(opts.project)}` : "");

  let ridges = "";
  const bx = W - 24 - bandW;
  for (let y = 40; y < H - 30; y += 18) ridges += `<rect x="${bx}" y="${y}" width="${bandW}" height="2" fill="#000" opacity="0.1"/>`;
  // band with rounded right corners that match the card
  const band = `M${bx} 24 H${W - 24 - 22} A22 22 0 0 1 ${W - 24} 46 V${H - 46} A22 22 0 0 1 ${W - 24 - 22} ${H - 24} H${bx} Z`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <rect x="24" y="24" width="${W - 48}" height="${H - 48}" rx="22" fill="#FFFFFF"/>
  <path d="${band}" fill="${mode.color}"/>
  ${ridges}
  <circle cx="${W - bandW / 2 - 24}" cy="${H / 2}" r="60" fill="#FFFFFF"/>
  ${glyph(mode.id, W - bandW / 2 - 24, H / 2, 62, INK)}
  <rect x="80" y="70" width="248" height="46" rx="4" fill="${mode.color}"/>
  <text x="204" y="102" text-anchor="middle" font-family="${MONO}" font-weight="700" font-size="22" letter-spacing="3" fill="${mode.text_color}">NOW IN MODE</text>
  ${nameLines
    .map(
      (l, i) =>
        `<text x="76" y="${nameY0 + i * (nameSize * 0.98)}" font-family="${DISPLAY}" font-weight="800" font-size="${nameSize}" letter-spacing="-4" fill="${INK}">${esc(l)}</text>`,
    )
    .join("\n  ")}
  <text x="80" y="${nameY0 + (nameLines.length - 1) * nameSize * 0.98 + 58}" font-family="${BODY}" font-weight="600" font-size="38" fill="${INK_2}">“${esc(mode.tagline)}”</text>
  <rect x="80" y="${H - 140}" width="${(`EFFORT ${mode.effort_hint}`.length * 14.2 + 40).toFixed(0)}" height="44" rx="4" fill="${INK}"/>
  <text x="100" y="${H - 110}" font-family="${MONO}" font-weight="700" font-size="20" letter-spacing="2" fill="#FFFFFF">EFFORT ${esc(mode.effort_hint.toUpperCase())}</text>
  <text x="80" y="${H - 52}" font-family="${MONO}" font-weight="500" font-size="21" fill="${INK_2}">${esc(footer)}</text>
</svg>`;
}

function fmtMinutes(m: number): string {
  const r = Math.round(m);
  return r < 60 ? `${r}m` : `${Math.floor(r / 60)}h ${String(r % 60).padStart(2, "0")}m`;
}

const TIME_LABEL = { morning: "Morning", afternoon: "Afternoon", evening: "Evening", night: "Night" } as const;

/** "Recap": 1080x1350 (4:5), from local log stats only. */
export function recapSvg(r: Recap, modes: Mode[], opts: { year?: number } = {}): string {
  const { width: W, height: H } = RECAP_SIZE;
  const byId = new Map(modes.map((m) => [m.id, m]));
  const top = r.topModes.slice(0, 3);
  const max = Math.max(1, ...top.map((id) => r.perMode[id]!.switches));
  const year = opts.year ?? new Date().getFullYear();
  const lines = wrap(r.personality, 15).slice(0, 3);

  // decorative tape strips in the colors of the top modes
  const strips = top
    .map((id, i) => {
      const m = byId.get(id);
      return m ? `<rect x="${W - 60 - i * 62}" y="-40" width="42" height="400" fill="${m.color}" transform="rotate(28 ${W} 0)"/>` : "";
    })
    .join("");

  const bars = top
    .map((id, i) => {
      const m = byId.get(id);
      const y = 640 + i * 92;
      const w = Math.max(24, Math.round((r.perMode[id]!.switches / max) * 520));
      return `<text x="80" y="${y + 30}" font-family="${BODY}" font-weight="600" font-size="34" fill="#F1F3F8">${esc(m?.name ?? id)}</text>
  <rect x="440" y="${y}" width="${w}" height="40" rx="4" fill="${m?.color ?? "#999"}"/>
  <rect x="440" y="${y + 33}" width="${w}" height="7" rx="3" fill="#000" opacity="0.18"/>
  <text x="${440 + w + 16}" y="${y + 30}" font-family="${MONO}" font-weight="700" font-size="26" fill="#F1F3F8">${r.perMode[id]!.switches}</text>`;
    })
    .join("\n  ");

  const tiles = [
    { big: String(r.totalSwitches), label: "mode switches" },
    { big: r.longestStreak ? fmtMinutes(r.longestStreak.minutes) : "–", label: "longest stretch" },
    { big: r.busiestTime ? TIME_LABEL[r.busiestTime] : "–", label: "busiest time of day" },
  ]
    .map(
      (t, i) => `<rect x="${80 + i * 315}" y="990" width="290" height="190" rx="14" fill="#F1F3F8"/>
  <text x="${80 + i * 315 + 24}" y="1082" font-family="${DISPLAY}" font-weight="800" font-size="${t.big.length > 6 ? 52 : 74}" letter-spacing="-2" fill="${INK}">${esc(t.big)}</text>
  <text x="${80 + i * 315 + 24}" y="1136" font-family="${MONO}" font-weight="500" font-size="19" fill="${INK_2}">${esc(t.label)}</text>`,
    )
    .join("\n  ");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${INK}"/>
  <g clip-path="inset(0)">${strips}</g>
  <text x="80" y="120" font-family="${MONO}" font-weight="700" font-size="24" letter-spacing="5" fill="#F1F3F8" opacity="0.8">YOUR AGENT RECAP · ${year}</text>
  ${lines
    .map(
      (l, i) =>
        `<text x="76" y="${250 + i * 96}" font-family="${DISPLAY}" font-weight="800" font-size="92" letter-spacing="-3" fill="#FFFFFF">${esc(l)}</text>`,
    )
    .join("\n  ")}
  <text x="80" y="${250 + (lines.length - 1) * 96 + 52}" font-family="${MONO}" font-weight="500" font-size="22" fill="#F1F3F8" opacity="0.7">agent personality (just for fun)</text>
  <text x="80" y="590" font-family="${MONO}" font-weight="700" font-size="22" letter-spacing="4" fill="#F1F3F8" opacity="0.8">TOP MODES</text>
  ${bars}
  ${tiles}
  <text x="80" y="1268" font-family="${MONO}" font-weight="500" font-size="20" fill="#F1F3F8" opacity="0.7">modedial · built from my local log, nothing uploaded</text>
</svg>`;
}
