# v1.6 implementation plan — Project Cost Attribution

**English canonical.** Polish: [project-cost-attribution.pl.md](./project-cost-attribution.pl.md)  
**Parent:** [v1.2-overview.md](./v1.2-overview.md)  
**Status:** ready to implement  
**Depends on:** 1.5.0 preferred (sequential MINOR). Independent data path — does not import advisor / efficiency / runaway.  
**Next:** none in this epic (Team sync is later, not 1.7 in this folder until planned).  
**Version:** **1.6.0** (MINOR)

If this file and [prd.md](../../context/prd.md) disagree, **the PRD wins**.

Cursor `get-filtered-usage-events` has **no** project, repo, or branch. Attribution is a **local stamp** when a query fingerprint is **first seen** by this machine’s extension host.

---

## 1. Goal

Attribute new usage rows to the current workspace folder + git branch (when available). Show spend **by project** (and by branch) on Statistics, filter Last N without a 7th table column, and add project/branch to Export CSV.

**Done when:**

- First-seen fingerprints persist in `globalState`; historical rows stay **Unattributed**.
- Multi-window: the host that **first** sees a query wins (shared `globalState`).
- Statistics bars; Last N filter chips; CSV columns; Settings toggle.
- Cap map size; Vitest for merge/evict/unattributed; `typecheck` green.
- Copy states this is local inference, not Cursor billing metadata.

---

## 2. Out of scope

| Item | Why |
|------|-----|
| Backfill before 1.6 | Impossible without guesswork |
| Reading `.git` outside the workspace | Security / scope |
| Team / org dashboard sync | Later product |
| 7th Last N column PROJECT | Layout; use **filters** |
| Blocking modal / toast on stamp | Silent |
| Using the session cookie to call extra APIs | Not allowed |
| Remote-SSH “true” remote folder | `extensionKind: ui` — stamp is the **local** window’s workspace; document inaccuracy |

---

## 3. PRD deltas

New subsection **Project cost attribution:**

- On each successful usage snapshot, every `UsageQuery` fingerprint not already in `globalState` map `cursorCost.attribution` is stamped with:
  - `project`: workspace folder basename (`vscode.workspace.workspaceFolders[0]`; multi-root: folder containing the **active editor**, else first folder)
  - `branch`: Git API `HEAD` name when `vscode.git` is present; else `null`
  - `repo`: origin URL basename without `.git` when Git API exposes it; else `null`
- No workspace folders → **do not stamp** (leave missing → UI **Unattributed**).
- Map cap **20,000** entries; evict oldest `attributedAt` first.
- Statistics: by-project bars (cost, requests); optional by-branch when ≥ 2 branches exist in the sample.
- Last N: filter chips All / project names / Unattributed — **not** a new column.
- Export CSV: columns `project`, `branch` (empty if unknown).
- Toggle `cursorCost.projectAttribution` (default **true**). When off: do not write new stamps; existing map remains; UI hides filters/bars (CSV may still include stored stamps if export runs — **prefer omit columns when toggle off**).
- Disclaimer: `Inferred from the workspace that was open when the query first appeared in this app — not from Cursor’s invoice.`

---

## 4. Files

```
src/attribution/fingerprint.ts     # re-export queryFingerprint or thin wrapper
src/attribution/store.ts           # merge, cap, lookup (pure + Memento adapter)
src/attribution/workspaceStamp.ts  # vscode: folder + git (thin, tested via inject)
src/attribution/aggregate.ts       # by project / branch from queries + map
src/config.ts
src/ui/historyRows.ts              # row filter key; payload.attribution
src/ui/historyPanel.ts             # export CSV columns; set*
src/ui/periodStats.ts              # byProject / byBranch or attach on payload
src/extension.ts                   # after snapshot: stamp then panel refresh
src/usage/service.ts               # optional hook: on ready, call stamper (keep service free of vscode if possible — prefer extension.ts listener)
package.json                       # 1.6.0
media/history.html|css|js          # chips + Statistics bars + Settings
test/attributionStore.test.ts
test/attributionAggregate.test.ts
```

