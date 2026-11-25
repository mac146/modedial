// Records the replay of the captured REAL Claude Code sessions (captured/sessions.json) with Playwright.
// Usage: node record-session.mjs
// Output (docs/launch/demo/): modedial-real-session.mp4, modedial-guard-moment.mp4/.gif, modedial-guard-poster.png
import { chromium } from "playwright";
import ffmpegPath from "ffmpeg-static";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LEAK } from "./scrub.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "..", "..", "docs", "launch", "demo");
mkdirSync(out, { recursive: true });
const raw = readFileSync(join(here, "captured", "sessions.json"), "utf8");
if (LEAK.test(raw)) throw new Error("captured data still contains local paths or names: run `node scrub.mjs`");
const data = JSON.parse(raw);
const tmp = mkdtempSync(join(tmpdir(), "modedial-rec-"));
const W = 1280, H = 720;

const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: tmp, size: { width: W, height: H } } });
await context.addInitScript(`window.__DATA = ${JSON.stringify(data)};`);
const t0 = Date.now();
const page = await context.newPage();
await page.goto("file:///" + join(here, "replay.html").replace(/\\/g, "/"));
await page.waitForFunction(() => window.__done === true, null, { timeout: 300000 });
const marks = await page.evaluate(() => window.__marks);
const video = page.video();
await context.close();
await browser.close();
const webm = await video.path();
const at = (name) => (marks.find((m) => m.name === name).epoch - t0) / 1000;
console.log("recorded", (statSync(webm).size / 1e6).toFixed(1), "MB; marks:", marks.map((m) => `${m.name}@${((m.epoch - t0) / 1000).toFixed(1)}s`).join("  "));

const ff = (args) => { const r = spawnSync(ffmpegPath, ["-y", "-loglevel", "error", ...args], { encoding: "utf8" }); if (r.status !== 0) throw new Error("ffmpeg failed: " + r.stderr); };
const h264 = ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-preset", "slow", "-movflags", "+faststart", "-an"];
const full = join(out, "modedial-real-session.mp4");
const gStart = at("scene-guard"), gEnd = at("end");
const guardMp4 = join(out, "modedial-guard-moment.mp4"), guardGif = join(out, "modedial-guard-moment.gif"), poster = join(out, "modedial-guard-poster.png");
ff(["-i", webm, ...h264, full]);
ff(["-ss", String(gStart), "-t", String(gEnd - gStart), "-i", webm, ...h264, guardMp4]);
ff(["-ss", String(gStart), "-t", String(gEnd - gStart), "-i", webm, "-vf", "fps=8,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=64[p];[b][p]paletteuse=dither=bayer:bayer_scale=4", "-an", guardGif]);
ff(["-ss", String(at("denial") + 0.8), "-i", webm, "-frames:v", "1", poster]);
for (const f of [full, guardMp4, guardGif, poster]) console.log(`wrote ${f}  ${(statSync(f).size / 1e6).toFixed(2)} MB`);
rmSync(tmp, { recursive: true, force: true, maxRetries: 6, retryDelay: 400 });
