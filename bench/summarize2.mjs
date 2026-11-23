// Usage: node bench/summarize2.mjs bench/results/pilot2-haiku.jsonl [more.jsonl ...]
import { readFileSync } from "node:fs";

const rows = process.argv
  .slice(2)
  .flatMap((f) => readFileSync(f, "utf8").trim().split("\n").map((l) => JSON.parse(l)));
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const f = (n, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : "-");
const pad = (s, n) => String(s).padEnd(n);
const conds = ["none", "generic", "debug", "deep-focus", "careful-reviewer"];
const pct = (a) => (a.length ? `${a.filter(Boolean).length}/${a.length}` : "-");

for (const model of [...new Set(rows.map((r) => r.model))]) {
  const M = rows.filter((r) => r.model === model);
  for (const kind of ["fix", "review"]) {
    const K = M.filter((r) => r.kind === kind);
    if (!K.length) continue;
    const groups = [["ALL", () => true], ...[...new Set(K.map((r) => r.task))].map((t) => [t, (r) => r.task === t])];
    for (const [name, sel] of groups) {
      console.log(`\n== model ${model} | ${kind} | ${name}`);
      console.log(
        pad("condition", 17) + pad("runs", 6) +
          (kind === "fix" ? pad("visible", 9) + pad("hidden", 9) + pad("full pass", 11) : pad("bugs found (mean/5)", 21)) +
          pad("scope", 7) + pad("turns", 7) + pad("cost $", 8) + pad("mode called", 12) + "errors",
      );
      for (const c of conds) {
        const r = K.filter((x) => x.cond === c && sel(x));
        if (!r.length) continue;
        const mc = r.filter((x) => x.modeExpected);
        console.log(
          pad(c, 17) + pad(r.length, 6) +
            (kind === "fix"
              ? pad(pct(r.map((x) => x.visible)), 9) + pad(pct(r.map((x) => x.hidden)), 9) + pad(pct(r.map((x) => x.pass)), 11)
              : pad(f(mean(r.map((x) => x.found))), 21)) +
            pad(f(mean(r.map((x) => x.scope))), 7) +
            pad(f(mean(r.filter((x) => x.turns != null).map((x) => x.turns)), 1), 7) +
            pad(f(mean(r.filter((x) => x.cost_usd != null).map((x) => x.cost_usd)), 3), 8) +
            pad(mc.length ? `${mc.filter((x) => x.modeCalled).length}/${mc.length}` : "n/a", 12) +
            r.filter((x) => x.is_error).length,
        );
      }
    }
    if (kind === "review") {
      console.log(`\nper-bug hit rate (${model})`);
      for (const t of [...new Set(K.map((r) => r.task))])
        for (const c of conds) {
          const r = K.filter((x) => x.task === t && x.cond === c);
          if (r.length) console.log(`${pad(t, 15)} ${pad(c, 17)} ${r[0].hits.map((_, i) => `${r.filter((x) => x.hits[i]).length}/${r.length}`).join("  ")}`);
        }
    }
  }
}
console.log(
  `\ntotal cost: $${f(rows.reduce((s, x) => s + (x.cost_usd || 0), 0), 2)} | runs: ${rows.length} | test.js tampered: ${rows.filter((x) => !x.testIntact).length}`,
);
