# DECISIONS

Running log of what we chose and why. Newest at the bottom.

## 2026-11-22 · Kickoff answers (from the founder)
- **Publisher identity:** package is published under the founder's own npm and GitHub account. Handle: TBD (asked at Phase 1 checkpoint).
- **Agent coverage:** Claude Code is the primary tested target. Cursor, Codex CLI and other MCP-capable agents get documented config blocks. Anything we have not run ourselves is labelled "untested".
- **PNG rendering:** industry-standard approach is SVG templates rendered by `@resvg/resvg-js` (prebuilt binaries, no native toolchain), with fonts bundled in the package so output is identical on every OS.
- **Local storage:** production-grade approach: an append-only JSONL event log in the OS-appropriate user data directory (via the `env-paths` convention: XDG on Linux, `~/Library/Application Support` on macOS, `%APPDATA%` on Windows), schema-versioned, written with atomic appends, and with a size cap and rotation. Only mode id, timestamp, and counts are recorded. Honors a `<NAME>_HOME` override. No telemetry, no network calls.
- **Landing page / demo:** deferred. Build the product first; founder decides page design, then we record the demo.

## 2026-11-22 · Name availability method
Checked npm (`npm view`), GitHub (repo search + user/org lookup), and domains (RDAP). RDAP rate-limits (HTTP 429), so domain results for some names are unverified. A registrar check is needed before buying anything.

## 2026-11-22 · Founder approvals and handles
- **Name: `modedial`** (founder said "go ahead" on the recommendation). npm free, no GitHub conflicts. `.com` is taken; `.dev`, `.app`, `.ai` and `.io` were free on RDAP. Confirm with a registrar before buying.
- **Six modes approved** as drafted (instructions may be sharpened after the behavior check).
- **Handles:** GitHub `mac146` (from the IssueWatcher repo URL). npm package will be published unscoped, as `issue-watcher` is. The npm username was not recorded in that project, so `npm login` happens at publish time.
- **Design:** the founder is not satisfied with the Phase 1 sketches. Visual design (card, recap, landing page) is on hold until a design pass together. Phase 2 ships no visuals.

## 2026-11-22 · Phase 2 implementation choices
- **Zero extra runtime deps:** only `@modelcontextprotocol/sdk` and `zod`. The data directory logic is about ten lines in `src/paths.ts`, so `env-paths` is not needed.
- **Current mode is held in memory per server process.** Each agent session starts its own stdio server, so there is no cross-session state to leak. The log carries a random per-process session id, which is what lets the recap measure how long a mode ran.
- **Recap "longest streak"** is defined as the longest time spent in one mode before the next event in the same session, capped at 4 hours (a mode left on with no later event can't count forever).
- **Logging never throws.** A broken disk must not break a tool call.
- **Log rotation:** at 1 MB the log moves to `log.1.jsonl`, and only one old file is kept.
- **Pinned toolchain** to widely used versions (TypeScript 5.9, Vitest 3) instead of the newest majors.

## 2026-11-22 · Design direction approved: "label printer" (v2)
- **Approved by the founder** after reviewing the published artifact (v2). The v1 cream/coral dial sketches in `docs/sketches/` are superseded.
- **Concept:** modes are strips of colored tape with embossed mono type. The landing page hero is a working label printer: press a mode key, tape prints, the page takes the mode's color, and the transcript changes. Also: draggable mode stickers, tape ribbons as section breaks, a "print your own card" widget.
- **Palette:** six mode colors are the brand (blue #2F5BFF, orange #FF8A3D, green #1FA67A, pink #D6338A, violet #7A4DFF, yellow #F5C400). Neutral cool-grey surfaces, ink #14161B. Light default, dark available.
- **Type:** Bricolage Grotesque (display), Instrument Sans (body), JetBrains Mono (labels and tape).
- **Reference file:** `docs/design/landing-v2.html` is a design proposal, not the final landing page. Its transcripts are illustrative and its review notes box must be removed before launch.
- **Research basis:** structural patterns from Mintlify, Trigger.dev, Greptile, Langfuse and Supabase (short headline, copyable agent setup prompt, real output in the hero, no fake social proof). We could read those sites' text but not their visuals, so the visual language is original.
- **Still open (defaults assumed until the founder says otherwise):** the card footer project name is opt-in and off by default; the sound toggle stays, off by default; the short key names (Focus, Debug, Tidy, Spark, Review, Quick) stay.
- **Naming rule kept:** no "Now playing", no music-app terms. The card eyebrow says "Now in mode".

## 2026-11-22 · Phase 3: cards and recap
- **Renderer:** SVG templates in `src/render/templates.ts`, rasterized by `@resvg/resvg-js` with only bundled fonts (system fonts ignored) so output is identical on every OS. Fonts are Bricolage Grotesque, Instrument Sans and JetBrains Mono (SIL OFL; licenses are in `fonts/`). Total package is about 300 kB.
- **Glyphs instead of emoji** in images (`src/render/glyphs.ts`), because emoji render differently per OS. Text tool output still uses the emoji from the mode data.
- **Mode data gained `color` and `text_color`**, so the brand colors live with the modes.
- **Card on every `set_mode`:** saved to `cards/latest.png` in the data folder. A render failure never breaks the switch. The tool result adds one short line with the local path (about 15 tokens).
- **Card footer project name is opt-in** via `MODEDIAL_CARD_PROJECT=1` (default off), taken from the folder name, drawn into the image only and never written to the log.
- **Recap image** shows the top 3 modes by switches, total switches, longest stretch, busiest time of day, and the playful personality label. It refuses to draw when the log is empty.
- **Claims audit:** the landing copy said it works "for Claude Code, Cursor, Codex". Only Claude Code is tested, so it now says "Tested with Claude Code, with setup for Cursor, Codex and other MCP clients". There is no benchmark for any performance claim, and none is made. What we have is a 1-run-per-cell observational check of response style.
