# modedial

Named **modes** for coding agents, as a tiny MCP server. Switch your agent between things like *Deep Focus*, *Debug Mode* or *Fast Prototype* with one call, and get a shareable card and a local recap.

> Status: pre-release, not yet on npm. Smoke-tested with Claude Code, Codex CLI and opencode ([details](docs/agent-tests/README.md)). Cursor is untested.

<!-- TODO: add the demo GIF/MP4 here after recording (see docs/launch/DEMO_SCRIPT.md) -->

<p>
  <img src="docs/examples/card-debug.png" alt="Mode card for Debug Mode" width="49%">
  <img src="docs/examples/card-deep-focus.png" alt="Mode card for Deep Focus" width="49%">
</p>

Every mode switch makes a card like these, drawn locally. The sample images are in [docs/examples](docs/examples).

## What it does (and doesn't)

- `list_modes`: the available modes (id, name, tagline)
- `set_mode(id)`: returns a short instruction bundle for the agent to follow, and logs the switch locally
- `current_mode`: the active mode
- `end_mode`: back to default behavior
- `recap`: usage stats from your local log

**An MCP tool cannot force an agent to do anything.** `set_mode` returns text, and the agent chooses to follow it. Modes are nudges that tend to work when the agent is told to use them (see the snippet below), not guarantees. We have not measured whether modes improve results, so this project makes no performance claims. A small, observational check of what each mode changes is in [docs/behavior-check](docs/behavior-check/).

## Install

Requires Node 20+. Once published, the server runs with `npx -y modedial`.

**Claude Code**
```bash
claude mcp add modedial -- npx -y modedial
```

**Cursor**: add to `.cursor/mcp.json` (or `~/.cursor/mcp.json`). *Untested by us.*
```json
{ "mcpServers": { "modedial": { "command": "npx", "args": ["-y", "modedial"] } } }
```

**Codex CLI**: add to `~/.codex/config.toml`. *Tested by us.* Codex asks before running a tool; the optional last line skips that prompt for this server.
```toml
[mcp_servers.modedial]
command = "npx"
args = ["-y", "modedial"]
default_tools_approval_mode = "approve"
```

**opencode**: add to `opencode.json`. *Tested by us.*
```json
{ "mcp": { "modedial": { "type": "local", "command": ["npx", "-y", "modedial"] } } }
```

**Any other MCP client**: run `npx -y modedial` as a stdio server. On Windows, some clients need `cmd /c npx -y modedial`.

## Make agents use it reliably

Paste this into `CLAUDE.md`, `AGENTS.md`, `.cursor/rules`, or your agent's equivalent:

```md
## Modes (modedial)
You have a `modedial` MCP server. When the user asks for a mode (for example "deep focus",
"debug mode"), call `list_modes` if unsure, then `set_mode` with the matching id, and follow the
returned instructions until `end_mode` is called or the user picks another mode. When the user
changes task type (for example from building to reviewing), suggest a fitting mode in one line
instead of switching silently.
```

## Enforcement (Claude Code)

By default a mode is advice: the agent reads the instructions and chooses to follow them. On Claude Code you can add **guards**, which are enforced by hooks the agent cannot talk its way past:

```bash
npx modedial install claude-code            # this project (.claude/settings.json)
npx modedial install claude-code --user     # all projects
npx modedial uninstall claude-code          # remove them again
```

| Mode | What is enforced |
|---|---|
| Careful Reviewer | Read-only: file edits are denied, and shell commands that change files, git state or packages are denied. Its reply must end with "Not checked". |
| Debug Mode | After editing, the agent cannot finish until something has run (a test, a script, a build). It is sent back once to run it or to say the fix is unconfirmed. |
| Deep Focus | If the agent declares `scope` when it sets the mode, editing outside that scope needs your approval. Its reply must start with "Goal:" and end with "Set aside:". |
| Chill Refactor | Edits to dependency manifests (package.json, lockfiles, requirements, go.mod…) need your approval. It must verify after editing, and end with "Changed / left alone:". |
| Creative Sprint, Fast Prototype | Instructions only. Nothing to enforce. |

The hooks are deterministic code with unit tests, and an end-to-end script (`node scripts/e2e-claude-code.mjs`) checks them against a real Claude Code session. Honest limits:
- The shell filter is best effort. It blocks the common ways to change things, but a determined command can slip through. The file-edit tools are the hard guarantee.
- "Needs your approval" prompts you in an interactive session. In headless runs it simply does not apply the edit.
- The "verify" and "tell" nudges happen once per round, so a stubborn agent can still finish. They improve the odds, they are not a lock.
- The hooks add a small process start-up on each edit or command (about 50 ms locally).
- Hooks only run if you install them. Without them the guards are not enforced, and the modes behave as plain instructions.
- Cursor, Codex and opencode currently get the instructions only. Rules, `AGENTS.md` and agent-file installers are next.

## Privacy

- No telemetry. No network calls. Nothing leaves your machine unless you choose to share a card or recap.
- The local log records only: schema version, timestamp, event (`set`/`end`), mode id, and a random per-run session id. Never code, prompts, file paths or file contents.
- Location: `%APPDATA%\modedial` (Windows), `~/Library/Application Support/modedial` (macOS), `$XDG_DATA_HOME/modedial` or `~/.local/share/modedial` (Linux). Override with `MODEDIAL_HOME`. Disable logging with `MODEDIAL_NO_LOG=1`.
- Modes are static and bundled in the package. They are never fetched from the network.

## CLI

```bash
npx modedial list                      # show modes
npx modedial card                      # export the latest mode card (PNG, 1200x630)
npx modedial card --mode debug         # render a card for any mode
npx modedial recap                     # recap from your local log, as text
npx modedial recap --image             # recap as a PNG (1080x1350)
```

Every `set_mode` also saves a mode card to `cards/latest.png` in the data folder below. Cards and recaps are drawn on your machine with bundled open-licensed fonts, so they look the same on every OS. Posting one is your choice; nothing is uploaded.

## Settings

| Variable | Effect |
|---|---|
| `MODEDIAL_HOME` | Use this folder for the log and cards |
| `MODEDIAL_NO_LOG=1` | Do not write the local log |
| `MODEDIAL_NO_CARD=1` | Do not save a card on `set_mode` |
| `MODEDIAL_CARD_PROJECT=1` | Show the project folder name in the card footer (off by default; drawn into the image only, never logged) |

## Develop

```bash
npm install
npm test
npm run build
```

## License

MIT
