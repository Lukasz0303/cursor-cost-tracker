Install the local VSIX in Cursor and list manual verification steps (PRD §13).

## Instructions

1. Find the newest `*.vsix` in the project (do not build unless the user asks or the file is missing — then run the package command first).
2. Propose:

```bash
cursor --install-extension <path-to.vsix>
```

Or: Extensions → Install from VSIX.

3. Manual checklist (user in Cursor, signed in):
   - status bar: Current within 10 s
   - Today visible, or hidden when events fail
   - click Current/Today → Last 100 panel
   - Refresh updates numbers
   - Output / logs: no token

Do not open someone else’s session or copy `state.vscdb` into the repo.
