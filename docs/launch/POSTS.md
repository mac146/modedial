# Launch post drafts (punchy cut)

**Drafts only. Nothing is published until you approve.** Replace `<SITE_URL>`, `<REPO_URL>` and `<NPM_URL>` once they exist. Don't add numbers we don't have (stars, downloads, users). Check each community's self-promotion rules on the day.

Tone: playful, fast, a bit funny, built-for-fun. The guardrails stay: no claims that modes improve results, no claims that agents feel anything, no drugs or edgy jokes, nothing about other brands' look or names.

Facts every post may rely on (all verified in this repo):
- MCP server, 5 tools, 6 bundled modes. Modes are static and never fetched from the network.
- No telemetry. The local log holds only a mode id, a timestamp and a random session id.
- Cards and recaps are drawn locally and nothing is uploaded unless you post the image.
- Tested with Claude Code, Codex CLI and opencode (one smoke test each). Cursor config is provided but untested.
- Guards (0.1.3+). Claude Code: the reviewer's file-edit tools are denied and leaving the mode needs approval; shell filtering is best effort (`node -e` gets through). Debug sends the agent back **once**. Deep Focus asks before file-tool edits outside a declared scope. opencode: **only** the reviewer is enforced (edit and shell tools off).
- `npx modedial install <agent>` writes native files for 12 agents. Claude Code, opencode and Codex were checked live; Cursor, Windsurf, Cline and Roo Code follow their docs; Copilot, Gemini CLI, Kilo Code and Aider are unverified. Say so if asked.
- A published study of AGENTS.md files (ETH Zurich) found no success gain and 20%+ more cost. Our pilots saw a similar shape, but they were small and partly flawed, so call it "consistent with", never "proof".
- No benchmark. A small observational check (1 run per mode per task, 3 tasks) showed each mode changes the reply's style.

---

## X (thread)

**1/**
Your coding agent has one setting: "whatever."

I built modedial: pick a mode, any mode. Deep Focus. Debug. Careful Reviewer. Fast Prototype. One call, and your agent gets a tiny rulebook for the job.

Open source. Local only. <SITE_URL>

[clip]

**2/**
Every mode has a tell, so you can see it's on:

Debug: "Hypothesis: …  Fix unconfirmed until re-run."
Deep Focus: opens with "Goal:", ends with what it set aside.
Careful Reviewer: must-fix, nice-to-have, and what it did NOT check.

**2b/**
The part I'm proudest of: some modes have guards, not just advice. On Claude Code, Careful Reviewer's edit tools are blocked, and it needs your OK to leave the mode. It's not a sandbox: the shell filter is best effort.

**3/**
Every switch prints a little label card. At the end you get a recap: top modes, longest stretch, busiest time of day, and a silly personality label.

Mine says "The Methodical Tinkerer". Rude but fair.

[card + recap images]

**4/**
Fine print, because I like you:
- A tool can't force an agent. It hands over instructions; the agent follows them.
- I haven't benchmarked whether modes make results better. This is a toy until someone proves otherwise.
- Tested on Claude Code, Codex CLI and opencode. Cursor config is in the README, untested.
- No telemetry. No accounts. Nothing leaves your machine unless you post the card.

`claude mcp add modedial -- npx -y modedial`

Tell me which mode I'm missing. <REPO_URL>

---

## Reddit (r/ClaudeAI, and similar developer communities where tool posts are allowed)

**Title:** I gave my coding agent a mode dial (Deep Focus, Debug, Careful Reviewer…). It prints little cards. Feedback wanted

**Body:**

I got tired of retyping the same things to my agent: "stay on this one task", "reproduce before you guess", "review this, don't touch it". So I made them modes, and now I just say "debug mode".

It's a small MCP server. `set_mode("debug")` returns a short instruction bundle (under 150 tokens), and the agent follows it until you end the mode or pick another. Six modes: Deep Focus, Debug Mode, Chill Refactor, Creative Sprint, Careful Reviewer, Fast Prototype.

The fun part: each mode has a visible tell. Debug Mode states a hypothesis and admits when a fix is unconfirmed. Deep Focus opens with `Goal:` and closes with `Set aside:`. Chill Refactor ends with a `Changed / left alone:` note. You can screenshot it.

Every switch also prints a card, and there's a recap image built from your own log (top modes, longest stretch, busiest time of day, and a personality label that is purely for laughs). All drawn locally.

The bit that makes it more than a prompt pack: some modes have guards that run as hooks on Claude Code. Careful Reviewer's file-edit tools are denied and it needs your approval to leave the mode (the shell filter is best effort, not a sandbox). Debug sends the agent back once if it tries to finish an edit without running anything. Deep Focus asks before editing files outside the scope the agent declared. On opencode, only the reviewer is enforced. `npx modedial install <agent>` writes native files for a dozen agents (Cursor rules, Roo modes, Windsurf rules, Codex AGENTS.md and more); I checked Claude Code, opencode and Codex against real sessions and say plainly which others are docs-only or unverified.

Straight talk:
- An MCP tool can't force an agent. It's a nudge, and a CLAUDE.md snippet makes it stick better.
- I have NOT benchmarked whether modes improve anything. I only checked that each mode changes how the reply looks. So: for fun, not proof.
- Tested with Claude Code, Codex CLI and opencode. The Cursor config is in the README but untested.
- No telemetry, no network calls. Modes are bundled and never fetched.

MIT licensed. `claude mcp add modedial -- npx -y modedial`. Repo: <REPO_URL>

Which mode should I add? Which one is dumb? If you try it in Cursor, tell me if it explodes.

(Built with help from Claude Code.)

---

## Hacker News

**No draft on purpose.** HN does not allow AI-written or AI-edited comments (https://news.ycombinator.com/item?id=47340079). Write the title, first comment and every reply yourself, from scratch. Link the repo. Things you may want to cover, as facts to check yourself against:

- Why you built it, in your own words.
- What `set_mode` does, and that modes are bundled, never fetched.
- Guards: exactly the limits in the "Facts" list above.
- No benchmark of whether modes improve results.
- Which agents you tested, and which you did not.
- That Claude Code helped build it.

---

## Which clip to attach (and how to caption it)
- **Best:** `docs/launch/demo/modedial-guard-moment.mp4` (26 s). Caption: "Real Claude Code session with the modedial hooks installed. Told to edit a file in Careful Reviewer mode, the agent tries, and a hook blocks it. Replayed from the recorded event log, pauses shortened."
- **Longer:** `modedial-real-session.mp4` (83 s, three scenes).
- **Site tour:** `modedial-site-tour.mp4` or `modedial-printer-loop.gif` show the website and its illustrative transcripts. Never describe them as a real agent session.

## Notes before posting
- Post one platform at a time and reply fast in the first few hours.
- HN: no asking friends to upvote. Weekday morning, US time.
- Don't cross-post identical text. These three differ on purpose.
- Log every post, its link and the result in `LAUNCH_LOG.md`.
- If you want even more punch on X, the best lever is the clip. A real 6-second loop of a mode switch beats any wording.
