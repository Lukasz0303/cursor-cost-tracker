Generate a detailed, professional Pull Request description in English from ACTUAL changes on this branch versus `main`. If there are no commits ahead of `main`, use uncommitted changes.

IMPORTANT:
1. Analyze the DIFF only — do not describe the whole product
2. For modified files (M), use git diff and describe only what changed
3. For added / untracked files — 1–2 sentences of purpose, not the full class
4. New files 100+ lines — keep it short, no method lists

Follow `.cursor/examples/pr-description-example.md`:

1. **Title** — Conventional Commits
2. **Overview** — 2–3 sentences about this PR
3. **What's Changed** — New Features; Core Components (usage, status bar, webview, parse); Improvements (errors, security, quality)
4. **Testing** — new or changed tests only
5. **Files Changed** — `git diff origin/main...HEAD --stat` or `git diff HEAD --stat`
6. **Breaking Changes** — or "None"
7. **Checklist** — token leak, CSP, activate non-blocking

METHOD:
1. `git fetch origin main` (or `git fetch`)
2. If commits vs main: `git diff origin/main...HEAD --name-status` and per-file diffs
3. Otherwise uncommitted: `git diff HEAD`

Write the description to `.ai/reports/PR_DESCRIPTION.md` (that folder is gitignored). Do NOT overwrite this command file.

After generating, ask if the description is OK. If yes — propose a commit message (do not commit unless the user asks).
