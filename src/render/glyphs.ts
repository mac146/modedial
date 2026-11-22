/**
 * Simple drawn glyphs, one per mode, in a 64x64 box. They replace emoji in
 * images because emoji render differently on every OS.
 */
const GLYPHS: Record<string, string> = {
  "deep-focus":
    '<circle cx="32" cy="32" r="22"/><circle cx="32" cy="32" r="11"/><circle cx="32" cy="32" r="2.5" fill="currentColor"/>',
  debug: '<circle cx="28" cy="28" r="16"/><path d="M40 40 L54 54"/>',
  "chill-refactor": '<path d="M14 20 H50 M14 32 H50 M14 44 H36"/>',
  "creative-sprint": '<path d="M32 8 L38 26 L56 32 L38 38 L32 56 L26 38 L8 32 L26 26 Z"/>',
  "careful-reviewer": '<rect x="10" y="10" width="44" height="44" rx="9"/><path d="M22 33 L29 40 L43 24"/>',
  "fast-prototype": '<path d="M36 8 L16 36 H30 L26 56 L48 26 H34 Z"/>',
};

/** Returns an SVG group for the glyph centered at (cx, cy), `size` px wide. */
export function glyph(id: string, cx: number, cy: number, size: number, color: string): string {
  const body = GLYPHS[id] ?? '<circle cx="32" cy="32" r="20"/>';
  const s = size / 64;
  return (
    `<g transform="translate(${cx - size / 2} ${cy - size / 2}) scale(${s})" fill="none" stroke="${color}" ` +
    `stroke-width="5" stroke-linecap="round" stroke-linejoin="round" color="${color}">${body}</g>`
  );
}
