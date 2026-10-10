# Tech stack — Cursor Cost Tracker

Updated: 2026-10-10. Mapped to [prd.md](./prd.md). Current tree: **1.0.7** (`CHANGELOG.md` opens on 1.0.7; `package.json` still says 1.0.6 until the release bump).

## 1. Product

| Decision | Choice | Rejected | Why |
|----------|--------|----------|-----|
| Shape | VS Code Extension | Electron, PWA, CLI | Only the Extension API gives a status bar in Cursor |
| IDE | Cursor (VS Code fork) | JetBrains | Same VSIX; `engines.vscode` ≤ Help → About VS Code version |
| `extensionKind` | `ui` | `workspace` | Read `state.vscdb` on the local machine |

## 2. Runtime and build

| Area | Technology | Why |
|------|------------|-----|
| Language | TypeScript 5, `strict`, `noUncheckedIndexedAccess` | Typed `vscode` + usage parsing |
| Bundler | esbuild → `dist/extension.js` (CJS, `external: ['vscode']`) | Small VSIX, fast watch |
| Node | 18+ (`fetch`, AbortSignal). CI uses Node 20 | No axios |
| Packaging | `@vscode/vsce` | `.vsix` file |
| Tests | Vitest (`npm test`) | Unit tests only — no Electron |
| Types | `tsc --noEmit` (`npm run typecheck`) | Extension, tests, and `scripts/` |
| Lint | ESLint (`npm run lint`, `eslint.config.mjs`) | `src/` |
| CI | GitHub Actions `.github/workflows/ci.yml` | `npm ci`, typecheck, test, build on pull requests and on `main` / `release/**` |

**Rejected:** webpack (yo code), React/Vue in the webview, axios, native `better-sqlite3` as the only path.

## 3. Data and network

| Area | Choice | Notes |
|------|--------|-------|
| Session | `node:sqlite` read-only on the live file; sql.js copy only if the DB is under ~1.5 GiB | Cursor `state.vscdb` can be multi-GB (Node `readFile` / sql.js cannot load it). Keep sql.js for hosts without `node:sqlite`. Not `better-sqlite3`. |
| HTTP | `fetch` to `cursor.com` | `/api/usage-summary`, `/api/dashboard/get-filtered-usage-events`, `/api/dashboard/get-user-analytics` (Lines Edited). Model prices: public `https://cursor.com/docs/models-and-pricing.md` (no cookie, six-hour cache). Support messages: `POST` FormSubmit (no session token) |
| State | in-memory + optional `globalState` | Polling; no Redux |
| Timeout | 15 s, `AbortController` | One refresh at a time |

## 4. UI

| Surface | API | Phase |
|---------|-----|-------|
| Current / Today / Sync / 1–10 queries | `createStatusBarItem` | 1.0.0; count setting 1.0.2 |
| Six public tabs | `WebviewPanel`; sources in `media/src/`, bundle `media/history.js` | 1.0.0–1.0.6 |
| Spike `!` | status bar + TOKENS cell | shipped; table Ignore still open |
| Critical alert / Burn Rate Guard | modal once; toasts otherwise | 1.0.2 / 1.0.4 |
| Model pricing, list price, Play, To date, chart day zoom | Statistics, queries table, Charts | 1.0.5–1.0.6 |
| Group by conversation | queries toolbar + Settings (default off; CSV stays flat) | 1.0.6 |
| Run Optimize and Play | open Agent chat / that conversation | 1.0.7 |
| Settings | `contributes.configuration` (`cursorCost.*`) | current keys in the PRD §10 |
| Commands | show history, refresh, open dashboard, open pricing, export CSV | palette |
| Product site | static `site/` | GitHub Pages, cursorcosttracker.com |
| Quick Pick / sidebar | — | not the product |

Webview: `--vscode-*` tokens, CSP with nonce, `retainContextWhenHidden: true`.

## 5. Target `package.json` versions

```json
{
  "engines": { "vscode": "^1.85.0" },
  "activationEvents": ["onStartupFinished"],
  "main": "./dist/extension.js",
  "icon": "icon.png"
}
```

Marketplace / VSIX icon is repo-root `icon.png` (PNG, at least 128×128). Do not put Cursor’s cube or the VS Code logo in that file.

After Open VSX: if Cursor search hides the extension, lower `engines.vscode` to the version from Help → About.

## 6. Tests — what to cover

- `parse`: cents, pools, unlimited, input/output/cache tokens
- `dailyBudget` and `forecastWindow`: working days or calendar days; calendar month or a valid billing cycle
- `historySample`: Last N vs From–To, cap 10,000
- List price, cache $ saved, $ per 1k lines, conversation briefs, optimized targets, query groups
- `formatDollars` / `formatTokens`
- Status bar: unlimited, over, warn, N/A (mock service)

No `@vscode/test-electron` at the start. Manual: VSIX in Cursor vs numbers on the usage site.
