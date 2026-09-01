Generate an unambiguous English commit message (Conventional Commits) from staged or attached files.

## Instructions

1. `git status --short`. If staged: `git diff --cached`. Otherwise analyze the attached files.
2. Format: `<type>(<scope>): <subject>`
   - Types: `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`, `perf`, `ci`, `build`
   - Optional scope: `usage`, `statusbar`, `webview`, `session`, `docs`
   - Subject: imperative, max 72 characters, no trailing period
3. Body only when WHY is needed (e.g. SQLite copy because Cursor locks the file).
4. If changes are unrelated — suggest separate commits.
5. Do not commit until the user asks.

Examples:
- `feat(statusbar): show Current and Today usage`
- `fix(session): read a copy of state.vscdb on Windows`
- `docs: add AI context and Cursor agent commands`

Ask at the end: use as-is / edit / split.
