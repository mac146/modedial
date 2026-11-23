# Pilot 1 results (2026-11-23)

Pre-registered in `HYPOTHESES.md` before any run. Raw data: `results/pilot1.jsonl`. Re-create the table with `node bench/summarize.mjs bench/results/pilot1.jsonl`.

**Setup:** Claude Code (headless), 4 small bug-fix tasks, 4 conditions (`none`, `generic` one-liner, `debug`, `deep-focus`), 3 runs per cell, 48 runs, about $4.10 total.

| Condition | Runs | Pass | Scope violations (mean) | Turns (mean) | Cost per run |
|---|---|---|---|---|---|
| none | 12 | 12/12 | 0.00 | 9.3 | $0.077 |
| generic | 12 | 12/12 | 0.00 | 9.8 | $0.081 |
| debug | 12 | 12/12 | 0.00 | 12.5 | $0.100 |
| deep-focus | 12 | 12/12 | 0.00 | 11.2 | $0.084 |

Checks: `set_mode` was actually called in 24 of 24 mode runs. No run modified `test.js`. No errors or timeouts.

## What this shows
- **Hypotheses H2 and H3 could not be tested.** Every condition passed every task and made zero out-of-scope changes. This is a ceiling effect: the tasks are too easy for the agent to fail, so there is nothing for a mode to improve. This is **not** evidence that modes don't help, and it is not evidence that they do.
- **The harness works.** Tasks are valid (each fails before a reference fix and passes after), the checks are objective, and the mode-called check confirms the conditions were applied.
- **One descriptive observation, with the caveat of 3 runs per cell:** the mode conditions used more turns and cost more than `none` (debug about 34% more turns and 30% more cost than none; deep-focus about 20% more turns and 9% more cost). That is consistent with the modes adding steps such as reproducing, confirming and summarizing. We have no evidence yet that the extra work buys anything. If a later run finds no benefit, this overhead is a real cost to report.

## What would make the next pilot informative
- **Tasks the baseline sometimes fails**, so there is room to improve: bugs spread over several files, misleading error messages, or a failing test whose cause is in a different file than the one named.
- **A stronger scope temptation** for H3: tasks where a lint warning or a failing unrelated test invites the agent to "fix" more than asked, and where the prompt doesn't name the file to change.
- **Review tasks (H1)** with seeded bugs, scored by recall and false positives.
- A cheaper or smaller model as well, since stronger models hide differences.
- The same hypotheses stay pre-registered; new tasks get committed before they are run.

## Status
Null and uninformative, not positive. No performance claim is made anywhere, and none is justified by this pilot.
