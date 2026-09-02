Review code changes on this branch versus `main` (or uncommitted changes if there are no commits vs main). You are a VS Code / Cursor extension reviewer.

Requirements: `.ai/context/prd.md`, `.ai/context/security.md`, `.cursor/rules/`.

Focus on:

1. **Architecture** — usage vs ui vs webview; early returns; no parse logic in statusBar
2. **Extension API** — disposables, panel reuse, activate does not block on network, `cursorCost.*` commands
3. **UI** — click Current/Today = Last 100 (not Quick Pick); table columns; `--vscode-*` tokens
4. **Security** — no token in logs or `postMessage`; CSP; SQLite copy; host allowlist
5. **Resilience** — missing session, API timeout, Today fail / Current ok, AbortController
6. **Tests** — Vitest for parse/format; fixtures without secrets
7. **VSIX** — `.vscodeignore`, `engines.vscode`, LICENSE and `icon.png` in the package

METHOD: `git fetch`, then `git diff origin/main...HEAD` or `git diff HEAD`.

Output: findings (blocker / should / nit) with file paths. Do not rewrite the PRD. Do not commit.
