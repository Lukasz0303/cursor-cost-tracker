# Faza 6 — Webview Last 100

**Plan nadrzędny:** [mvp.pl.md](./mvp.pl.md) · kanon EN: [phase-6-history-webview.md](./phase-6-history-webview.md)  
**Status:** gotowy do realizacji  
**Zależy od:** cache z fazy 4, formattery z fazy 1  
**Następna:** [phase-7-wire-up.pl.md](./phase-7-wire-up.pl.md)  
**PRD:** §5.2, A3, G2  
**Reguły webview:** `.cursor/rules/extension-webview.mdc`

Przy rozjeździe wygrywa **angielski PRD**.

---

## 1. Cel

Jeden `WebviewPanel` (reuse), tytuł **Last 100 Cursor queries**. Tabela: TIME, MODEL, COST, TOKENS, INPUT / OUTPUT, KIND. Najnowsze na górze. CSP z nonce. Payload: tylko eventy — bez tokenu, cookie, emaila.

**Gotowe gdy:** drugie otwarcie fokusuje ten sam panel; `postMessage` bez pól tokenu.

---

## 2. Poza zakresem

| Element | Kiedy |
|---------|--------|
| Kolumna `!`, przycisk Ignore | v1.1 |
| React / Vue | nigdy |
| `enableCommandUris` | nigdy |
| Quick Pick | nie dodawaj |
| Email w tabeli | nie w kolumnach MVP |

---

## 3. Pliki

```
src/ui/historyPanel.ts
media/history.html
media/history.css
media/history.js
```

`localResourceRoots`: folder `media`.

---

## 4. Host

- `viewType`: `cursorCost.history`
- `enableScripts: true`, `retainContextWhenHidden: true`, `enableCommandUris: false`
- Istniejący panel → `reveal`, nie drugi panel
- `onDidDispose` → wyczyść referencję

CSP: `default-src 'none'; style-src ${cspSource}; script-src 'nonce-…'`.

**Webview → host:** `{ type: 'ready' }` | `{ type: 'close' }`  
**Host → webview:** `{ type: 'data', events }` albo jeszcze lepiej DTO już sformatowane (`HistoryRow`: time, model, cost, tokens, inputOutput, kind).

Formatowanie **w hoście** (`formatDateTime`, `stripModelPrefix`, `formatDollars`, `formatTokens`, `formatKind`) — webview tylko rysuje stringi. Sortowanie newest first, cap 100.

Subskrypcja serwisu: po `ready` wyślij queries; przy error — ostatni cache albo pusta tabela + generyczny status.

---

## 5. HTML / CSS / JS

- Nagłówek + Close (`postMessage close`)
- Kolumny jak w PRD; puste: `No queries yet`
- CSS wyłącznie `--vscode-*`; tabela monospace; separatory wierszy
- `history.js`: `acquireVsCodeApi()`, na starcie `ready`, render `data`, Close
- Komórki przez `textContent` / `createElement` (bez `innerHTML` z modelem)

---

## 6. Testy

Unit: `toHistoryRows(queries)` — kolejność, cap 100, format. Payload bez klucza `cookie`.

---

## 7. Bezpieczeństwo (blokujące)

- [ ] CSP `default-src 'none'`
- [ ] nonce na skrypcie
- [ ] `enableCommandUris: false`
- [ ] brak `accessToken` / `WorkosCursorSessionToken` / cookie w payloadzie

---

## 8. Przekazanie do fazy 7

`HistoryPanel.show(context, service)` = ciało `cursorCost.showHistory`. Ten sam `UsageService` co pasek.
