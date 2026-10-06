# v1.1 implementation plan — Group queries by conversation

**English canonical.** Polish: [conversation-grouping-queries.pl.md](./conversation-grouping-queries.pl.md)
**Status:** phases 1–2 implemented (core + Vitest + UI wire). Phase 3 (docs / remaining locales) open.
**Depends on:** conversation id + local titles already landed (`src/usage/conversationId.ts`, `src/usage/conversationTitles.ts`, `src/usage/readConversationTitles.ts`, `src/usage/groupConversations.ts`); Last N rows already carry `conversationId` / `conversationTitle` (`src/ui/historyRows.ts`).
**Version:** **1.1.0** (MINOR — new user-facing feature)

If this file and [prd.md](../context/prd.md) disagree, **the PRD wins**.

---

## 1. Goal

On the **Last N Cursor queries** tab, let the user fold individual requests into **conversation rows labelled by the local chat title**, driven by one **toggle** in the queries toolbar.

- Toggle **off** (default): today's flat table. Nothing changes.
- Toggle **on**: one collapsed row per conversation (title, request count, totals). Clicking a group row expands the requests that belong to it, with the existing six columns.

**Done when:**

- Grouping key, labels, and aggregates live in pure modules covered by Vitest (no `vscode`, no DOM).
- `cursorCost.groupQueriesByConversation` (default **false**) persists the toggle; toolbar switch and Settings → Recent queries stay in sync.
- Grouped view honours **Over Warn at**, the spike `!`, and the per-row Optimize play button.
- Export CSV still exports flat request rows.
- No transcript text, prompt body, cookie, or token reaches the webview payload.
- `npm test` / `typecheck` green; 10,000-row samples stay responsive.

---

## 2. Grouping key (the one real decision)

The ask is “group by title”, but a title is **not** unique: two chats can be named the same, and a chat with no local index entry has no title at all. Key resolution, in order:

| Case | Key | Row label |
|------|-----|-----------|
| Request has an id **and** a local title | `title:` + normalized title (trim, collapse whitespace, lowercase) | the title as stored (first spelling wins) |
| Request has an id, **no** title | `id:` + conversation id | `#` + first 8 characters of the id |
| Request has **no** id | `ungrouped` | `Ungrouped` |

So two chats named `Fix login bug` **merge into one row**, which is what “group by title” means to the user. The group keeps the set of underlying ids (`ids: string[]`); that set decides whether the group can be optimized (see §6).

`conversationId` and the existing title lookup are reused as-is. Do **not** invent groups from time gaps.

---

## 3. Out of scope

| Item | Why |
|------|-----|
| Grouping on Statistics / Charts / Optimize | This slice is the queries table only |
| Reading chat transcripts or prompt text | PRD non-goal; titles come from the local index |
| Server-side / API grouping | Usage API has no conversation tree |
| Persisting which groups are expanded | Session-only webview state |
| Nested grouping (project → conversation → request) | Later, if asked |
| Seventh tab, React, new modal | Never |

---

## 4. Core modules (phase 1)

```
src/usage/groupConversations.ts   # add titleGroupKey + groupByTitle option
src/ui/queryGroups.ts             # new: group payload for the table
test/groupConversations.test.ts   # extend
test/queryGroups.test.ts          # new
```

### 4.1 `src/usage/groupConversations.ts`

Add, without touching `groupConversations` (the Optimize path keeps grouping by id):

```typescript
export type ConversationGroupKey = { key: string; label: string; named: boolean }

export function normalizeConversationTitle(title: string): string

export function titleGroupKey(
  conversationId: string,
  conversationTitle: string,
): ConversationGroupKey
```

Plain strings, so both `UsageQuery` and already-rendered rows can use it.

### 4.2 `src/ui/queryGroups.ts` (new)

```typescript
export type QueryGroupPayload = {
  key: string
  title: string
  named: boolean
  ids: string[]
  queryCount: number
  firstTimestamp: number
  lastTimestamp: number
  rangeLabel: string      // "14:02 → 15:47" same day, else "2 Oct → 3 Oct"
  costLabel: string
  tokensLabel: string
  inputOutputLabel: string
  modelsLabel: string     // one model, or "claude-4.5 +2"
  kindsLabel: string
  spike: boolean          // any child row over Warn at
  optimizable: boolean    // exactly one id and that id is not 'ungrouped'
  optimizeId: string | null
  optimizeTimestamp: number | null
  /** Indexes into the flat row array, newest first. Children are not duplicated. */
  rowIndexes: number[]
}

export function toQueryGroups(
  queries: readonly UsageQuery[],
  options?: QueryGroupOptions,
): QueryGroupPayload[]
```

Input is `historyRowSample(queries, limit)` — the same newest-first sample `toHistoryRows`
renders — so `rowIndexes` line up with `events` without a second sort.

Rules:

