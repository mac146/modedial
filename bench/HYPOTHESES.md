# Pilot pre-registration (written before any benchmark run)

Date written: 2026-11-23. Status: **pilot, underpowered on purpose.** Its job is to size cost and variance and to shake out the harness, not to prove anything. Results will be reported descriptively. No significance claims from this pilot.

## What is tested
Four small bug-fix tasks (`bench/tasks.mjs`), each with a failing test and a tempting unrelated "smell" nearby that should be left alone.

**Conditions** (same tools and same MCP config in all four):
1. `none`: the task prompt alone.
2. `debug`: the agent is told to call `set_mode("debug")` first, then gets the task prompt.
3. `deep-focus`: same, with `set_mode("deep-focus")`.
4. `generic`: the task prompt preceded by a single plain sentence: "Be careful: keep your change small and confirm it works before you finish."

The `generic` condition is the control that matters. If it does as well as a mode, modes add convenience and fun but no measured benefit.

## Hypotheses
- **H2:** `debug` passes the task's test more often than `none`.
- **H3:** `deep-focus` makes fewer out-of-scope changes than `none`.
- **H5 (null we take seriously):** `generic` does as well as `debug` on H2 and as well as `deep-focus` on H3.

## Metrics (all objective, computed by the harness)
- **Pass:** `node test.js` exits 0 after the run, and `test.js` was not modified.
- **Scope violations:** count of (a) files changed outside the task's allowed list and (b) "must remain" snippets that were deleted or altered.
- **Cost and effort:** reported `total_cost_usd`, `num_turns`, `duration_ms`.

## Analysis plan
- Report every run, including failures, errors and timeouts. Runs that error out count as not passing; they are not dropped.
- Per task and condition: pass rate, mean scope violations, mean turns and cost.
- With 3 runs per cell, no tests of significance. If a difference appears, the next step is a larger run with the same pre-registered hypotheses, not a claim.
- Results, whatever they are, go in `bench/RESULTS.md`. A null or negative result is published the same way.

## Known limits
- One agent (Claude Code) and one model per run, so any finding is specific to that.
- Small synthetic tasks; real repos are messier.
- The task prompts and checks are ours, so there is a risk we wrote tasks that favor one condition. Tasks are public so anyone can rerun or challenge them.
- The agent chooses whether to follow a mode's instructions. In the `debug` and `deep-focus` conditions we check that `set_mode` was actually called (from the server's own log), and report runs where it was not.
