# How similar projects handle benchmarks, and what we do

Research done 2026-11-24. Sources are linked. Where a claim comes from a search summary rather than a page I read in full, it says so.

## Similar projects
| Project | What it is | Published benchmark of its modes/prompts? |
|---|---|---|
| [Roo Code](https://docs.roocode.com/features/custom-modes) and its fork Kilo Code | Custom modes with tool groups and file-pattern limits (a reviewer mode that cannot write files) | None found. One comparison page says Roo Code is now archived; Kilo is the successor. |
| SuperClaude | Slash commands, agents and behavioral modes for Claude Code | None found |
| BMAD | A full agile role pipeline of agents | None found |
| Superpowers | A planning/TDD skills framework | Only an anecdotal comparison (a simple app took about 20 min in plain Claude Code and 48–60 min with it). Not a controlled benchmark. |
| Cursor rules, `AGENTS.md`, `CLAUDE.md` | Repository instruction files | **Yes, one academic study** (below) |

**Finding:** none of the mode/persona projects I found publishes a systematic benchmark of its prompts. The closest rigorous evidence is about instruction files in general.

## The closest evidence: do instruction files help agents?
[Evaluating AGENTS.md: Are Repository-Level Context Files Helpful for Coding Agents?](https://arxiv.org/html/2602.11988) (ETH Zurich, ICLR 2026 workshop; per the summary I read) built AGENTbench from 138 real GitHub issues and also used SWE-bench Lite. Reported results:
- Context files gave **no improvement** in task success, and increased inference cost by **over 20%**.
- Developer-written files helped only marginally (about 4% on average). LLM-generated files had a small negative effect.
- Agents did follow the files: they explored and tested more.
- Caveat noted by commentators: the effect depends on how well the repo is already documented.

Our pilots found the same shape (no outcome gain, higher cost, visible behavior change). That is consistent with published work, which is worth saying plainly in the launch material.

## How good benchmarks are built, and the mistake I made
- [SWE-bench Verified](https://epoch.ai/benchmarks/swe-bench-verified/review) is 500 instances that human experts screened. An independent review still estimates **5–10% flawed** (and over 20% with scoring issues by a stricter audit), mostly underspecified issues and tests that check more than the issue asks for. It is also mostly small Python bug fixes and open to training-data contamination.
- [SWE-Bench Pro Verified](https://huggingface.co/papers/2609.08149.md) was built specifically to fix over-scoped tests and to add anti-cheating controls. Some models score noticeably lower on it than on the original.
- [Aider Polyglot](https://epoch.ai/benchmarks/aider-polyglot) uses 225 of Exercism's hardest exercises across six languages, with the exercise's own published tests, and a public leaderboard.

My `memo` task in pilot 2 had exactly the over-scoped-test flaw: the hidden test demanded structural equality that the spec did not state. The lesson from these projects is that **a team writing its own tests for its own prompts will make this mistake**, so use tests somebody else wrote and humans vetted.

## What we will do
1. **Prove behavior deterministically wherever possible.** Guards (read-only, scope lock, verify before finish, manifest protection, required tells) are checked with unit tests and a real-agent script, because "this mode cannot write a file" does not need a benchmark. This is something the similar projects do not publish either.
2. **For outcome claims, do not write our own tasks.** If we measure results, use a public human-vetted set: a slice of Exercism exercises (the Aider Polyglot source) or SWE-bench Verified / Pro Verified instances, with their own tests. Pre-register the hypotheses, include a one-line-prompt control, report cost as well as success, use at least two models and at least 10 runs per cell, and publish nulls.
3. **Set expectations from the literature.** The ETH study suggests extra instructions raise cost without raising success. We should expect that, and treat any real gain as a finding that needs replication.
4. **Do not run a large benchmark before launch.** It would spend real money to confirm a likely null. The honest, cheap position is: modes change behavior (shown), their guards are enforced (proved), and we make no claim that they improve results.

## Existing results in this repo
- `bench/RESULTS.md` (pilot 1): ceiling, no information.
- `bench/RESULTS2.md` (pilot 2, with erratum): no benefit seen, one invalid task, tasks too easy. Weak evidence; do not cite as a negative result.
