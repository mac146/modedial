// Usage: node bench/summarize.mjs bench/results/pilot1.jsonl
import { readFileSync } from "node:fs";

const rows = readFileSync(process.argv[2], "utf8").trim().split("\n").map((l) => JSON.parse(l));
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const f = (n, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : "-");
const conds = ["none", "generic", "debug", "deep-focus"];

function table(title, sel) {
  console.log(`\n${title}`);
  console.log("condition".padEnd(12) + "runs".padEnd(6) + "pass".padEnd(10) + "scope viol (mean)".padEnd(20) + "turns".padEnd(8) + "cost $".padEnd(9) + "errors");
  for (const c of conds) {
    const r = rows.filter((x) => x.cond === c && sel(x));
    if (!r.length) continue;
    const pass = r.filter((x) => x.pass).length;
    console.log(
      c.padEnd(12) + String(r.length).padEnd(6) + `${pass}/${r.length}`.padEnd(10) + f(mean(r.map((x) => x.scope))).padEnd(20) +
        f(mean(r.filter((x) => x.turns != null).map((x) => x.turns)), 1).padEnd(8) + f(mean(r.filter((x) => x.cost_usd != null).map((x) => x.cost_usd)), 3).padEnd(9) +
        r.filter((x) => x.is_error).length,
    );
  }
}

table("ALL TASKS", () => true);
for (const t of [...new Set(rows.map((r) => r.task))]) table(`task: ${t}`, (x) => x.task === t);

const mc = rows.filter((x) => x.modeExpected);
console.log(`\nmode actually called in mode conditions: ${mc.filter((x) => x.modeCalled).length}/${mc.length}`);
const tampered = rows.filter((x) => !x.testIntact);
console.log(`runs that modified test.js: ${tampered.length}`);
console.log(`total cost: $${f(rows.reduce((s, x) => s + (x.cost_usd || 0), 0), 2)}  total runs: ${rows.length}`);
