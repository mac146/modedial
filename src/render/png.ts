import { Resvg } from "@resvg/resvg-js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";

const FONT_FILES = [
  "BricolageGrotesque_800ExtraBold.ttf",
  "BricolageGrotesque_700Bold.ttf",
  "InstrumentSans_400Regular.ttf",
  "InstrumentSans_600SemiBold.ttf",
  "JetBrainsMono_500Medium.ttf",
  "JetBrainsMono_700Bold.ttf",
];

function fontPaths(): string[] {
  const here = dirname(fileURLToPath(import.meta.url));
  const dir = join(here, "..", "..", "fonts");
  return FONT_FILES.map((f) => join(dir, f)).filter((p) => existsSync(p));
}

/**
 * Renders SVG to PNG using only the bundled fonts (system fonts are ignored),
 * so output is identical on every OS.
 */
export function svgToPng(svg: string): Buffer {
  const resvg = new Resvg(svg, {
    font: { fontFiles: fontPaths(), loadSystemFonts: false, defaultFontFamily: "Instrument Sans" },
  });
  return resvg.render().asPng();
}
