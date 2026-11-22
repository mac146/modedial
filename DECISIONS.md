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
