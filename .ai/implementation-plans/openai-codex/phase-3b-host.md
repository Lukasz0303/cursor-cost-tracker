# Phase 3b — Host wire

**Parent:** [openai-codex.md](./openai-codex.md)
**Status:** ready to implement
**Depends on:** [phase-2b-import.md](./phase-2b-import.md), [phase-3a-query.md](./phase-3a-query.md)
**Next:** [phase-3c-webview.md](./phase-3c-webview.md)
**Polish:** [phase-3b-host.pl.md](./phase-3b-host.pl.md)
**Release:** 1.1.0. Do not bump the version. `package.json` changes here are configuration keys only.

If this file and the parent plan disagree, **the parent plan wins**. If either disagrees with the PRD, **the PRD wins**.

One Agent message. Touch only the paths in §3.

---

## 1. Goal

Register the Codex history service beside `UsageService`. Start it only when import is enabled. `activate()` does not wait on import. Cursor publish stays on Cursor events.

**Done when:**

- With import off, activation does not read rollout contents (a test double or a guarded call).
- With import on, `void service.start()` is not awaited.
- `cursorCost.showHistory` from Current, Today, or a recent-query chip sets `cursorCost.querySource` back to `cursor` and the panel still receives the Cursor `data` payload.
- The history command with no chip uses the saved `querySource`.
- `codex.forget` deletes extension rows only, and only after the webview has posted it (the two-step click is phase 3c).
- Opening the panel on Codex does not call the Cursor usage API.
- No new blocking modal. Critical alert still watches Cursor queries only.

---

## 2. Out of scope

| Item | When |
|------|------|
| Source switch markup | phase 3c |
| Statistics / Optimize paste body | phase 3d fills the brief. This phase routes `codex.analyze` and does **not** call `composer.openComposer`. |
| Other locale catalogs | the message after 3d |
| VSIX | its own message |

---

## 3. Files

```
src/extension.ts
src/ui/historyPanel.ts
src/config.ts
package.json
```

Add configuration properties. Do not add a `contributes.commands` entry. `codex.exportCsv` and `codex.refresh` are webview messages, not command ids.

---

## 4. Settings (`package.json`, `src/config.ts`)

| Key | Type | Default |
|-----|------|---------|
| `cursorCost.codexImportEnabled` | boolean | `false` |
| `cursorCost.codexHome` | string | `""` |
| `cursorCost.codexGroupByConversation` | boolean | `true` |
| `cursorCost.querySource` | enum `cursor` \| `codex-local` \| `openai-api` | `cursor` |

`config.ts` reads them with the same clamp style as the existing keys. `codexHome` is returned as a string. Do not canonicalize it there; `resolveCodexRoot` does that.

`deviceId` is not a setting. On first need, write `cursorCost.codexDeviceId` in `globalState` (random UUID). Never overwrite it.

Lease adapter: `LeaseStore` over `globalState` key `cursorCost.codexImportLease`.

Store path: `context.globalStorageUri` + `openai-request-history.sqlite`.

`extensionKind` stays `ui`. The service resolves the root on the UI host. A Remote SSH window does not scan the SSH host. `codex.status.remoteWindow` is true when `vscode.env.remoteName` is set. The prefix copy is phase 3c.

---

## 5. Activation (`src/extension.ts`)

Beside the existing `UsageService`:

1. Construct `HistoryService` with import flag, root resolver, store, and lease.
2. If `codexImportEnabled` is true, call `void history.start()`. Do not `await` it.
3. On configuration change of the four keys, update the service. Turning import off calls `stop()` (no watcher, no content reads). Turning it on calls `void start()` again.
4. Dispose the service with the extension.

Cursor polling, status bar, burn rate, and critical alert keep their current constructors. Do not pass Codex rows into them.

---

## 6. Panel routing (`src/ui/historyPanel.ts`)

| Message | Behavior |
|---------|----------|
| `setQuerySource` | Persist the enum. Post `codex.status` when the value is not `cursor`. Do not call Cursor `refresh`. |
| `setCodexImportEnabled` / `setCodexHome` / `setCodexGroupByConversation` | `workspace.getConfiguration('cursorCost').update` at global target. |
| `codex.refresh` | `void history.refresh()`. |
| `codex.query` | Run phase 3a query. Post `codex.result`. On failure post `operation.error` with a fixed sentence and keep the previous result unsent (the webview already holds the last good page). |
| `codex.expand` | Children for that conversation and scope. Post `codex.children`. Cursor expand stays index-based and must not hit this branch. |
| `codex.details` | Post `codex.detail`. |
| `codex.exportCsv` | Build the CSV for every matching page, save through the same dialog path as Cursor CSV, post `codex.exportReady`. |
| `codex.forget` | Delete rows in the extension sqlite only. Do not touch `~/.codex` or `state.vscdb`. Then post a fresh `codex.status`. |
| `openai.refresh` | Post `codex.status`-shaped empty is wrong. Post a dedicated status the webview already understands: `{ type: 'operation.error', message }` is also wrong. Post `{ type: 'codex.status' }` only for Codex. For OpenAI, post `{ type: 'openai.status', state: 'not-connected' }` added in `messages.ts` **only if** phase 3a did not include it — add that one variant here in `src/webview/messages.ts` as the single extra path this phase needs, because the host cannot answer `openai.refresh` without it. |
| `codex.analyze` | Do not call `composer.openComposer`. Do not submit a chat. Phase 3d replaces the handler body with the billing brief paste. Until then, post `operation.error` with a fixed “not available yet” sentence so the button cannot open a composer by falling through to `optimizeConversation`. |
| `refresh` / `exportCsv` | Unchanged Cursor behavior. |

When the status bar opens the panel (`showHistory` from Current, Today, or a query chip), write `querySource` to `cursor` before reveal. The command palette history entry does not overwrite the saved source.

`codex.status.resolvedHome` may be sent for the Settings card. Do not put that string on `codex.result` rows.

---

## 7. Checks

No new Vitest file is required if `extension.ts` cannot be imported without `vscode`. Add `test/codexConfig.test.ts` **only** if `config.ts` is already tested without `vscode`; otherwise keep the reads next to the existing config tests and do not create a vscode integration test.

Manual note for the release turn, not this turn: activation with import off does not open `~/.codex/sessions/**`.

`npm test` and `typecheck` once at the end of this phase.

---

## 8. Security

`codex.forget` is the only delete. It refuses to run unless the message type is exactly `codex.forget` (the confirm step is UI state in phase 3c). Logs do not print the Codex root, the device id, or SQL.

---

## 9. Handoff

Phase 3c paints the switch, the strip, the table, and the Settings card from these messages. Cursor `data.events` stays the Cursor table source.