Keep `UsageService` free of `vscode` (today it already takes deps). Stamp in `extension.ts` or a small `AttributionController` subscribed to `onDidChange`, like critical alert.

Update PRD, architecture, snapshot, webview rule, `shared.mdc` (`src/attribution/`).

---

## 5. Types and algorithm

```typescript
export const ATTRIBUTION_STATE_KEY = 'cursorCost.attribution'
export const ATTRIBUTION_MAX_ENTRIES = 20_000
export const UNATTRIBUTED_LABEL = 'Unattributed'

export type AttributionStamp = {
  project: string
  branch: string | null
  repo: string | null
  attributedAt: number
}

export type AttributionMap = Record<string, AttributionStamp>

export type AttributionRow = {
  label: string
  costUsd: number
  tokens: number
  requests: number
  percent: number
}

export type AttributionPayload = {
  byProject: AttributionRow[]
  byBranch: AttributionRow[]
  unattributedCount: number
  unattributedCostUsd: number
  note: string
}
```

Fingerprint: **reuse** `queryFingerprint` from `src/spikes/criticalAlert.ts` (`timestamp|tokens|costUsd|model`). Same string for store and CSV identity.

### 5.1 Stamp (`buildStamp`)

Injected:

```typescript
type StampContext = {
  project: string | null
  branch: string | null
  repo: string | null
  nowMs: number
}
```

If `project === null` or `project.trim() === ''` → return `null` (do not write).

Else `{ project: trimmed basename, branch, repo, attributedAt: nowMs }`. Sanitize: take `basename` only (no full paths in `globalState` or webview). Origin: if URL `https://github.com/org/foo.git` → `foo`.

Git: `vscode.extensions.getExtension('vscode.git')?.exports.getAPI(1)`. Pick repository whose `rootUri` matches the chosen folder. `repo.state.HEAD?.name`. Missing extension → branch/repo null, still stamp project.

Multi-root: `window.activeTextEditor?.document.uri` → `workspace.getWorkspaceFolder`. Else `workspaceFolders[0]`.

Empty window (no folder): skip stamp.

### 5.2 Merge (`mergeAttribution`)

Pure:

```
mergeAttribution(map, fingerprints: string[], stamp: AttributionStamp | null, max = 20_000)
```

- If `stamp === null`, return map unchanged.
- For each fingerprint not in map, insert `stamp`.
- If `size > max`, delete entries with smallest `attributedAt` until `size <= max`. Never evict in the same pass keys just inserted if it would drop them below max before old ones — **evict oldest first including new only if everything is new** (FIFO by `attributedAt`).

First writer wins: if key exists, **do not overwrite** (other window already attributed).

### 5.3 Lookup

`stampFor(query, map): AttributionStamp | undefined`

Aggregate sample queries:

- `project` label = stamp.project or `Unattributed`
- `branch` label = stamp.branch or `Unattributed` (only include byBranch chart if ≥ 2 distinct non-empty branch names **or** 1 branch + unattributed — still useful; **show byBranch when ≥ 2 distinct labels** including Unattributed)

Sort bars by `costUsd` desc. Reuse `PeriodBreakdownRow` shape (`label`, `value` dollars, `share`, `percent`) for Statistics consistency.

### 5.4 Remote SSH / cloud

Document: session is local UI (`extensionKind: ui`). Stamp is whichever local folder was open. A query run on a remote may be attributed to the local project incorrectly. PRD + Settings hint.

---

## 6. Settings and messages

| Key | Type | Default |
|-----|------|---------|
| `cursorCost.projectAttribution` | boolean | `true` |

Settings fieldset **Project attribution** (after Insights / Advisor). Checkbox + hint about first-seen workspace and Unattributed history.

| `type` | Action |
|--------|--------|
| `setProjectAttribution` | boolean |

