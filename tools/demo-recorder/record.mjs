// Records a screen capture tour of the live landing page with Playwright, then converts it for sharing.
// Usage: node record.mjs [url]            (default: https://modedial-site.vercel.app/)
// Output (in docs/launch/demo/):
//   modedial-site-tour.mp4          full tour of the page, about a minute
//   modedial-printer-loop.mp4/.gif  first 11 s only: the label printer, for X and the README
//   modedial-site-tour-poster.png   a still for link previews and the README
//
// This is a tour of the WEBSITE, including its interactive printer. The transcripts on the page are
// labelled "illustrative". It is not a recording of a real agent session; the real-session clip is in
// docs/launch/DEMO_SCRIPT.md.
import { chromium } from "playwright";
import ffmpegPath from "ffmpeg-static";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const URL_ = process.argv[2] ?? process.env.DEMO_URL ?? "https://modedial-site.vercel.app/";
const out = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "docs", "launch", "demo");
mkdirSync(out, { recursive: true });
const raw = mkdtempSync(join(tmpdir(), "modedial-rec-"));
const W = 1280, H = 720;

const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({
  viewport: { width: W, height: H },
  recordVideo: { dir: raw, size: { width: W, height: H } },
  colorScheme: "light",
});
await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(URL_).origin }).catch(() => {});

// A visible cursor and click ripple (the recorder does not draw the mouse pointer itself).
await context.addInitScript(() => {
  addEventListener("DOMContentLoaded", () => {
    const c = document.createElement("div");
    c.style.cssText = "position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;transform:translate(-200px,-200px)";
    c.innerHTML = '<svg width="26" height="26" viewBox="0 0 22 22"><path d="M3 2 L3 17 L7 13 L10 20 L13 19 L10 12 L16 12 Z" fill="#14161B" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    document.body.appendChild(c);
    document.addEventListener("mousemove", (e) => { c.style.transform = `translate(${e.clientX}px,${e.clientY}px)`; }, true);
    document.addEventListener("mousedown", (e) => {
      const r = document.createElement("div");
      r.style.cssText = `position:fixed;left:${e.clientX - 22}px;top:${e.clientY - 22}px;width:44px;height:44px;border-radius:50%;border:3px solid #FF8A3D;z-index:2147483646;pointer-events:none`;
      document.body.appendChild(r);
      r.animate([{ transform: "scale(.3)", opacity: 0.9 }, { transform: "scale(1.5)", opacity: 0 }], { duration: 550 }).onfinish = () => r.remove();
    }, true);
  });
});

const page = await context.newPage();
const pause = (ms) => page.waitForTimeout(ms);

async function glide(loc, steps = 14) {
  const b = await loc.boundingBox();
  if (!b) throw new Error("element not visible to point at");
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps });
}
async function click(loc) {
  await glide(loc);
  await pause(120);
  await page.mouse.down();
  await pause(70);
  await page.mouse.up();
}
async function scrollTo(sel, offset = 24) {
  await page.evaluate(([s, o]) => { const el = document.querySelector(s); window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - o, behavior: "smooth" }); }, [sel, offset]);
  await pause(1000);
}

await page.goto(URL_, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.mouse.move(W / 2, 120);

// 1. Hero: the label printer. It plays itself first, then we press the keys.
await pause(1500);
const key = (name) => page.locator("#keys .key", { hasText: name });
await click(key("Debug"));  await pause(2300);
await click(key("Focus"));  await pause(2300);
await click(key("Review")); await pause(2500);

// 2. The six modes: stickers, instructions and which guards are enforced
await scrollTo("#modes");
await pause(400);
const sticker = (name) => page.locator("#sheet .sticker", { hasText: name });
await click(sticker("Careful Reviewer")); await pause(2600);
await click(sticker("Debug Mode"));       await pause(1800);
const b = await sticker("Deep Focus").boundingBox(); // peel and drag a sticker
await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
await pause(150);
await page.mouse.down();
await page.mouse.move(b.x + b.width / 2 + 70, b.y + b.height / 2 + 48, { steps: 14 });
await pause(200);
await page.mouse.up();
await pause(1100);
await click(page.locator("#reset")); await pause(600);

// 3. Guards
await scrollTo("#guards");
await pause(600);
await glide(page.locator("#guards .gcard").nth(0));       await pause(1700);
await glide(page.locator("#guards .gcard").nth(1));       await pause(1700);
await glide(page.locator("#guards .proof div").nth(2));   await pause(1700);

// 4. Print your own card
await scrollTo("#cards");
await pause(400);
const chip = (i) => page.locator("#chips .chip").nth(i);
await click(chip(4)); await pause(1100);
await click(chip(1)); await pause(1100);
const proj = page.locator("#proj");
await click(proj);
await proj.press("Control+A");
await page.keyboard.type("acme-api", { delay: 80 });
await pause(1700);

// 5. Install
await scrollTo("#install");
await pause(300);
const tab = (name) => page.locator("#itabs button", { hasText: name });
await click(tab("Codex CLI"));   await pause(1100);
await click(tab("opencode"));    await pause(1100);
await click(tab("Claude Code")); await pause(900);
await click(page.locator("#icopy")); await pause(1100);

// 6. Back to the top
await scrollTo("#top", 0);
await pause(1800);

const video = page.video();
await context.close(); // flushes the video file
await browser.close();
const webm = await video.path();
console.log("recorded:", webm, `(${(statSync(webm).size / 1e6).toFixed(1)} MB)`);

// ---- convert for sharing
const ff = (args) => {
  const r = spawnSync(ffmpegPath, ["-y", "-loglevel", "error", ...args], { encoding: "utf8" });
  if (r.status !== 0) throw new Error("ffmpeg failed: " + r.stderr);
};
const mp4 = join(out, "modedial-site-tour.mp4");
const loopMp4 = join(out, "modedial-printer-loop.mp4");
const loopGif = join(out, "modedial-printer-loop.gif");
const poster = join(out, "modedial-site-tour-poster.png");
const h264 = ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-preset", "slow", "-movflags", "+faststart", "-an"];
ff(["-i", webm, ...h264, mp4]);
ff(["-t", "11", "-i", webm, ...h264, loopMp4]);
ff(["-t", "11", "-i", webm, "-vf", "fps=10,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=64[p];[b][p]paletteuse=dither=bayer:bayer_scale=4", "-an", loopGif]);
ff(["-ss", "5", "-i", webm, "-frames:v", "1", poster]);
for (const f of [mp4, loopMp4, loopGif, poster]) console.log(`wrote ${f}  ${(statSync(f).size / 1e6).toFixed(2)} MB`);
rmSync(raw, { recursive: true, force: true });
