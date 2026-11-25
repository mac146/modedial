> **Update:** a Playwright recording of the landing page now exists in `docs/launch/demo/` (see `tools/demo-recorder/README.md`). It is a tour of the website and its illustrative transcripts. The clip described below, a real agent session, is still separate and still needs recording.

# Demo clip script (about 25 seconds)

Goal: show an agent switching modes in a real session, and the card at the end. **Record real output. Do not mock the agent's replies.** The landing page's printer animation is an illustration; this clip is the evidence.

## Prep (once)
- Install the server in Claude Code: `claude mcp add modedial -- npx -y modedial` (after publishing, or point at the local `dist/cli.js` for a rehearsal).
- Paste the snippet from the README into the demo project's `CLAUDE.md`.
- Use a tiny sample repo with two things ready: a flaky test (for Debug Mode) and a short diff with an obvious bug (for Careful Reviewer). Keep the project folder name clean (for example `my-app`), because it can appear on the card if `MODEDIAL_CARD_PROJECT=1` is set.
- Terminal: dark or light theme matching the site, font size 18+, window about 1280×720, no personal paths or email visible. Hide the prompt's username and path.
- Clear the log first so the card and recap are fresh: set `MODEDIAL_HOME` to an empty temp folder.
- Record with any screen recorder (OBS, ScreenToGif, or Windows Game Bar), then trim. Export MP4 for X and the README, plus a GIF under 5 MB for the README.

## Shot list

| Time | On screen | Caption (burned in, plain text) |
|---|---|---|
| 0:00–0:03 | Agent session open. You type: `this test is flaky, debug mode` | Pick a mode in plain words |
| 0:03–0:08 | The agent calls `modedial set_mode("debug")`. The tool result is visible, with the mode name and the instructions. | The agent gets a short instruction bundle |
| 0:08–0:14 | The reply shows the tell: a reproduction, one hypothesis, and "unconfirmed until re-run". Highlight those lines. | Each mode has a visible tell |
| 0:14–0:19 | You type: `now review the diff, careful reviewer mode`. The agent switches, and the reply is ranked must-fix / nice-to-have with "not checked". | Switch any time |
| 0:19–0:23 | In a second terminal pane: `npx modedial card`. Cut to the saved PNG opening in an image viewer. | A card on every switch, made locally |
| 0:23–0:25 | End frame on a plain background: `claude mcp add modedial -- npx -y modedial` and the site URL. | Open source. No telemetry. |

## Rules for the clip
- No voiceover needed. Captions only, so it works muted.
- Don't speed up the agent's work in a way that hides how long it took. A cut is fine if it is marked with a short caption such as "(trimmed)".
- Don't say the modes "improve" anything. The clip shows style changes.
- If the agent doesn't follow a mode on the take, say so in the post and keep the take, or re-record with the snippet in place. Don't edit the output.

## Variants
- **6-second loop for X:** shots 0:00–0:08 only, ending on the tell.
- **Still for the README:** a screenshot of shot 0:08–0:14.