When turning **off**: stop writing; keep map (so turning on restores bars). Do not wipe `globalState` unless we add a later “Clear attribution” — **not in 1.6**.

Payload:

```typescript
projectAttribution: boolean
attribution: AttributionPayload | null  // null when setting off
```

`HistoryRow` adds `project: string` (label for filter; `Unattributed` when missing). **Do not** add a visible PROJECT column in the HTML table.

Optional toolbar chips: `All` + unique project labels in the current sample (cap **12** chips + `Unattributed` if present). Client filter like Over Warn at / Looping.

---

## 7. UI surfaces

### 7.1 Statistics

Cards **Spend by project** (always when toggle on) and **Spend by branch** (when ≥ 2 labels). Same bar component as by-model. Footer note = disclaimer.

### 7.2 Last N

Filter chips only. No 7th column. Export CSV (`cursorCost.exportCsv`): when toggle on, append `project,branch` (values escaped). When toggle off, keep previous CSV schema (no extra columns) so diffs stay stable.

### 7.3 Status bar / Optimize / toast

No change. Do not stamp from Optimize `project:` fence (that is savings, not usage).

### 7.4 Charts

No required change in 1.6.

---

## 8. Implementation steps

| Step | Work | Files |
|------|------|--------|
| 1 | Bump `1.6.0`. Key `projectAttribution`. | `package.json` |
| 2 | Config boolean. | `config.ts` |
| 3 | Pure merge / evict / aggregate tests. | `store.ts`, `aggregate.ts` + tests |
| 4 | `workspaceStamp` with injected git/folder (unit-test basename + origin parse without vscode). | `workspaceStamp.ts` + tests for URL basename |
| 5 | `AttributionController`: on snapshot ready, merge, `globalState.update`. | `src/ui/attributionController.ts` or `src/attribution/controller.ts`, `extension.ts` |
| 6 | Payload labels + Statistics bars. | `historyRows.ts`, `periodStats.ts` |
| 7 | Last N chips + CSV columns. | `media/history.js`, `historyPanel.ts` (export builder) |
| 8 | Settings fieldset. | `media/history.*` |
| 9 | PRD (incl. Remote SSH caveat), architecture, snapshot, webview + shared rules. | `.ai/context/*`, `.cursor/rules/*` |

Do not add Team sync, backfill UI, or a PROJECT column.

Find the current CSV builder (history panel / command) and extend it in the same PR — grep `exportCsv` / `text/csv`.

---

## 9. Tests

- Merge: existing key not overwritten when a second stamp differs.
- New keys inserted; missing stamp (`null`) leaves map unchanged.
- Evict: 20_001st oldest `attributedAt` dropped; newest kept.
- Aggregate: two projects split cost; unknown fingerprint → Unattributed count/cost.
- Origin parse: `git@github.com:Org/Foo.git` and `https://github.com/Org/Foo.git` → `Foo`.
- Basename: `/Users/a/work/my-app` → `my-app` (inject path helper; do not hit disk).
- Payload: `HistoryRow.project` is `Unattributed` without a map entry.
- Toggle off → `attribution` null in payload helper.

Mock `Memento` like IgnoreStore tests (when those exist) or in-memory map.

---

## 10. Security

- Store **basenames only**, never absolute paths, remotes with tokens, or emails.
- Webview gets labels already used as project names (same as Optimize fence `project`).
- Do not log the full attribution map.
- Git API read-only; no `git` child_process if `vscode.git` is missing (skip branch rather than spawning).

---

## 11. Done criteria

- [ ] Version **1.6.0**
- [ ] First-seen stamp; no overwrite; Unattributed for history
- [ ] Cap 20k; basename + optional branch/repo
- [ ] Statistics by-project (and by-branch when useful)
- [ ] Last N **filters**, not a 7th column; CSV when enabled
- [ ] Disclaimer + Remote SSH note in PRD
- [ ] `npm test` + `typecheck`
- [ ] No Team sync, no backfill, no extra modal
