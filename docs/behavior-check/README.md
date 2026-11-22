# Behavior check (observational)

**This is not a performance claim.** It is one run per cell (7 conditions × 3 tasks = 21 runs), with Claude Code in headless mode using the real `modedial` server. Outputs are non-deterministic, so another run could look different. We looked only at whether the *style* of the response visibly changed.

Tasks (text-only, answered in chat): (1) fix an off-by-one in `paginate`, with an unrelated ugly function nearby; (2) add a rate limiter to `POST /login`; (3) look at a diff that has an off-by-one loop, SQL string concatenation and a discount.

Files are `<mode>__<task>.txt`; `none__*` is the no-mode baseline.

## What we saw

| Mode | Visible change vs baseline |
|---|---|
| Debug Mode | Traced the failing case by hand, stated a hypothesis, listed what it ruled out, and said the fix was **unconfirmed** because it could not run code. This was the clearest change. |
| Creative Sprint | Offered three approaches (one unconventional), recommended one, and flagged risks. Longest answers. |
| Careful Reviewer | Findings split into must-fix and nice-to-have, with a "not checked" section. |
| Fast Prototype | Shortest answers, with TODO markers on shortcuts. |
| Chill Refactor | Held the change to the minimum, offered a tidy-up only on request, and pushed for tests. Distinctive on task 1, subtler on 2 and 3. |
| Deep Focus | Fixed the named task and put other observations under a "Tangent, not touched" label. It looked a lot like the baseline, because the baseline also left unrelated code alone. |

## Caveats

- Sample size is 1 per cell. There is no statistical claim.
- Claude was told to call `set_mode` explicitly in these prompts. In real use the agent needs the CLAUDE.md snippet or a user request to do that.
- Deep Focus and Chill Refactor are the weakest candidates for "visible difference" and may need sharper instructions.
- We did not judge correctness or quality, only style differences.
