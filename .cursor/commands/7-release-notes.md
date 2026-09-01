Prepare release-notes JSON from commits since the last `v*` tag to HEAD. Use **user-facing** language (a Cursor user), not class names.

Read `.ai/context/prd.md` first (Current, Today, Last 100, Refresh).

## Steps

1. `git fetch --tags origin`, `git tag -l 'v*' --sort=-v:refname`.
2. Base: last tag or root commit. `git log <base>..HEAD --oneline`. No commits → do not create a file.
3. Version: PATCH bump from the last tag (no tag → `0.1.0`, or `package.json` if higher).
4. Folder `release-notes/`, file `release-{M}-{m}-{p}-{DD}-{MM}-{YYYY}.json`.

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

5. Local tag `git tag -m "Release x.y.z" vx.y.z` only if it does not exist. Do not push the tag unless the user asks.
6. Do not overwrite this command file. Summarize the JSON path and tag.

Avoid: esbuild, sql.js, WebviewPanel — write “status bar”, “query history”, “refresh”.
