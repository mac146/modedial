# Launch post drafts (punchy cut)

**Drafts only. Nothing is published until you approve.** Replace `<SITE_URL>`, `<REPO_URL>` and `<NPM_URL>` once they exist. Don't add numbers we don't have (stars, downloads, users). Check each community's self-promotion rules on the day.

Tone: playful, fast, a bit funny, built-for-fun. The guardrails stay: no claims that modes improve results, no claims that agents feel anything, no drugs or edgy jokes, nothing about other brands' look or names.

Facts every post may rely on (all verified in this repo):
- MCP server, 5 tools, 6 bundled modes. Modes are static and never fetched from the network.
- No telemetry. The local log holds only a mode id, a timestamp and a random session id.
- Cards and recaps are drawn locally and nothing is uploaded unless you post the image.
- Tested with Claude Code, Codex CLI and opencode (one smoke test each). Cursor config is provided but untested.
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

**Title:** Show HN: Modedial – a mode dial for coding agents (MCP server)

**URL:** <SITE_URL> (or the repo)

**First comment (post right after submitting):**

I kept typing the same few instructions at coding agents: stay on one task, reproduce before guessing, review without editing. Modedial turns them into six named modes that an agent switches with one MCP call. It started as a joke about music apps for agents and got a bit out of hand.

`set_mode("debug")` returns a short instruction bundle (under 150 tokens) that the agent follows until `end_mode`. The modes are static data bundled in the package and are never fetched at runtime, since pulling instructions from the network would be a prompt-injection hole.

Each mode asks the agent for a recognizable tell (Debug states a hypothesis and says when a fix is unconfirmed; Deep Focus opens with "Goal:" and ends with what it set aside). Every switch also renders a PNG card locally, and a recap image comes from your own log.

What it is not:
- It can't force behavior. It returns text; the agent decides.
- It has no benchmark behind it. I ran a small observational check (one run per mode on three tasks) and saw the style change. That is not evidence of better results. A real test would need fixed tasks, objective checks, repeated runs and several models.
- Tested with Claude Code, Codex CLI and opencode (one smoke test each). The Cursor config is in the README, untested.

No telemetry, no network calls, a log that stores a mode id and a timestamp. MIT: <REPO_URL>

If this gets no use, I'll say so and move on. Feedback on the modes, or on whether this should exist, is welcome.

(Built with help from Claude Code.)

---

## Notes before posting
- Post one platform at a time and reply fast in the first few hours.
- HN: no asking friends to upvote. Weekday morning, US time.
- Don't cross-post identical text. These three differ on purpose.
- Log every post, its link and the result in `LAUNCH_LOG.md`.
- If you want even more punch on X, the best lever is the clip. A real 6-second loop of a mode switch beats any wording.
