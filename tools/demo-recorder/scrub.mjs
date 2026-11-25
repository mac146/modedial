// Removes local machine details from captured data before it is committed or shown.
// Works on parsed values (not raw text), so escaped backslashes in JSON cannot slip past.
import { readFileSync, writeFileSync } from "node:fs";
import os from "node:os";

const TEMP_PROJECT = /[A-Za-z]:[\\/]+Users[\\/]+[^\\/]+(?:[\\/]+[^\\/]+)?[\\/]+AppData[\\/]+Local[\\/]+Temp[\\/]+(?:[^\\/\s"'`]+[\\/]+)*?modedial-cap-[A-Za-z0-9]+[\\/]+my-app/g;
const TEMP_ANY = /[A-Za-z]:[\\/]+Users[\\/]+[^\\/]+(?:[\\/]+[^\\/]+)?[\\/]+AppData[\\/]+Local[\\/]+Temp[\\/]+(?:[^\\/\s"'`]+[\\/]+)*?modedial-cap-[A-Za-z0-9]+/g;
const HOME = /[A-Za-z]:[\\/]+Users[\\/]+[^\\/\s"'`]+(?:[ ][^\\/\s"'`]+)*/g;

// Claude Code also names its per-project folders by dash-encoding the path: C--Users-name-AppData-Local-Temp-...
const DASHED = /[A-Za-z]--Users-[A-Za-z0-9-]*?-AppData-Local-Temp-(?:modedial-cap-[A-Za-z0-9]+-my-app|[A-Za-z0-9-]*)/g;

export function scrubString(s) {
  let out = s.replace(DASHED, "my-app").replace(TEMP_PROJECT, "~/my-app").replace(TEMP_ANY, "~").replace(HOME, "~");
  out = out.replace(/~[\\/]+AppData[\\/]+Local[\\/]+Temp[\\/]+/g, "~/tmp/");
  // show sub-paths with forward slashes
  out = out.replace(/(~\/my-app)((?:[\\/][^\s"'`]*)?)/g, (_, a, b) => a + b.replace(/\\/g, "/"));
  return out;
}

export function deepScrub(v) {
  if (typeof v === "string") return scrubString(v);
  if (Array.isArray(v)) return v.map(deepScrub);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deepScrub(x)]));
  return v;
}

/** Local details that must never remain in captured data. */
// The account name is looked up when this runs, never written into the source, so the repository
// does not contain anyone's name. Every part of the account name counts ("jane doe" also flags "doe").
const account = os.userInfo().username;
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const nameParts = [account, ...account.split(/[\s._-]+/)].filter((p) => p.length >= 3);
export const LEAK = new RegExp([...nameParts.map(escapeRe), "modedial-cap-", "AppData", "C:\\\\+Users"].join("|"), "i");

export function scrubFile(path) {
  const data = deepScrub(JSON.parse(readFileSync(path, "utf8")));
  writeFileSync(path, JSON.stringify(data, null, 1));
  const left = JSON.stringify(data).match(new RegExp(LEAK.source, "gi")) ?? [];
  return left.length;
}

if (process.argv[1] && process.argv[1].endsWith("scrub.mjs")) {
  const left = scrubFile(process.argv[2] ?? "captured/sessions.json");
  console.log(left === 0 ? "scrubbed: no local paths or names remain" : `STILL LEAKING: ${left} matches`);
  process.exit(left === 0 ? 0 : 1);
}
