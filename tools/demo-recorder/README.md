# Demo recorder

Records a screen capture tour of the live landing page with [Playwright](https://playwright.dev/), then converts it with a bundled ffmpeg. It is a dev tool and is not part of the published package or its CI.

```bash
cd tools/demo-recorder
npm install
node record.mjs                       # records https://modedial-site.vercel.app/
node record.mjs http://localhost:3000 # or any other URL
```

Output goes to `docs/launch/demo/`:

| File | What |
|---|---|
| `modedial-site-tour.mp4` | The whole page, about a minute: printer, stickers, guards, card maker, install tabs |
| `modedial-printer-loop.mp4` / `.gif` | The first 11 seconds only (the label printer). Small enough for the README and for X |
| `modedial-site-tour-poster.png` | A still frame |

It drives Microsoft Edge (`channel: "msedge"`), so no browser download is needed on Windows. On macOS or Linux change the channel to `chrome`, or run `npx playwright install chromium` and remove the channel. Playwright does not draw the mouse pointer, so the script injects a visible cursor and click ripples.

**This is a tour of the website.** The transcripts on the page are labelled "illustrative", and so is this clip. It is not a recording of a real agent session. The real-session clip is described in `docs/launch/DEMO_SCRIPT.md`.

## The real-session clip

Two more scripts make a clip of REAL Claude Code sessions with the modedial hooks installed:

```bash
node capture-session.mjs sonnet   # runs 3 real `claude -p` sessions, saves captured/sessions.json (a few cents)
node scrub.mjs captured/sessions.json   # removes local paths and names; capture does this too
node record-session.mjs           # replays the log in replay.html and records it with Playwright
```

`capture-session.mjs` stores every event the agent emits, with its real arrival time. `replay.html` plays those events back in a terminal-style page: real tool calls, real results, real replies, and the real hook denial. What is edited for the screen, and stated on the clip itself: pauses are shortened, internal tool-loading steps (`ToolSearch`) are hidden, and long replies are trimmed (the mode's closing line, for example `Not checked:`, is always kept). Nothing is typed in by hand. `record-session.mjs` refuses to run if the captured data still contains a local path or name.

What the recording does NOT show: Claude Code's own terminal UI. It is a replay of the recorded events in our own page. Say so when you post it.
