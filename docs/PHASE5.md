# Phase 5 proposal: a measured, performance-focused version

**Status: proposal only. Nothing here is built.** The brief says Phase 5 applies only if the launch criteria are met (200+ installs and 20+ public shares within 2 weeks). This is written early so the decision is ready, not because the criteria are met.

## The question we cannot answer today
"Do modes make coding agents better at something measurable?" We have no evidence either way. Our only data is an observational style check (1 run per cell, 21 runs). Nothing in the product or the posts claims an improvement, and nothing should until this phase produces one.

## Part A: a benchmark we run ourselves (no user data needed)
This is the cheaper and more credible step, and it can happen before any telemetry.

**Hypotheses, written down before running** (so we can't pick the flattering one afterwards):
- H1: Careful Reviewer finds more seeded bugs than no-mode on review tasks.
- H2: Debug Mode more often reaches a verified fix (test passes) than no-mode on bug-fix tasks.
- H3: Deep Focus makes fewer out-of-scope edits than no-mode on tasks with tempting unrelated code.
- H4: Fast Prototype reaches a running version in fewer tool calls or tokens than no-mode.
- H5 (null we should take seriously): a plain one-line prompt such as "be careful and review the diff" does as well as the mode. If so, modes add convenience and fun but no measured benefit.

**Conditions per task:** no mode; the mode; a one-line generic prompt of similar length (the control that matters); optionally a different, wrong mode.

**Task sets:** small, fixed, objectively checkable, and public so others can rerun.
- Bug fixing: repos with a failing test (our own, plus a slice of an existing public benchmark where the license allows).
- Review: diffs with a known list of seeded bugs, scored by recall and false positives.
- Scope discipline: tasks with unrelated smells nearby; score out-of-scope edits by diff.
- Prototyping: a spec with a runnable acceptance script.

**Metrics:** pass rate (tests or acceptance script), seeded-bug recall and false positives, out-of-scope diff lines, tokens, tool calls and wall time. Any rubric-based judging is done blind to the condition, by a different model or by humans, and reported separately from the objective metrics.

**Design rules:**
- At least 10 runs per cell, because agent output varies run to run.
- At least two agents and two models, so a result isn't one model's quirk.
- Fixed seeds and versions recorded. Report effect sizes with confidence intervals, not only p-values, and correct for the number of comparisons.
- Publish everything, including the null results and the tasks where modes made things worse.

**Rough cost:** 4 hypotheses × ~12 tasks × 3–4 conditions × 10 runs × 2 models is about 3,000–4,000 agent runs. At a few cents to a dollar per run, that is low hundreds to low thousands of dollars. Start with a pilot of one hypothesis (H2 or H3) on ~5 tasks to size the real cost and the variance before committing.

## Part B: opt-in aggregated usage data (only after Part A shows something real)
Purpose: learn which modes people actually use and in what sequence, and (with consent) whether they keep them on, not to claim performance. Usage is not outcome data and can't prove a mode works.

**Principles:** off by default; a clear one-screen explanation; a single command to opt in or out; local-first, with the user able to see exactly what would be sent before sending.

**What could be sent:** a random install id (rotatable), modedial version, mode ids with counts and durations bucketed to coarse ranges, agent name, and day-level timestamps. **Never:** code, prompts, file names or paths, project or folder names, repo URLs, or IP-derived identity (use a collector that doesn't store IPs).

**What we would need:** a minimal receiving endpoint and storage (this breaks the current "no backend" rule, so it needs an explicit founder decision), a privacy policy, a retention limit, and the ability to delete by install id. Small cohorts would be reported only in aggregate, with a minimum group size.

**What this can answer:** which modes stick, which are abandoned after one use, which pairs people chain, and whether a mode's instructions are being ignored (for example, no tell appears), if we add an opt-in, content-free "tell present" check. It cannot tell us whether the work got better.

## Part C: what a "performance version" could become
Only if A shows a real, repeatable effect for specific modes on specific task types:
- Rename or retire modes that show no effect, and say so publicly.
- Keep the fun modes as fun, labelled as such.
- For modes with an effect, publish the benchmark, the exact instructions and the result, and let people rerun it.
- Optionally let users add custom modes with a local-only validator and a "run the benchmark on my mode" command. Custom modes would stay local, never fetched, to keep the static-instructions rule.

## Decision gate
Do Part A's pilot if, after launch, either (a) the success criteria are met, or (b) the founder wants evidence for its own sake. Do Part B only with an explicit decision to add a backend, and only after A. If A shows no effect, the honest outcome is to keep modedial as a fun, shareable convenience and say plainly that it isn't a performance tool.
