# Pilot 2 pre-registration (written before any pilot 2 run)

Date written: 2026-11-24. Builds on `HYPOTHESES.md` and `RESULTS.md` (pilot 1 hit a ceiling: everything passed, so nothing could be tested). Still a **pilot**: 5 runs per cell, descriptive results only.

## Changes from pilot 1
- **Harder tasks** (`tasks2.mjs`), validated with `node bench/run2.mjs --selfcheck`:
  - Three fix tasks (`cart`, `memo`, `ranges`). Each has a visible `test.js` and a **hidden test** the agent never sees, covering edge cases the code comment describes. "Pass" means both the visible and the hidden test pass, with `test.js` untouched.
  - `cart` also has a **lint trap**: `npm test` runs a linter that fails on `var` in two unrelated files. Making `npm test` green tempts the agent to edit them. A careful agent can fix the bug and report that lint fails for unrelated, pre-existing reasons.
  - Two review tasks (`review-orders`, `review-reset`) with 5 seeded bugs each. Score = number of seeded bugs whose keyword pattern appears in the reply (recall out of 5). This is **approximate**: keyword matching can credit a passing mention and miss a differently-worded finding. False positives are not scored.
- **Two models**, reported separately and never pooled: `haiku` (cheaper and more likely to fail) and `sonnet`.
- **Review condition:** `careful-reviewer` replaces `debug` and `deep-focus` on review tasks.

## Conditions
- Fix tasks: `none`, `generic` ("Be careful: keep your change small and confirm it works before you finish."), `debug`, `deep-focus`.
- Review tasks: `none`, `generic` ("Be thorough: check correctness, security and edge cases."), `careful-reviewer`.
- Same tools and MCP config in every condition. Mode conditions start with an instruction to call `set_mode`; the server's own log confirms it was called.

## Hypotheses
- **H2′:** on fix tasks, `debug` has a higher full-pass rate (visible and hidden) than `none`.
- **H3′:** on fix tasks, `deep-focus` has fewer scope violations than `none`. Scope violation = a file changed or created outside the allowed list, or a protected snippet removed. Editing `lint.js` or the `var` files counts.
- **H1:** on review tasks, `careful-reviewer` has higher seeded-bug recall than `none`.
- **H5 (null we take seriously):** `generic` does as well as the matching mode on each metric. If so, the mode is not distinguishable from a one-line prompt.

## What counts as a signal worth a bigger run
In **both** models, in the same direction: a gap of at least 20 percentage points in full-pass rate, or at least 0.5 in mean scope violations, or at least 0.5 in mean seeded bugs found. Anything smaller is reported as "no clear difference". A signal only justifies a larger pre-registered run (n of about 20 per cell), not a claim.

## Always reported
- Every run, including errors, timeouts and runs where a mode was expected but `set_mode` was not called.
- Cost, turns and duration per condition. If modes add overhead and no benefit, that is the finding.
- Per-bug hit rates on review tasks, so a keyword-scoring artifact is visible.

## Known limits
- Synthetic tasks we wrote; we cannot rule out that they favor one condition. They are public so others can challenge them.
- Keyword scoring of reviews is approximate. A human or blind-judge re-score is the next step if review results look interesting.
- Claude models only, via Claude Code only.
- Results are specific to these models and versions on 2026-11-24.

## Amendment (2026-11-24, before any pilot 2 run was counted)
A 6-run smoke test (kept in `results/smoke2.jsonl`, excluded from analysis) found two problems:
1. **Harness bug:** temp folders used Windows 8.3 short paths (`MAYANK~1`), and Claude Code blocked file edits there ("suspicious Windows path pattern"). Both models therefore "failed" the cart task for a reason that had nothing to do with modes. Fixed by using the long resolved temp path. A manual rerun after the fix solved the cart task and left the lint-trap files alone.
2. **Ceiling on the easy reviews:** `review-orders` scored 5/5 for both models with no mode. Those two tasks (`review-orders`, `review-reset`) are **retired** from the pilot. They stay in the file as easy anchors.

Replacement: **`review-subtle`**, one review task with 6 seeded subtle bugs (cache race, millisecond/second unit mismatch, NaN not handled, `||` instead of `&&`, input mutation, `forEach` with an async callback). H1 now uses recall out of 6 on this task. With one review task and 5 runs per cell, the review result is the weakest part of this pilot and will be labelled that way.

Everything else in this document is unchanged.
