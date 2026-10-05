# fdat — Claude Code notes

## ⚠️ GitHub costs — ask before anything billable (firm policy, 2026-07-07)

**Claude: never trigger anything that can incur GitHub charges without Seth's explicit
approval AND a stated cost estimate first.**

- FREE, always: Actions on **public** repos with **standard** GitHub-hosted runners;
  self-hosted runners; GitHub Pages.
- METERED (free monthly quota, then paid): Actions in **private** repos (2,000 min/mo;
  **Windows counts 2×, macOS 10×**); Codespaces; Packages; Git LFS.
- **ALWAYS billable, even on public repos: larger / GPU runners** (anything beyond the
  standard `ubuntu-latest` / `windows-latest` / `macos-latest` tiers).
- Safety valve: with **no payment method on file, GitHub blocks usage at the quota and
  cannot bill** — keep it that way, or set stop-usage budgets.

So WITHOUT Seth's explicit OK (and cost), do **not**: add or change `.github/workflows/**`;
use a non-standard `runs-on:`; add a `schedule:` (cron) trigger; create Codespaces; use
Git LFS; publish private Packages; or change the plan / budgets. The local
`.git/hooks/pre-push` blocks workflow pushes (override `ALLOW_WORKFLOW_PUSH=1`) and
production-branch pushes (`ALLOW_MAIN_PUSH=1`) — set those flags only after Seth approves
that specific push.

## Branch workflow — `main` is production (firm policy, 2026-07-07)

This repo follows the workspace dev-branch rule (`/Users/Seth/GIT/CLAUDE.md`,
"Git Workflow"): field users run the live web app straight from `main`, so a broken
`main` strands them.

- **`main` = production.** Every push to `main` deploys `docs/` to GitHub Pages
  (https://rulingants.github.io/fdat/) via `.github/workflows/pages.yml`. The desktop
  app is a browser shell that loads that same PWA, so a bad `main` breaks desktop too.
- **Do all work on `dev`** (create it from `main` on first touch if absent). Push `dev`
  freely, even unfinished. Feature branches may branch off `dev`.
- **`dev` is shared by several worktrees/sessions at once.** Immediately before pushing
  `dev`, `git fetch origin && git merge origin/dev` (or rebase a private feature branch
  onto it), then push. If the push is rejected as non-fast-forward, fetch and merge
  again; **never `--force` / `--force-with-lease` push `dev`.** A force-push silently
  drops whatever another session merged in the meantime (this happened on 2026-10-05:
  a stale worktree replaced the tip of `dev` and a full review commit had to be
  re-merged by hand).
- **Never merge into or push `main` until Seth has tested and explicitly approved**
  (e.g. "dev is tested, release it"). Then ff-merge `dev` → `main`, push with
  `ALLOW_MAIN_PUSH=1`, and confirm the Pages deploy succeeded.
- The `.git/hooks/pre-push` guard enforces both rules (hooks are per-clone: copy it from
  `mac-audio-player-loader/.git/hooks/pre-push` after any re-clone, incl. on Windows).

### Server-side guard on `main` (GitHub ruleset)

The pre-push hook only protects clones that have it. `main` is also protected on GitHub by
a **branch ruleset** (repo Settings → Rules → Rulesets), which no local setting can
bypass:

- Name: `protect-main`. Target: branch `main`. Enforcement: **Active**.
- Rules: **Restrict updates**, **Restrict deletions**, **Block force pushes**.
- Bypass list: **empty** (not even admins). Nothing can land on `main` while it is Active.

Release procedure (only after Seth says "dev is tested, release it"):
1. Settings → Rules → Rulesets → `protect-main` → set Enforcement to **Disabled**.
2. `git checkout main && git merge --ff-only dev && ALLOW_MAIN_PUSH=1 git push origin main`.
3. Confirm the Pages deploy succeeded (Actions → "Deploy GitHub Pages"; public repo,
   standard runner, so it is free).
4. Set the ruleset back to **Active** immediately.

Claude: never disable, edit or delete the ruleset; if a push to `main` is rejected by it,
that is the system working. Report it and stop.
