# LAUNCH LOG

Success criteria, judged 2 weeks after public launch (decided up front, not to be moved):
- 200+ installs (npm downloads or MCP installs)
- 20+ people sharing a card or recap publicly
- If both are missed: stop or try a different angle. No overselling.

## How we measure (and how it can mislead)
- **Installs:** npm downloads, read from `https://api.npmjs.org/downloads/range/<start>:<end>/modedial`. This counts every `npx` run, CI jobs, mirrors and bots, so it **overstates** real users, and `npx -y` fetches can repeat for one person. Treat it as an upper bound, and say so when reporting. GitHub stars and clones are separate numbers; log them but they don't count as installs.
- **Shares:** count only public posts that show a modedial card or recap (images with our footer), found by searching X, Reddit and HN for "modedial" and for the card footer text, plus GitHub issues or discussions that include one. Our own posts and anyone we asked to post don't count. Log each with its link.
- **We have no telemetry**, by design. We can't see usage beyond what is public. That means no active-user figure, and we shouldn't claim one.

## Status
Not launched. Pre-launch steps are in `docs/launch/CHECKLIST.md`; drafts are in `docs/launch/POSTS.md`.

## Daily log

| Date | npm downloads (day) | Cumulative | Public shares (new) | Stars | What we did | What worked / didn't |
|------|---------------------|------------|---------------------|-------|-------------|----------------------|
| _not launched yet_ | | | | | | |

## Day-14 verdict (fill in honestly)
- Installs vs 200: 
- Shares vs 20: 
- Decision (continue / change angle / stop): 
