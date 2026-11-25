// Captures REAL Claude Code sessions (with the modedial hooks installed) as timestamped event logs.
// Usage: node capture-session.mjs [model]        (default model: sonnet)
// Output: captured/sessions.json  (paths are rewritten to ~/my-app so no local folder names leak)
//
// Each scene is one real `claude -p` run. We record every event as it arrives, with its arrival time,
// so the replay can keep the real pacing. Nothing is written by hand.
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { deepScrub } from "./scrub.mjs";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const CLI = resolve(here, "..", "..", "dist", "cli.js");
const model = process.argv[2] ?? "sonnet";
const real = (p) => realpathSync.native(p);

const FILES = {
  "src/pricing.js": `// Discounts are percentages: applyDiscount(100, 10) should return 90.
function applyDiscount(amount, pct) {
  return amount - amount * pct / 10;
}
module.exports = { applyDiscount };
`,
  "src/cart.js": `const { applyDiscount } = require("./pricing");
// Total in cents: discount first, then 4.99 shipping unless the discounted subtotal is $50 or more.
function checkout(items, discountPct) {
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const discounted = applyDiscount(subtotal, discountPct);
  const shipping = discounted >= 50 ? 0 : 4.99;
  return Math.round((discounted + shipping) * 100);
}
module.exports = { checkout };
`,
  "test.js": `const assert = require("assert");
const { checkout } = require("./src/cart");
assert.strictEqual(checkout([{ price: 40, qty: 2 }], 10), 7200);
assert.strictEqual(checkout([{ price: 10, qty: 1 }], 0), 1499);
console.log("all tests passed");
`,
  "change.diff": `--- a/src/orders.js
+++ b/src/orders.js
@@ -1,6 +1,9 @@
-async function createOrder(db, user, items) {
-  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
-  const res = await db.query("INSERT INTO orders (user_id, total) VALUES ($1, $2) RETURNING id", [user.id, total]);
-  return res.rows[0].id;
-}
+async function createOrder(db, user, items) {
+  let total = 0;
+  for (let i = 0; i <= items.length; i++) total += items[i].price * items[i].qty;
+  const res = db.query("INSERT INTO orders (user_id, total) VALUES (" + user.id + ", " + total + ") RETURNING id");
+  return res.rows[0].id;
+}
`,
};

const SCENES = [
  {
    id: "debug",
    title: "Debug Mode: reproduce first, verify after the fix",
    prompt: "The checkout total in this project is wrong and test.js fails. Use modedial's debug mode and fix it. Run each shell command on its own.",
  },
  {
    id: "review",
    title: "Careful Reviewer: ranked findings, and what it did not check",
    prompt: "Use modedial's careful-reviewer mode to review change.diff and tell me what is wrong with it.",
  },
  {
    id: "guard",
    title: "Even when told to edit, the reviewer cannot",
    prompt: "Use modedial's careful-reviewer mode. Then use the Edit tool to add the line '// reviewed' at the top of src/cart.js. Tell me exactly what happened.",
  },
];

const work = real(mkdtempSync(join(tmpdir(), "modedial-cap-")));
const home = join(work, "home");
const project = join(work, "my-app");
for (const [p, c] of Object.entries(FILES)) {
  mkdirSync(dirname(join(project, p)), { recursive: true });
  spawnSync(process.execPath, ["-e", `require("fs").writeFileSync(process.argv[1], process.argv[2])`, join(project, p), c]);
}
const env = { ...process.env, MODEDIAL_HOME: home, MODEDIAL_NO_CARD: "1" };
const inst = spawnSync(process.execPath, [CLI, "install", "claude-code"], { cwd: project, env, encoding: "utf8" });
if (inst.status !== 0) throw new Error("hook install failed: " + inst.stderr);
const cfg = join(work, "mcp.json");
writeFileSync(cfg, JSON.stringify({ mcpServers: { modedial: { command: "node", args: [CLI.replace(/\\/g, "/")], env: { MODEDIAL_HOME: home.replace(/\\/g, "/"), MODEDIAL_NO_CARD: "1" } } } }));

const scrub = (s) => s.split(project).join("~/my-app").split(project.replace(/\\/g, "/")).join("~/my-app").split(work).join("~").split(work.replace(/\\/g, "/")).join("~");

async function runScene(scene) {
  const args = ["-p", "--output-format", "stream-json", "--verbose", "--permission-mode", "acceptEdits", "--max-turns", "20",
    "--mcp-config", `"${cfg}"`, "--strict-mcp-config", "--allowedTools", "Read,Edit,Write,Glob,Grep,Bash(node:*),mcp__modedial", "--model", model];
  const t0 = Date.now();
  const events = [];
  await new Promise((res, rej) => {
    const p = spawn("claude", args, { cwd: project, env, shell: true });
    let buf = "";
    p.stdout.on("data", (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line.startsWith("{")) continue;
        try { events.push({ t: Date.now() - t0, e: deepScrub(JSON.parse(line)) }); } catch {}
      }
    });
    p.on("error", rej);
    p.on("close", res);
    p.stdin.write(scene.prompt);
    p.stdin.end();
  });
  const types = events.map((x) => x.e.type + (x.e.subtype ? ":" + x.e.subtype : ""));
  console.log(`scene ${scene.id}: ${events.length} events in ${((Date.now() - t0) / 1000).toFixed(1)}s  [${[...new Set(types)].join(", ")}]`);
  return { ...scene, events };
}

const out = [];
for (const s of SCENES) {
  // each scene starts from clean project files and a clean mode state
  for (const [p, c] of Object.entries(FILES)) spawnSync(process.execPath, ["-e", `require("fs").writeFileSync(process.argv[1], process.argv[2])`, join(project, p), c]);
  rmSync(join(home, "sessions"), { recursive: true, force: true });
  out.push(await runScene(s));
}
mkdirSync(join(here, "captured"), { recursive: true });
writeFileSync(join(here, "captured", "sessions.json"), JSON.stringify({ recordedAt: new Date().toISOString().slice(0, 10), model, scenes: out }, null, 1));
console.log("saved tools/demo-recorder/captured/sessions.json");
try { rmSync(work, { recursive: true, force: true, maxRetries: 8, retryDelay: 400 }); } catch { console.log("(temp folder left behind, safe to delete)"); }
