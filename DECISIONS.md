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

## 2026-11-24 · Erratum on pilot 2
- The `memo` hidden test required structural equality for object arguments, which the spec ("exact arguments") does not say. Agents implemented identity and failed the test with correct code. The `memo` result (0/40) is invalid and the write-up in `bench/RESULTS2.md` now says so.
- Net effect: pilot 2 had no task with room for a mode to help (cart, ranges and review at ceiling; memo invalid). "No evidence of benefit" is true but weak. Next step is a calibrated benchmark plus modes redesigned around observed failures, not more runs of the same tasks.

## 2026-11-24 · Modes v2: contracts with enforced guards (Claude Code first)
- **Why:** pilot 2 showed text-only modes add nothing on tasks agents already do well, and an MCP tool result is the weakest place to put instructions (low authority, summarized away on compaction). Research of the official Claude Code docs found that hooks and permissions are configuration, run deterministically, and survive compaction.
- **Design:** a mode is a contract of (1) sharper procedural instructions, (2) guards enforced by hooks, (3) a checked tell. Guards: read-only, scope-lock, verify-before-finish, protect-manifests, require-tell. Mode data (`modes/modes.json`) declares them; pure logic is in `src/guards.ts`; `src/hook.ts` adapts Claude Code hook payloads; `modedial install claude-code` merges the hooks into settings (idempotent, backs up, only touches its own entries).
- **State:** per-session file keyed by the agent session id (sanitized), written by a PostToolUse hook on `set_mode`. `set_mode` gained an optional `scope` list used by Deep Focus.
- **Verification without benchmarks:** 78 new deterministic unit tests (guards, hooks, installer) plus `scripts/e2e-claude-code.mjs`, which ran 3/3 against a real Claude Code session (read-only reviewer could not write a file, debug mode was sent back after an unverified edit, out-of-scope edit was held for approval). No LLM benchmark was needed to prove these properties.
- **Not yet done:** Cursor (`.cursor/rules`), Codex (`AGENTS.md`, sandbox profile) and opencode (agent files) installers, and one carefully built outcome benchmark. Guards are Claude Code only today; other agents get the instructions.

## 2026-11-24 · Installers for every agent, and benchmark research
- **Installers** (`src/targets.ts`, `src/installCmd.ts`): `modedial install <agent|all>` for claude-code (hooks), opencode, codex, roo-code, kilo-code, cursor, windsurf, cline, copilot, gemini-cli, aider and a generic AGENTS.md block. Files are namespaced `modedial-*`; shared files get a marked block or a keyed JSON entry, a one-time backup, and uninstall removes exactly what was added (including files we created).
- **Verification levels are stated per agent** (tested / docs / unverified) and shown in the CLI and README. Real-agent checks done: Claude Code hooks (3/3), opencode (agents parsed; read-only reviewer could not create a file; control agent could), Codex (read and used the AGENTS.md block). Copilot, Gemini CLI, Kilo Code and Aider formats are unverified. Cursor, Windsurf, Roo and Cline follow their docs but were not run.
- **Bugs found by the new tests before release:** block reinstall was not idempotent (stray newline) and uninstall left empty `{}` configs we had created. Both fixed.
- **Benchmark research** (`docs/BENCHMARKING.md`): no similar mode project publishes a systematic benchmark. The closest evidence (ETH Zurich AGENTS.md study) found no success gain and 20%+ more cost, consistent with our pilots. SWE-bench Verified flaws (over-scoped tests) are exactly my `memo` mistake. Decision: prove guards with deterministic tests, do not write our own outcome tasks, and if we ever measure outcomes use a public human-vetted set with pre-registration. No large benchmark before launch.

## 2026-11-24 · Landing page updated for guards and installers
- `site/index.html` now loads mode data from the generated `site/modes-data.js` (run `node scripts/build-site.mjs` after editing `modes/modes.json`), so instructions, guards and colors cannot drift from the product. New section "Some modes have rules the agent can't break" with an honest enforced / rules-only / how-we-know split. The mode panel shows each mode's guards, and its footnote no longer implies the old behavior check covers the new wording.
- Private preview republished as the same artifact (Version 4). Launch posts updated to lead with enforced guards and the 12-agent installer, with verification levels stated.

## 2026-11-25 · Launch-readiness audit
- **Clean-room test** (pack, install tarball in an empty folder, use it): list, install, MCP over stdio, card export, hook deny/allow all pass (`scripts/smoke-pack.mjs`, also run in CI).
- **Found and fixed before launch:** (1) hooks took ~1.2 s per call because the CLI eagerly loaded the MCP SDK, zod and the native renderer. Now every command loads lazily and the hook path imports only light modules (`src/modesLight.ts`); median per call fell to ~460 ms where bare Node start-up on this Windows machine is ~360 ms. A test fails if heavy imports return. (2) README claimed file paths are never stored, but hook session state stored edited file names. It now stores only an edit count; a test asserts no file names or command text are saved; the README privacy section discloses the remaining state (mode id, declared scope, flags, deleted after 7 days). (3) README had stale installer lines and a wrong latency figure.
- **Added:** GitHub Actions CI (3 OSes x Node 20/22), package.json homepage/bugs, hook output flushes before exit.
- **Re-verified** against a real Claude Code session after the refactor: 3/3.

## 2026-11-25 · Published to npm, and 0.1.1
- **modedial@0.1.0 was published by the founder** (npm account `mac146`, after 2FA). Verified from the real registry in an empty folder: `npx -y modedial list`, MCP over stdio (5 tools, `set_mode`), card rendering, installer listing.
- **Found right after publishing:** through `npx`, each hook call took about 3.4 s (7.8 s worst) versus about 0.1 s for a global install, and the installer would have written `npx` hooks. Not announced yet and no known installs, so fixed immediately as **0.1.1**: the Claude Code installer now uses the global `modedial` command if present, otherwise refuses with instructions (`npm install -g modedial`). It never writes a path into the npx cache, because a hook that cannot start silently turns the guards off. Unit-tested (`test/hookprefix.test.ts`).
- README no longer says "not yet on npm" and documents the global-install requirement for hooks.
