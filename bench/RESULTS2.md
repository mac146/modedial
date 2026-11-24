# Pilot 2 results (2026-11-24)

Pre-registered in `HYPOTHESES2.md` (with three amendments, all written before or without seeing valid results). Raw data: `results/pilot2-haiku.jsonl` and `results/pilot2-sonnet.jsonl`. Re-create the tables with `node bench/summarize2.mjs bench/results/pilot2-haiku.jsonl bench/results/pilot2-sonnet.jsonl`.

**Setup:** Claude Code (headless), two models reported separately, 5 runs per cell. Three fix tasks (visible test plus a hidden edge-case test, one with a lint trap) and one review task with 6 seeded bugs. 150 runs, $5.30 total. Mode conditions confirmed from the server's own log: `set_mode` was called in 59 of 60 expected runs (the one exception is an errored run).

## Fix tasks (full pass = visible and hidden test both pass)
| Model | Condition | Full pass | Mean scope violations | Turns | Cost per run |
|---|---|---|---|---|---|
| haiku | none | 10/15 | 0.00 | 7.4 | $0.005 |
| haiku | generic one-liner | 9/15 | 0.00 | 6.7 | $0.005 |
| haiku | debug | 8/15 | 0.00 | 11.8 | $0.008 |
| haiku | deep-focus | 10/15 | 0.00 | 8.8 | $0.006 |
| sonnet | none | 10/15 | 0.27 | 5.6 | $0.060 |
| sonnet | generic one-liner | 10/15 | 0.00 | 6.3 | $0.063 |
| sonnet | debug | 10/15 | 0.00 | 8.2 | $0.078 |
| sonnet | deep-focus | 10/15 | 0.00 | 7.3 | $0.067 |

Per task: `cart` and `ranges` were solved almost every time in every condition. `memo` failed the hidden test in **all 40** runs, in every condition and both models (visible test passed every time). **Diagnosed afterwards (see the erratum at the end): this was a flaw in the task, not a result about the models or modes.**

## Review task (seeded bugs found, out of 6, keyword-scored)
| Model | none | generic | careful-reviewer | Turns (none → mode) |
|---|---|---|---|---|
| haiku | 5.2 | 5.4 | 5.0 | 2.4 → 6.2 |
| sonnet | 5.8 | 6.0 | 6.0 | 2.0 → 4.2 |

## Against the pre-registered hypotheses
- **H2′ (debug passes more than none): not supported.** Haiku 8/15 vs 10/15 (lower), sonnet 10/15 vs 10/15. Two of haiku's failures in `debug` and `generic` came from runs that errored out after about 3 minutes (see below), counted as not passing as pre-registered.
- **H3′ (deep-focus has fewer scope violations than none): not met.** The only scope violation in all 150 runs was one sonnet `none` run on the cart task that edited the two unrelated lint files (mean 0.27 vs 0.00). That is one run. The pre-registered bar was a gap of at least 0.5 in both models, and haiku showed none. Generic and debug also had zero violations, so we cannot tell this apart from noise.
- **H1 (careful-reviewer finds more seeded bugs): not supported.** Differences are 0.2 either way. This is a ceiling effect: both models find nearly every seeded bug with no mode. A scoring note: haiku identified the `||` versus `&&` bug in all 15 review replies, but my keyword pattern missed the wording in most. That affects every condition equally, so it doesn't change the comparison, but the "bugs found" numbers for haiku are slightly understated.
- **H5 (a one-line prompt does as well as a mode): supported.** The generic one-liner matched or beat the matching mode on every outcome metric, in both models.

## Overhead (descriptive, 5 runs per cell)
Modes made runs longer and more expensive: debug used about 59% more turns and about 60% more cost than none on haiku, and about 46% more turns and 30% more cost on sonnet. Deep Focus was about 19% and 30% more turns, and 20% and 12% more cost. Careful Reviewer roughly doubled to tripled the turns on the review task. No outcome metric improved in exchange.

## Errors and exclusions (all reported)
- Two haiku `ranges` runs (generic rep 5, debug rep 5) ran about 3 minutes and ended in an error. They are counted as failures. Removing them would not change any conclusion.
- One haiku run was interrupted when the working session ended (Amendment 3). It was moved to `results/interrupted.jsonl`, rerun, and not analyzed.
- 150 runs from the first launch errored because of a harness bug (Amendment 2). No model output existed. They are kept in `results/invalid-attempt1/` and excluded.
- No run modified `test.js`.

## What this does and does not show
- **It shows** that on these small tasks, with these two Claude models, none of the modes produced a measurable improvement over doing nothing or over a one-line prompt, and that they cost 10 to 60% more.
- **It does not show** that modes never help. The tasks are small and synthetic, the pilot is 5 runs per cell, the review result is a ceiling effect on a single task, and `memo` was a floor for every condition. A real effect on harder, messier tasks, on other models, or in longer sessions is not ruled out.
- **Modes still change style visibly** (see `docs/behavior-check`), which is the fun part. This pilot says style is not the same as better results.

## Decision implications
- Keep making no performance claim anywhere. This pilot gives no support for one.
- Plain, defensible statement we can make: "On a small benchmark of bug-fix and review tasks, modes did not beat a one-line prompt and cost more tokens. They change how the agent communicates."
- Part B of `docs/PHASE5.md` (opt-in usage telemetry and a backend) is not justified by this result. A bigger Part A run is justified only if there is appetite for finding a harder task set where a mode could matter.

## Erratum (same day, after inspecting two haiku `memo` solutions)
The `memo` hidden test is unfair, so the `memo` row in this document is invalid.
- Both inspected solutions were correct, careful implementations (a trie keyed by value identity, handling `undefined`, `null`, `""`, `"1,2"` versus `1, 2`, and `"constructor"`).
- They failed only because the hidden test expects `f({ a: 1 })` called twice with two separate but equal object literals to be a cache hit, which means structural equality. The code comment only says "exact arguments", which reasonably means identity. The spec was ambiguous and my test picked one reading.
- Consequence: the 0/40 on `memo` says nothing about models or modes. The remaining fix tasks (`cart`, `ranges`) were solved almost every time in every condition, and the review task hit a ceiling. **So pilot 2 is weaker than it first looked: effectively no task left room for a mode to help.** "No evidence of benefit" stands, but it rests on tasks that could not show a benefit. It should not be read as "modes were tested and failed".
- This also showed something useful: the agents silently picked one reading of an ambiguous spec and did not flag the ambiguity. That is a behavior a mode could target.
