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

## 2026-11-22 · Phase 4: launch assets
- **Landing page:** `site/index.html` is the approved label-printer design as a real static page, with review notes removed and fonts self-hosted (`site/fonts/`, no Google Fonts call, consistent with the privacy stance). No build step. Mobile stacking verified at 500px and desktop at 1280px with headless Edge; phone widths under 500px and dark mode were not checked. The page's printer and transcripts are illustrations and are labelled as such; the real demo clip is still to be recorded.
- **Demo:** `docs/launch/DEMO_SCRIPT.md` is a shot list for a real recording. The agent's output must not be mocked.
- **Posts:** `docs/launch/POSTS.md` has drafts for X, Reddit and Hacker News. They state the limits (cannot force behavior, no benchmark, Claude Code tested only) and disclose that it was built with Claude Code. Nothing is published.
- **Measurement:** `LAUNCH_LOG.md` now defines how installs and shares are counted and where the numbers overstate (npm counts include bots, CI and repeated `npx` runs). There is no telemetry, so no active-user figure.
- **Pre-launch checklist:** `docs/launch/CHECKLIST.md`, including the commit-email question and every step that needs the founder's accounts.

## 2026-11-22 · Agent tests and launch tone
- **Tone:** founder chose "punch": the posts and the site copy are now playful and fast ("Dial in your agent.", "Fine print, because we like you."). Guardrails unchanged: no claims that modes improve results, no claims that agents feel anything, wholesome only.
- **Agent smoke tests** (`docs/agent-tests/README.md`): Claude Code, Codex CLI 0.171 and opencode 1.19.6 all passed. Pass meant the agent called `set_mode`, the server's own log recorded it, and a card PNG was written. Cursor is untested because it is a GUI app with no headless mode; manual steps are in that file.
- **Codex quirk:** non-interactive `codex exec` blocks MCP tool calls without approval. `default_tools_approval_mode = "approve"` on the server entry fixes it; interactive Codex just asks. Documented in the README and on the site.
- **Environment issues found while testing** (not modedial bugs): opencode 1.14.39 can't use the free tier (needs 1.18+), and the founder's default Codex model (gpt-5.4) is unsupported on a ChatGPT account, so a supported model was passed with `-m`. We did not change either tool's configuration.
- **Claims updated everywhere** (site, README, posts) from "Claude Code only" to "Claude Code, Codex CLI and opencode, one smoke test each; Cursor untested".

## 2026-11-22 · Commit email and Cursor test
- **History rewritten to GitHub's noreply address** (`<id>+mac146@users.noreply.github.com`) with the founder's approval, then force-pushed to the private repo. No commit carries a personal email any more, and the repo-local git config uses the noreply address. GitHub may keep the old commit objects reachable by SHA for a while even though no branch points at them; the repo is private and was never shared.
- **Cursor:** opened a throwaway project with `.cursor/mcp.json` in the founder's Cursor. Cursor discovered the server (`project-0-cursor-test-modedial`) but left it `disconnected` because project servers must be enabled in the UI. Waiting on that one click; result goes in `docs/agent-tests/README.md`.

## 2026-11-23 · Phase 5 pilot 1
- **Started Part A** (our own benchmark, no user data). Hypotheses and tasks were committed before any run (`bench/HYPOTHESES.md`).
- **Result:** 48/48 runs passed with zero scope violations in every condition (ceiling effect), so H2 and H3 are untested, not confirmed or refuted. Modes cost about 9–34% more per run than no mode on these tasks. Written up in `bench/RESULTS.md`.
- **No claims change.** The site, README and posts still make no performance claim.
- **Next:** harder tasks the baseline can fail, committed before running. Part B (opt-in telemetry) stays on hold behind the "no backend" rule.

## 2026-11-24 · Phase 5 pilot 2 result
- **150 valid runs** (haiku and sonnet, 75 each), $5.30. Written up in `bench/RESULTS2.md` against the pre-registered hypotheses.
- **No support for H2′, H3′ or H1.** A one-line generic prompt did as well as the modes everywhere (H5 supported). The only scope violation in 150 runs was one no-mode sonnet run. Review tasks hit a ceiling; the `memo` task was a floor (0/40 hidden passes in every condition).
- **Modes cost more:** roughly 10 to 60% more cost and up to about 60% more turns, with no measured benefit.
- **Process notes:** three amendments to the pre-registration were logged (short-path edit block, unquoted config path, interrupted run). The invalid first launch (150 errored runs, no model output) is archived and excluded. Haiku's `||` bug was found in all review replies but under-counted by the keyword pattern.
- **Claims unchanged:** still no performance claim anywhere. Part B (telemetry/backend) is not justified by this result and stays on hold.
