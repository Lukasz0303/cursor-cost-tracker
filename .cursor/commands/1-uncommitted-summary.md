Generate a one-sentence English summary from UNCOMMITTED changes only.

METHOD:
1. `git status --short`
2. `git diff HEAD --stat`
3. `git diff HEAD`
4. Staged and unstaged only — no extra product context

REQUIREMENTS:
- Exactly one sentence in English
- Conventional Commits prefix when it fits (`feat:`, `fix:`, `docs:`, `chore:`)
- Facts from the diff only

Examples:
- "docs: Add AI context, Cursor rules, and agent commands"
- "feat: Show Current and Today on the status bar"
- "fix: Copy state.vscdb before sql.js read on Windows"

Print the sentence — nothing else.