- Groups sorted by `lastTimestamp` **descending**; ties broken by key for stable renders.
- `rowIndexes` are newest-first so the webview can render children without re-sorting.
- Formatting reuses `src/format.ts` (`formatDollars`, token formatter) — no new number formatting.
- Pure function over the rows the table already has: no second pass over `UsageQuery`, no DB read.

Vitest covers: title collision merges two ids, untitled id falls back to `#ab12cd34`, missing id lands in `Ungrouped`, spike propagates to the parent, ordering is newest-first, empty input returns `[]`.

---

## 5. Wiring (phase 2 — separate turn)

```
package.json                  # contributes cursorCost.groupQueriesByConversation
src/config.ts                 # key + default false
src/ui/historyRows.ts         # payload.queryGroups + payload.groupQueriesByConversation
src/ui/historyPanel.ts        # setGroupQueriesByConversation handler
media/history.html|css|js     # toolbar switch, group rows, expand/collapse
src/i18n/catalogs/en.ts|pl.ts # labels (other locales next turn)
```

Host → webview adds `groupQueriesByConversation: boolean` and `queryGroups: QueryGroupPayload[]`.
Webview → host adds `{ type: 'setGroupQueriesByConversation', value }`.

`queryGroups` is always computed (cheap, one pass) so toggling does not require a refresh round-trip.

---

## 6. Webview behaviour

- **Switch** sits in the queries toolbar next to **Over Warn at**, same ghost/pill styling, label `Group by conversation`. It mirrors the Settings → Recent queries checkbox; both post the same message.
- **Group row** spans the table: chevron + title (+ `!` when any child is over Warn at), then request count, total cost, total tokens, input/output, model summary. Monospace body, newest first, same spike colouring rules (nothing red when Show warnings is off).
- **Expand** renders that group's children lazily into a `<tbody>` below the group row, with the normal six columns and normal row styling, indented one step. Collapse removes them. Expanded keys live in a `Set` in webview memory; a refresh keeps keys that still exist.
- **Over Warn at** filter in grouped mode: a group is shown when it has at least one spike child; expanding it shows only spike children, so the parent count label switches to `3 / 12`.
- **Optimize play button**: stays on child rows exactly as today. On the group row it appears only when `optimizable` is true (single id) and posts the same `{ type: 'optimizeConversation', id, timestamp }` with the group's newest timestamp. A merged-title group with two ids shows no play button — a brief for two chats would be wrong.
- **Export CSV** is unaffected: always the flat rows, grouped or not.
- **Empty / degraded**: no local titles (index missing, e.g. Remote SSH) → groups still form by id with `#abcd1234` labels and a one-line hint that titles come from local Cursor storage.

---

## 7. Performance

- One pass to build groups, one pass to render group rows; children rendered on expand only.
- At `historyLimit = 10000` the grouped view renders at most a few hundred rows — strictly cheaper than today's flat table.
- No extra `state.vscdb` read: titles are already fetched for `conversationTitle`.

---

## 8. PRD deltas (ship with phase 3)

- New setting `cursorCost.groupQueriesByConversation` (default **false**) in the Recent queries fieldset.
- Last N tab description gains the grouped mode, the key table from §2, and the Optimize-button rule from §6.
- Non-goal restated: grouping reads only ids and local titles, never message bodies.

Stories:

- C1: Toggle on → requests from one chat collapse into one titled row; totals match the sum of the children.
- C2: Two chats with the same name collapse into one row; that row has no play button.
- C3: Request with no conversation id lands in `Ungrouped` and never gets a brief.
- C4: Over Warn at + grouping shows only conversations with a red request.
- C5: Toggle survives reload (setting), expansion state does not.

---

## 9. Phases

| Phase | Scope | Paths |
|-------|-------|-------|
| 1 | Core + Vitest | `src/usage/groupConversations.ts`, `src/ui/queryGroups.ts`, `test/groupConversations.test.ts`, `test/queryGroups.test.ts` |
| 2 | Wire UI | `package.json`, `src/config.ts`, `src/ui/historyRows.ts`, `src/ui/historyPanel.ts`, `media/history.*`, `en`/`pl` catalogs |
| 3 | Docs / rules | PRD, README, CHANGELOG, architecture, codebase-snapshot, `.cursor/rules/extension-webview.mdc`; remaining locales |

One phase per Agent turn ([optimize-split-minor-features.mdc](../../.cursor/rules/optimize-split-minor-features.mdc)). VSIX / version bump is its own short message.

---

## 10. Acceptance checklist

- [ ] `titleGroupKey` + `toQueryGroups` pure and Vitest-covered (collision, untitled, ungrouped, spike, order)
- [ ] `cursorCost.groupQueriesByConversation` default false, toolbar switch and Settings in sync
- [ ] Group totals equal the sum of their children
- [ ] Over Warn at, spike `!`, warning-colour rules hold in grouped mode
- [ ] Play button only on single-id groups; child buttons unchanged
- [ ] Export CSV unchanged
- [ ] No prompt text / cookie / token in the payload
- [ ] `npm test` and typecheck green
