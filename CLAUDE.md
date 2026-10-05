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
- **Never merge into or push `main` until Seth has tested and explicitly approved**
  (e.g. "dev is tested, release it"). Then ff-merge `dev` → `main`, push with
  `ALLOW_MAIN_PUSH=1`, and confirm the Pages deploy succeeded.
- The `.git/hooks/pre-push` guard enforces both rules (hooks are per-clone: copy it from
  `mac-audio-player-loader/.git/hooks/pre-push` after any re-clone, incl. on Windows).
