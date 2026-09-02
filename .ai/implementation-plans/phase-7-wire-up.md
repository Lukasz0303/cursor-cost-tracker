# Phase 7 — Wire-up, package, verify

**Parent:** [mvp.md](./mvp.md)  
**Status:** ready to implement  
**Depends on:** phases [0](./phase-0-scaffold.md)–[6](./phase-6-history-webview.md)  
**Next:** stop. v1.1 is [token-spike.md](./token-spike.md) **after** PRD §13  
**Polish:** [phase-7-wire-up.pl.md](./phase-7-wire-up.pl.md)  
**PRD:** G4, §13 acceptance  
**Commands:** `9-security-token-audit`, `5-package-vsix`, `6-install-in-cursor`, `4-run-tests`

If this file and [mvp.md](./mvp.md) or the English PRD disagree, **the PRD wins**.

---

## 1. Goal

Connect config, `UsageService`, status bar, and history panel in `activate()`. Ship a local VSIX. Prove PRD §13 on a signed-in Cursor (Windows P0). Confirm the session token never appears in logs or the webview.

**Done when:** every §13 checkbox can be ticked on a signed-in machine.

---

## 2. Out of scope (do not sneak in)

| Item | Why |
|------|-----|
| Token-spike `!`, Ignore, `spikeTokenThreshold` | v1.1 — [token-spike.md](./token-spike.md) |
| Open VSX publish | v2 |
| Quick Pick, Activity Bar | not MVP |
| The word “ignore” in [mvp.md](./mvp.md) §13 wire-up | **not** spike Ignore; do not implement `IgnoreStore` |

---

## 3. Files to change

```
src/extension.ts
src/config.ts          # if not finished in phase 5
.vscodeignore          # confirm wasm + media + LICENSE + icon.png
.ai/context/codebase-snapshot.md
```

---

## 4. `activate()` sequence

`activate` must return quickly. **No `await` of session, fetch, or sql.js** on the main path.

```
read config
create UsageService with real deps:
  readCursorSession
  fetchUsageSummary
  fetchRecentEvents
service.start()                    // emits loading, fires refresh in background
StatusBarController.register(...)
registerCommand showHistory → HistoryPanel.show(context, service)
registerCommand refresh → void service.refresh()
onDidChangeConfiguration(e):
  if e.affectsConfiguration('cursorCost')
    re-read config
    service.reconfigure({ pollIntervalMinutes })
    status bar applies visibility
context.subscriptions.push(service, statusBar, configListener)
```

`deactivate`: empty; disposables on `subscriptions` are enough.

Register commands even if phase 0 already declared them in `package.json` — `registerCommand` is required or the palette no-ops.

---

## 5. Real dependencies

Wire `UsageService` to production functions from `session.ts` and `api.ts`. `locateFile` for sql.js wasm: `path.join(__dirname, 'sql-wasm.wasm')` (esbuild `outfile` dir = `dist/`).

If wasm is missing at runtime: snapshot error `Could not load Cursor session` — still no crash.

---

## 6. Verification order

Do these **in order**. Do not package if tests or the token audit fail.

### 6.1 Unit tests

```bash
npm test
```

All phase 1–6 tests green. Command: `4-run-tests`.

### 6.2 Token audit

Run Cursor command **`9-security-token-audit`**.

Grep `src/`, `media/`, and `dist/` for: `accessToken`, `WorkosCursorSessionToken`, `Authorization`, `Bearer`, careless `console.log`.

**Allowed:** the string `WorkosCursorSessionToken` **only** in `session.ts` when **building** the cookie (implementation necessity). It must **not** appear in `media/`, webview messages, or log statements.

**Forbidden:** logging the cookie; posting it; putting it in HTML.

Verdict required: **safe to package VSIX** or a blocker list. Fix blockers before 6.3.

### 6.3 Build + VSIX

Command **`5-package-vsix`**:

```bash
npm run build
npx @vscode/vsce package --no-dependencies
```

Confirm:

- `cursor-cost-tracker-0.1.0.vsix` (or current version) exists
- `.vscodeignore` does **not** exclude `dist/`, `media/`, `LICENSE`, `icon.png`, wasm
- VSIX contains `dist/extension.js`, `dist/sql-wasm.wasm`, `media/history.*`, `LICENSE`, `icon.png`

Do not commit the VSIX unless the user wants a release asset.

### 6.4 Install in Cursor

Command **`6-install-in-cursor`**. Windows P0:

```bash
cursor --install-extension ./cursor-cost-tracker-0.1.0.vsix
```

Or Extensions → Install from VSIX. Reload the window.

### 6.5 Manual checklist (PRD §13)

On a **signed-in** Cursor (this machine’s session — do not copy `state.vscdb` into the repo):

- [ ] VSIX in Cursor (Windows): Current within 10 s
- [ ] Today hidden when events fail; Current still shown (simulate by offline after cache, or temporarily break the events URL in a local build — if you cannot simulate, note it)
- [ ] Click Current/Today → Last 100 with columns TIME, MODEL, COST, TOKENS, INPUT / OUTPUT, KIND
- [ ] Close / X dismisses; another click reuses the panel
- [ ] Refresh updates the bar and the table
- [ ] Missing token → message, no crash (VS Code without Cursor, or signed-out Cursor)
- [ ] Token never in the webview or logs
- [ ] Restart Cursor: activate without errors

G1: numbers on the bar within 10 s. G2: second open of Last 100 feels instant (cache). G3: spot-check Current/Today vs cursor.com usage (± $0.01).

### 6.6 Snapshot

Update [codebase-snapshot.md](../context/codebase-snapshot.md):

- `src/` and `media/` trees
- scripts in `package.json`
- known gaps vs §13 (none if all boxes checked)
- stop saying “pre-implementation”

Do not claim v1.1 features.

---

## 7. Security recap

| Rule | Check |
|------|--------|
| Token only in extension host | audit + code review of `postMessage` |
| Parameterized SELECT | phase 2 |
| CSP nonce | phase 6 |
| Host allowlist `cursor.com` | phase 3 |
| `activate` non-blocking | no await network in `activate` |

---

## 8. After MVP

Only then implement [token-spike.md](./token-spike.md) (B1–B5, Ignore, threshold). Do not mix spike UI into this phase’s VSIX notes as if it were done.
