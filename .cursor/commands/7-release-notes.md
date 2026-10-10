Prepare release-notes JSON for the version in `package.json`. Use **user-facing** language (a Cursor user), not class names.

Read `.ai/context/prd.md` first (Current, Today, Last 100, Refresh).

## Version

- The release version is `package.json` `"version"`.
- Do **not** PATCH-bump the highest `v*` tag over that version. On this repo `v1.1.6` is an old 1.0.2 merge and `v1.0.6` sits on the 1.0.3 docs commit. A version sort of those tags is not the product version.
- PATCH-bump the last tag only when `package.json` still equals that tag and the working tree has new user-facing work. If there is no tag, use `package.json`, or `0.1.0` when `package.json` is missing.

## What counts as this release

1. `git fetch --tags origin` and `git tag -l 'v*' --sort=-v:refname`. Note which tag points where. Do not treat a misplaced tag as the base.
2. `git status` and `git diff HEAD --stat`, including untracked files under `src/`, `media/`, `README.md`, and `CHANGELOG.md`.
3. The notes are the user-facing delta of **this version**: uncommitted changes plus commits that are not already a heading in `CHANGELOG.md`.
4. No new commits **and** a clean working tree → do not create a file.
5. A dirty working tree **is** the release. Do not stop because `git log <tag>..HEAD` is empty.
6. Do not replay older changelog sections (1.0.3–1.0.6 and below) just because a tag is behind `HEAD`.
7. Do not copy a short existing `CHANGELOG` section and stop. If that section is thinner than the diff, replace it.

## Write

Folder `release-notes/`, file `release-{M}-{m}-{p}-{DD}-{MM}-{YYYY}.json`. Same notes go at the top of root `CHANGELOG.md`. Keep older versions below. Replace this version's heading when it already exists and under-reports the diff.

```json
{
  "version": "0.1.0",
  "date": "2026-09-01",
  "gitTag": "v0.1.0",
  "title": "Release notes — Cursor Cost Tracker (0.1.0)",
  "intro": "Status bar spend and last 100 queries in the editor.",
  "sections": [
    {
      "name": "New features",
      "items": ["**Current** — cycle spend on the status bar."]
    }
  ]
}
```

Sections: New features, Improvements / Fixes, Other. Skip empty ones.

Cover every user-visible surface in the diff: status bar, query history, Statistics, Charts, Optimize, Support, Settings, Coding stats. Skip agent-only rules, tests, and build output unless the user can see the result.

## Tag

`git tag -m "Release x.y.z" vx.y.z` only when that tag does not exist **and** the release changes are already committed. A dirty tree means the tag would point at the previous release — do not create it. Do not push unless the user asks.

## Package

The Extensions view **Changelog** tab reads `CHANGELOG.md` inside the installed VSIX. It does not read the working tree or `release-notes/`.

After the notes are written, rebuild that version: one `npm run package` with full permissions. Then check the new `cursor-cost-tracker-X.Y.Z.vsix` contains the new heading (unzip and search `CHANGELOG.md`). An already built VSIX keeps the old bullets until this rebuild. Installing that file is what updates the tab in the screenshot.

Do not overwrite this command file while running it. The user may edit this file in a separate ask. Summarize the JSON path, CHANGELOG heading, whether the tag was created, and the VSIX path.

Avoid: esbuild, sql.js, WebviewPanel — write “status bar”, “query history”, “refresh”. Do not mention the gated leaderboard tab in `CHANGELOG.md` or `release-notes/`.
