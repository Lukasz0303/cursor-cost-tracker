# Phase 3c — Queries webview

**Parent:** [openai-codex.md](./openai-codex.md) §3 and §4
**Status:** ready to implement
**Depends on:** [phase-3b-host.md](./phase-3b-host.md)
**Next:** [phase-3d-stats.md](./phase-3d-stats.md)
**Polish:** [phase-3c-webview.pl.md](./phase-3c-webview.pl.md)
**Release:** 1.1.0. Do not bump `package.json`.

If this file and the parent plan disagree, **the parent plan wins**. If either disagrees with the PRD, **the PRD wins**.

One Agent message. Touch only the paths in §3. UI strings in this phase are English and Polish. Other catalogs are the next message after phase 3d.

---

## 1. Goal

The history panel shows a source switch and, for Codex, the coverage strip, toolbar, grouped table, lazy children, drawer, and Settings card. Cursor rows still paint from `data.events`.

**Done when:**

- The switch, strip, groups, lazy children, drawer, filters, empty states, CSV button, and two-step delete work against the host messages from phase 3b.
- OpenAI API shows the not-connected sentence and does not show Cursor totals.
- Support and Settings hide the switch.
- `npm run build` regenerates `media/history.js`. Do not hand-edit `media/history.js` or `media/history.css`.
- Cursor Last N still renders when `querySource` is `cursor`.

---

## 2. Out of scope

| Item | When |
|------|------|
| Statistics, Charts, Optimize bodies for Codex | phase 3d. The switch is visible on those tabs and posts `setQuerySource`, but those tabs keep their Cursor sections until 3d. |
| A live tariff | phase 4. Cost cells already show `—` or a stored label. |
| More locales than `en` and `pl` | next message |
| Hand-editing build outputs | never |

`media/src/tabs/settings.js` is in this phase even though the parent’s short file list omitted it. The Codex card cannot live in `queries.js`.

---

## 3. Files

```
media/history.html
media/src/messages.js
media/src/tabs/queries.js
media/src/tabs/settings.js
media/css/queries.css
src/i18n/catalogs/en.ts
src/i18n/catalogs/pl.ts
```

`queries.css` only for the switch, the strip, the sticky first column, and the drawer. Theme tokens only (`--vscode-*`). Ghost pills, not `--vscode-button-background`.

After the edits, run `npm run build` once.

---

## 4. Source switch

Under the tab bar, full width, on Last N, Statistics, Charts, and Optimize. Hidden on Support and Settings. Three ghost pills, `aria-pressed`.

```
Source   ( Cursor )  ( Codex local )  ( OpenAI API )
```

Tab label follows the source: `Last N Cursor queries`, `Codex queries`, or `OpenAI API`.

Click posts `{ type: 'setQuerySource', value }`. It does not post Cursor `refresh`. The toolbar Refresh posts `refresh` on Cursor, `codex.refresh` on Codex, `openai.refresh` on OpenAI API.

OpenAI body, and the empty state used if Statistics or Charts are still showing while that source is selected: `OpenAI API recorder is not connected. This extension does not see other programs’ calls to OpenAI.` Do not reuse Cursor totals as a placeholder.

---

## 5. Coverage strip

One monospace line under the switch. Text only. The heaviest state wins. Do not print `resolvedHome` on this line.

| State | Line |
|-------|------|
| Import off, sessions found | `Codex sessions found on this computer. Turn on import in Settings.` Dismissible for this webview session. |
| Import off, nothing found | hidden |
| Import on, root missing | `Codex home not found` |
| Import on, root empty | `No local Codex history found` |
| Partial parser coverage | `Partial history · N unrecognized lines` |
| No account id | `account unknown` inside the normal line. Not an error color. |
| Last rescan failed | `Sync failed · showing data from 18:02`. Keep the previous rows. |
| `remoteWindow` | prefix `This computer (not the SSH host) ·` |

Normal line: `Local history · this computer · account unknown · 12 sessions · 7 Oct – 14 Oct · last sync 18:12`.

Drop a `codex.result` whose `correlationId` or `filterRevision` is older than the latest posted query.

---

## 6. Toolbar and table

Toolbar controls from the parent §4.3: Over Warn at (client filter on `spike`), Optimized (disabled match — nothing matches until phase 7; do not treat cache hit as optimized), Group by conversation (posts `setCodexGroupByConversation`, does not write `groupQueriesByConversation`), Export CSV (`codex.exportCsv`), date presets Last 7 days / This month / All imported / Custom, account, model, status, sort.

Custom From/To are local `YYYY-MM-DD`, applied on Apply / Enter / blur. They do not read or write `cursorCost.historyFromDate`. Empty custom range means the whole import.

Codex table omits CONTEXT. Horizontal scroll, sticky first column, monospace numbers. Group chevron is a button with `aria-expanded`. Expanding posts `{ type: 'codex.expand', conversationId, accountScopeKey }`. Cursor expand stays index-based and does not post `codex.expand`.

Page size 100. Load more sends the `nextCursor`.

A request row click opens the drawer under the table. Assign with `textContent` only. Enter on the row opens the drawer. Escape closes it. Copy details copies the same plain-text fields.

Play in the TOKENS cell posts `codex.analyze` for that row. It does not post `optimizeConversation`.

---

## 7. Settings card

In `media/src/tabs/settings.js`, a **Codex** fieldset after Recent queries and before Refresh.

| Control | Message |
|---------|---------|
| Import local Codex sessions | `setCodexImportEnabled` |
| Codex home | `setCodexHome` on Apply / Enter / blur |
| Group Codex by thread | `setCodexGroupByConversation` |
| Query source | `setQuerySource` |

Read-only lines from `codex.status`: resolved directory (`resolvedHome`), this computer, session count, date span, last scan, parser version, unrecognized-line count.

Rescan button posts `codex.refresh`. Delete reads `Delete imported Codex data`. The first click changes the label to `Delete imported Codex data — confirm`. The second click posts `codex.forget` and restores the label. Any other click in the card restores the label. There is no `window.confirm` modal.

---

## 8. Catalogs

Add keys to `en.ts` and `pl.ts` only. Polish copy for the strings in §4–§7. Keep the English sentences in `en.ts` identical to the parent plan so tests and screenshots match.

---

## 9. Checks

`npm run build` once. `npm test` once if a message fixture test already imports catalogs; do not add a browser harness.

What this phase cannot verify here: pixel layout inside Cursor. The implementer checks the switch, a grouped expand, Escape on the drawer, and that a Cursor `data` message still fills the table when the source pill is Cursor.

---

## 10. Handoff

Phase 3d replaces the Statistics, Charts, and Optimize bodies when the source is Codex. The switch from this phase stays.
