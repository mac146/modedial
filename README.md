# modedial

Named **modes** for coding agents, as a tiny MCP server. Switch your agent between things like *Deep Focus*, *Debug Mode* or *Fast Prototype* with one call, and get a shareable card and a local recap.

> Working name. Status: pre-release, not yet on npm.

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

**Codex CLI**: add to `~/.codex/config.toml`. *Untested by us.*
```toml
[mcp_servers.modedial]
command = "npx"
args = ["-y", "modedial"]
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

## Privacy

- No telemetry. No network calls. Nothing leaves your machine unless you choose to share a card or recap.
- The local log records only: schema version, timestamp, event (`set`/`end`), mode id, and a random per-run session id. Never code, prompts, file paths or file contents.
- Location: `%APPDATA%\modedial` (Windows), `~/Library/Application Support/modedial` (macOS), `$XDG_DATA_HOME/modedial` or `~/.local/share/modedial` (Linux). Override with `MODEDIAL_HOME`. Disable logging with `MODEDIAL_NO_LOG=1`.
- Modes are static and bundled in the package. They are never fetched from the network.

## CLI

```bash
npx modedial list     # show modes
npx modedial recap    # recap from your local log
```

## Develop

```bash
npm install
npm test
npm run build
```

## License

MIT
