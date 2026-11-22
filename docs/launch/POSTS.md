# Launch post drafts

**Drafts only. Nothing is published until you approve.** Replace `<SITE_URL>`, `<REPO_URL>` and `<NPM_URL>` once they exist. Don't add numbers we don't have (stars, downloads, users). Check each community's self-promotion rules on the day, because they change.

Facts every post may rely on (all verified in this repo):
- It is an MCP server with 5 tools and 6 bundled modes.
- Modes are static and never fetched from the network.
- No telemetry. The local log holds only a mode id, a timestamp and a random session id.
- The card and recap are drawn locally, and nothing is uploaded unless you post the image.
- Tested with Claude Code only. Cursor and Codex configs are provided but untested.
- No benchmark. We checked response style in a small observational run (1 run per mode per task, 3 tasks).

---

## X (thread)

**1/**
I made modedial: named modes for coding agents, as a small MCP server.

Say "debug mode" or "deep focus" and your agent gets a short set of instructions to follow. Six modes, one call. Open source, runs locally.

<SITE_URL>

**2/**
Each mode has a visible tell so you can see it's on. Debug Mode states a hypothesis and says when a fix is unconfirmed. Deep Focus opens with "Goal:" and ends with what it set aside. Careful Reviewer ranks must-fix vs nice-to-have.

[clip or screenshot]

**3/**
What it isn't: an MCP tool can't force an agent to do anything. It returns text and the agent chooses to follow it. I also haven't benchmarked whether modes improve results. I only checked, in a small test, that each one changes the style of the reply.

**4/**
Every switch makes a card, and there's a recap from your own log. They're drawn on your machine. No telemetry, no accounts, nothing uploaded unless you post the image.

Install (tested with Claude Code):
`claude mcp add modedial -- npx -y modedial`

Feedback welcome, especially on the modes themselves. <REPO_URL>

---

## Reddit (r/ClaudeAI, and similar developer communities where tool posts are allowed)

**Title:** I made a small MCP server that gives coding agents named modes (Deep Focus, Debug, Careful Reviewer…). Looking for feedback

**Body:**

I use coding agents a lot and kept retyping the same kind of instruction: "stay on this one task", "reproduce before you guess", "review this, don't edit it". So I turned those into named modes that you switch with one call.

How it works: it's an MCP server. When you say "debug mode", the agent calls `set_mode` and gets back a short instruction bundle (under 150 tokens) to follow until you end the mode or pick another. There are six: Deep Focus, Debug Mode, Chill Refactor, Creative Sprint, Careful Reviewer and Fast Prototype. Each one asks the agent to show a recognizable "tell", for example Debug Mode states a hypothesis and says when a fix is unconfirmed.

Things to know up front:
- An MCP tool can't force behavior. It returns instructions and the agent follows them (or doesn't). Pasting a short snippet into CLAUDE.md or AGENTS.md makes it more reliable.
- I haven't benchmarked whether modes improve results, and I'm not claiming they do. I only ran a small check (1 run per mode on 3 tasks) to see that each mode changes the style of the answer.
- I've tested it with Claude Code only. There are config blocks for Cursor and Codex, but I haven't run them.
- No telemetry and no network calls. A local log stores only a mode id and a timestamp. Modes are bundled in the package, never fetched.
- It also makes a shareable image card per mode switch, and a recap image from your own local log. Both are drawn locally.

It's MIT licensed. Install: `claude mcp add modedial -- npx -y modedial`. Repo: <REPO_URL>

What I'd most like to know: are these the right modes? Which would you add, cut or rewrite? And if you try it with Cursor or Codex, did it work?

(Disclosure: I built this with help from Claude Code.)

---

## Hacker News

**Title:** Show HN: Modedial – named modes for coding agents, as an MCP server

**URL:** <SITE_URL> (or the repo)

**First comment (post right after submitting):**

Hi HN. I built this because I kept retyping the same few instructions to coding agents: stay on one task, reproduce before guessing, review without editing. Modedial turns them into six named modes that an agent can switch with one MCP call.

How it works: `set_mode("debug")` returns a short instruction bundle (under 150 tokens) that the agent follows until `end_mode`. The modes are static data bundled in the package and are never fetched at runtime, because pulling instructions from the network would be a prompt-injection risk.

Limits, plainly:
- A tool can't force an agent's behavior. It returns text, and the agent chooses to follow it.
- I have not benchmarked whether modes improve outcomes. I ran a small observational check (one run per mode on three tasks) and saw that each mode changes the style of the response in a recognizable way. That is not evidence of better results, and a real benchmark would need fixed tasks with objective checks, multiple runs and multiple models.
- Tested with Claude Code only. Cursor and Codex configs are in the README but untested.

Privacy: no telemetry and no network calls. The local log stores a mode id, a timestamp and a random per-process session id, and nothing about your code or prompts. There's also a card and a recap image, drawn locally with bundled fonts.

It's a small experiment and I'll be honest if it doesn't get any use. Feedback on the modes, and on whether this should exist at all, is welcome. Code is MIT: <REPO_URL>

(Built with help from Claude Code.)

---

## Notes before posting
- Post one platform at a time and reply to feedback quickly in the first few hours.
- HN: avoid asking friends to upvote. Post on a weekday morning US time.
- Don't cross-post identical text. The three drafts above differ on purpose.
- Log every post, its link and the result in `LAUNCH_LOG.md`.
