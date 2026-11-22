# Agent compatibility tests

One smoke test per agent, run on 2026-11-22. The prompt was identical each time:

> Call the modedial set_mode tool with id deep-focus. Then reply with one sentence: the active mode name and the first instruction you received. Do not use any other tools.

**Pass** means all three of these held: the agent listed and called the tool, the server's own local log recorded a `set` event for `deep-focus`, and a card PNG was written. The log is the evidence, not the agent's say-so. Each agent got a throwaway data folder via `MODEDIAL_HOME`, and the MCP config was passed per run, so no real agent settings were changed.

| Agent | Version | Model used | Result | Notes |
|---|---|---|---|---|
| Claude Code | current at test time | default | Pass | Also used for the behavior check in `docs/behavior-check`. |
| Codex CLI | 0.171.0-alpha.13 (VS Code extension build) | gpt-5.6-luna | Pass | In non-interactive `codex exec`, the first run was blocked: "MCP tool call requires approval, but approval policy is never". Adding `default_tools_approval_mode = "approve"` for the server fixed it. In interactive use, Codex asks you to approve the call instead. Its reply also used the Deep Focus tell (`Goal: …`). |
| opencode | 1.19.6 (run via `npx`) | opencode/big-pickle (free tier) | Pass | The installed 1.14.39 could not use the free tier ("1.18 or newer is required"), unrelated to modedial. The reply used the Deep Focus tell. |
| Cursor | desktop app (2026-11-22) | n/a | **Partial** | Verified from Cursor's own logs: it discovered the project-level server, started it, completed the MCP handshake (`initializing → connected`) and listed **5 tools**. The server had to be switched on once in Settings → Tools & MCP. **Not yet verified:** an agent actually calling `set_mode`, because the server's log showed no `set` event afterwards. |

## Caveats
- One run per agent. This shows the integration works, not how reliably an agent follows a mode.
- Different models were used, so the replies are not comparable across agents.
- Only the first instruction was checked, not the whole bundle.

## Manual check for Cursor (about 2 minutes)
1. Add to `.cursor/mcp.json`: `{ "mcpServers": { "modedial": { "command": "npx", "args": ["-y", "modedial"] } } }` (or point at a local `dist/cli.js` before publishing).
2. Open Settings → MCP and check that `modedial` shows five tools.
3. In an agent chat, ask: "Use modedial to set deep-focus mode and tell me the first instruction."
4. Check that the log file has a `set` event, and report back with the Cursor version.
