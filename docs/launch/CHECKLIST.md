# Pre-launch checklist

Nothing here has been done yet unless ticked. Items marked **you** need your accounts or decisions.

## Before anything goes public
- [ ] **you** Review `README.md`, `site/index.html`, `docs/launch/POSTS.md` and `DEMO_SCRIPT.md`.
- [ ] **you** Decide about the commit email: your personal address is in the git history. It becomes public when the repo does. GitHub's private `noreply` address avoids that, and I can rewrite the history if you want it.
- [ ] Re-run the name check on npm and GitHub right before publishing (names can be taken in the meantime).
- [ ] **you** Pick and buy a domain (confirm availability with a registrar first; `.com` was taken, `.dev`, `.app`, `.ai` and `.io` looked free on RDAP).
- [ ] Test the Cursor and Codex configs, or keep them labelled untested everywhere.
- [ ] Record the demo clip from `DEMO_SCRIPT.md` and add it to the README and the site.
- [ ] Add an `og:image` (an absolute URL, for example the Deep Focus card) to `site/index.html`.
- [ ] Remove "pre-release, not yet on npm" from the README after publishing.
- [ ] Final read for claims: no "improves", no emotion words, no performance numbers.

## Publish (all **you**, I will not do these without an explicit go-ahead)
- [ ] `npm login`, then `npm pack --dry-run` and read the file list (about 33 files, 3 dependencies).
- [ ] `npm publish --access public` for version 0.1.0.
- [ ] Verify the install in a clean folder: `npx -y modedial list`.
- [ ] Make the GitHub repo public, then tag `v0.1.0`.
- [ ] Deploy `site/` (GitHub Pages or Cloudflare Pages). It's a static folder with `index.html` and `fonts/`; there's no build step.
- [ ] Optional: list the server in the MCP registry (needs an `mcpName` in package.json and your GitHub login).

## After posting
- [ ] Fill in `LAUNCH_LOG.md` daily for 14 days.
- [ ] Judge against the criteria in `LAUNCH_LOG.md` on day 14. Do not move the goalposts.
