import { basename } from "node:path";
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Mode } from "./modes.js";
import type { Recap } from "./stats.js";
import { cardSvg, recapSvg } from "./render/templates.js";
import { svgToPng } from "./render/png.js";
import { dataDir } from "./paths.js";

export const cardsDir = (base = dataDir()) => join(base, "cards");
export const latestCardPath = (base = dataDir()) => join(cardsDir(base), "latest.png");

/**
 * The card footer shows the project folder name only if the user opts in
 * (MODEDIAL_CARD_PROJECT=1). It is rendered into the image on this machine
 * and never written to the log.
 */
export function projectFooter(env = process.env, cwd = process.cwd()): string | undefined {
  return env.MODEDIAL_CARD_PROJECT === "1" ? basename(cwd) : undefined;
}

/** Renders the mode card, saves it as cards/latest.png and returns the path. */
export function writeLatestCard(mode: Mode, base = dataDir(), project = projectFooter()): string {
  const dir = cardsDir(base);
  mkdirSync(dir, { recursive: true });
  const file = latestCardPath(base);
  writeFileSync(file, svgToPng(cardSvg(mode, { project })));
  return file;
}

export function exportLatestCard(out: string, base = dataDir()): string {
  const src = latestCardPath(base);
  if (!existsSync(src)) throw new Error("No card yet. Set a mode first, or pass --mode <id>.");
  const dest = resolve(out);
  copyFileSync(src, dest);
  return dest;
}

export function renderModeCard(mode: Mode, out: string, project = projectFooter()): string {
  const dest = resolve(out);
  writeFileSync(dest, svgToPng(cardSvg(mode, { project })));
  return dest;
}

export function renderRecapImage(recap: Recap, modes: Mode[], out: string): string {
  const dest = resolve(out);
  writeFileSync(dest, svgToPng(recapSvg(recap, modes)));
  return dest;
}
