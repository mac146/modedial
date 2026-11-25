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
