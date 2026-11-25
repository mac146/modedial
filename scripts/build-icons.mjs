// Renders the PNG favicons from site/favicon.svg. Usage: node scripts/build-icons.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const site = resolve(dirname(fileURLToPath(import.meta.url)), "..", "site");
const svg = readFileSync(resolve(site, "favicon.svg"), "utf8");
for (const [name, size] of [["favicon-32.png", 32], ["apple-touch-icon.png", 180], ["icon-512.png", 512]]) {
  writeFileSync(resolve(site, name), new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng());
  console.log(`wrote site/${name} (${size}px)`);
}
