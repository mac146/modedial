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
