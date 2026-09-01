Audit Cursor session leakage before shipping a VSIX. Source: `.ai/context/security.md`.

## Instructions

1. In `src/` and `media/` (and `dist/` if it exists) search for: `accessToken`, `WorkosCursorSessionToken`, `Authorization`, `Bearer`, `console.log`, `output.append`.
2. Check `historyPanel` / `postMessage`: payload is table events only.
3. Confirm sql.js reads a file copy and SELECT is parameterized.
4. Confirm CSP in the webview HTML.
5. Do not dump `state.vscdb` values into chat or the repo.

## Output

Table: location | risk | status (OK / FAIL). Verdict: **safe to package VSIX** or a blocker list.
