# Testing

Run everything before any release with `npm run test:all`. A real `npm publish` runs it automatically (`prepublishOnly`), so a broken build cannot be published by accident. Nothing here touches the public npm registry, your real global packages or your agent settings.

| Layer | Command | What it proves | Real bug it caught |
|---|---|---|---|
| Unit tests (176) | `npm test` | Guards, hook payloads, installers for 12 agents, session state and privacy, site content, favicons | `reinstall added a stray newline`, `uninstall left empty {} configs`, `file names were stored in session state` |
| Cross-OS CI | GitHub Actions | The same tests on Linux, macOS, Windows × Node 20 and 22 | `basename` ignoring backslash paths on Linux/macOS |
| Clean-install smoke | `npm run test:smoke` | Pack the tarball, install it in an empty folder, run MCP, card rendering and a hook | `smoke script quoted a path wrongly on Linux` |
| **Private-registry rehearsal** | `npm run test:registry` | Starts a private npm registry (Verdaccio), publishes to it, then does what users do: `npx`, `npm install -g`, the installer, and **runs the exact hook command string it wrote** in a clean shell | `npx hook cost 3.4 s per call`, and `installer wrote a hook command that only worked while npx was running` (0.1.1) |
| **Post-publish check** | `npm run verify:published` | The same 26 checks against the REAL npm registry, after a publish. Waits until the tarball is actually downloadable | (the first run after a publish can hit npm's propagation window; the check now waits for the tarball) |
| Real-agent end-to-end | `node scripts/e2e-claude-code.mjs haiku [--global]` | A real Claude Code session: the reviewer cannot write a file, Debug mode is sent back after an unverified edit, out-of-scope edits are held. `--global` runs through the global install | confirmed the hook payload shapes match real Claude Code |
| Live-agent checks | see `docs/agent-tests/README.md` | opencode and Codex read the files we write | — |

## The rehearsal is checked against the bug it exists for
Run against the actual 0.1.1 code that shipped with the bug, the rehearsal fails 2 of its 26 checks (`npx install` without a global install wrote a hook command that cannot run). Against the fix it passes 26 of 26. A test that cannot fail is not a test, so this was verified rather than assumed.

## What the rehearsal checks (26)
publish to the private registry; `npx modedial list` and `--help`; MCP over stdio started through npx (5 tools, `set_mode` with `scope`); `npx install claude-code` refuses without a global install and writes nothing; global install into a temp prefix; the installer through the global command and through npx-with-global both write a hook command that does not point into npx's cache, runs in a clean shell and denies a write in Careful Reviewer mode (and stays silent with no mode); the hook ignores garbage, empty, huge and unknown input (exit 0, no output); hook start-up under 1.5 s; `install all --dry-run` writes nothing; install then uninstall leaves no files for opencode, Cursor, Roo Code, Windsurf, Codex and AGENTS.md; `uninstall claude-code` removes the hooks.

## What is still not covered
- Cursor, Copilot, Gemini CLI, Kilo Code and Aider formats are not run against the live tools (see the table in the README).
- The hook latency figure comes from a Windows machine; CI asserts only a generous ceiling.
- Whether modes improve results is not tested, and no such claim is made.
