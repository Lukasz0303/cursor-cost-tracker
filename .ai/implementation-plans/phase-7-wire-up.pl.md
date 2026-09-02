# Faza 7 — Sklejenie, paczka, weryfikacja

**Plan nadrzędny:** [mvp.pl.md](./mvp.pl.md) · kanon EN: [phase-7-wire-up.md](./phase-7-wire-up.md)  
**Status:** gotowy do realizacji  
**Zależy od:** faz [0](./phase-0-scaffold.pl.md)–[6](./phase-6-history-webview.pl.md)  
**Następna:** stop. v1.1 = [token-spike.pl.md](./token-spike.pl.md) **po** PRD §13  
**PRD:** G4, akceptacja §13  
**Komendy:** `9-security-token-audit`, `5-package-vsix`, `6-install-in-cursor`, `4-run-tests`

Przy rozjeździe wygrywa **angielski PRD**.

---

## 1. Cel

Połączyć config, `UsageService`, pasek i panel w `activate()`. Lokalny VSIX. Checklist §13 na zalogowanym Cursorze (Windows P0). Token sesji nigdy w logach ani webview.

**Gotowe gdy:** da się odhaczyć wszystkie punkty §13.

---

## 2. Poza zakresem (nie wrzucaj „przy okazji”)

| Element | Powód |
|---------|--------|
| Spike `!`, Ignore, `spikeTokenThreshold` | v1.1 |
| Publikacja Open VSX | v2 |
| Quick Pick, Activity Bar | nie MVP |
| Słowo „ignore” w mvp.md §13 | **to nie** Ignore ze spike’ów; bez `IgnoreStore` |

---

## 3. Pliki do zmiany

```
src/extension.ts
src/config.ts          # jeśli nie skończone w fazie 5
.vscodeignore
.ai/context/codebase-snapshot.md
```

---

## 4. Sekwencja `activate()`

Powrót od razu. **Bez `await`** na sesję, fetch, sql.js.

```
odczyt config
UsageService z prawdziwymi deps (session + api)
service.start()                    // loading + refresh w tle
StatusBarController.register(...)
registerCommand showHistory → HistoryPanel.show
registerCommand refresh → void service.refresh()
onDidChangeConfiguration('cursorCost') → poll + widoczność
subscriptions.push(service, statusBar, listener)
```

`deactivate` puste. `registerCommand` jest wymagane — sam `package.json` nie wystarczy.

Wasm: `path.join(__dirname, 'sql-wasm.wasm')`. Brak pliku → snapshot error, bez crasha.

---

## 5. Kolejność weryfikacji

Nie pakuj VSIX, jeśli testy albo audyt tokenu padną.

1. **`npm test`** (komenda `4-run-tests`)
2. **`9-security-token-audit`** — grep `src/`, `media/`, `dist/`  
   Dozwolone: literał `WorkosCursorSessionToken` **tylko** w `session.ts` przy budowie cookie. Zakazane: logi, webview, HTML.
3. **`5-package-vsix`:** `npm run build` + `vsce package --no-dependencies`  
   W paczce: `dist/extension.js`, wasm, `media/history.*`, `LICENSE`, `icon.png`. Nie commituj VSIX bez prośby.
4. **`6-install-in-cursor`** (Windows P0)
5. Checklist PRD **§13** (Current ≤ 10 s, Today znika przy padzie events, klik → tabela, reuse panelu, Refresh, sign-in message, brak tokenu w logach, restart bez błędu)
6. G3: porównaj liczby z cursor.com (± 0,01 $)
7. Zaktualizuj [codebase-snapshot.md](../context/codebase-snapshot.md) — koniec „pre-implementation”. Nie wpisuj v1.1 jako zrobionego.

---

## 6. Po MVP

Dopiero wtedy [token-spike.pl.md](./token-spike.pl.md) (B1–B5).
