# Faza 5 — Status bar

**Plan nadrzędny:** [mvp.pl.md](./mvp.pl.md) · kanon EN: [phase-5-status-bar.md](./phase-5-status-bar.md)  
**Status:** gotowy do realizacji  
**Zależy od:** [phase-4-usage-service.pl.md](./phase-4-usage-service.pl.md), `formatDollars`  
**Następna:** [phase-6-history-webview.pl.md](./phase-6-history-webview.pl.md)  
**PRD:** §5.1, A1 A2 A4 A5 A7

Przy rozjeździe wygrywa **angielski PRD**.

---

## 1. Cel

Trzy itemy po prawej: **Current**, **Today**, **Refresh**. Klik Current/Today otwiera Last 100. Refresh tylko synchronizuje. Kolory i tooltipy z PRD. Szanuj `showStatusBar` / `showToday`.

**Gotowe gdy:** czyste testy renderu: loading, error, unlimited, over, warn, ukrycie Today.

---

## 2. Poza zakresem

| Element | Kiedy |
|---------|--------|
| Webview | faza 6 |
| `!` przy 1M tokenów | v1.1 — `$(warning)` w MVP **tylko** przy błędzie `N/A` |
| Powiadomienia 80%/90% | v1.1 (kolory na pasku **są** MVP) |
| Ciało handlerów komend | faza 7 (ustaw `command` już teraz) |
| Quick Pick | nigdy jako domyślny klik |

---

## 3. Pliki

```
src/config.ts
src/ui/statusBar.ts
src/ui/statusBarView.ts    # opcjonalnie: czysty view model
test/statusBar.test.ts
```

Czyste `toStatusBarView(snapshot, config)` — Vitest bez prawdziwego `StatusBarItem`.

---

## 4. Config (`src/config.ts`)

`workspace.getConfiguration('cursorCost')` → `pollIntervalMinutes` (clamp 1–60), `showStatusBar`, `showToday`. Bez kluczy spike.

---

## 5. Itemy

`StatusBarAlignment.Right`, priorytety **100 / 99 / 98**.

| Item | `command` | Widoczny gdy |
|------|-----------|----------------|
| Current | `cursorCost.showHistory` | `showStatusBar` |
| Today | `cursorCost.showHistory` | `showStatusBar` && `showToday` && nie unlimited && `todayUsedUsd !== null` |
| Refresh | `cursorCost.refresh` | `showStatusBar` |

`showStatusBar === false` → ukryj wszystkie. `accessibilityInformation` na każdym.

---

## 6. Render

### Loading

Current: `$(loading~spin) …`. Today: ukryj. Tooltip: `Loading usage…`

### Error

Current: `$(warning) N/A`. Today: ukryj. Tooltip = `snapshot.message`.

### Unlimited

Current: `$(credit-card) Unlimited`. Today: **ukryj**. Tooltip: `email · plan · cycle ends {date}` (pomiń nulle).

### Metered

Current: `$(credit-card) {used} / {limit}`  
Today: `$(calendar) {today} / {budget}`

### Kolory (A4)

`charts.red` / yellow / `charts.green` (lub default).

| Powierzchnia | Żółty | Czerwony |
|--------------|-------|----------|
| Current | used ≥ **90%** limitu | used **> 100%** |
| Today | today ≥ **80%** budżetu | today **> 100%** |

Brak limitu/budżetu → bez ratio. Unlimited → default.

### Tooltipy (angielski)

Current (A7): `email · plan · cycle ends {date}`  
Today: krótko, np. `Today vs remaining cycle ÷ working days left ({n} days).`  
Refresh: `Refresh`

---

## 7. Kontroler

`StatusBarController.register(context, service)` — subskrypcja `onDidChange` i `onDidChangeConfiguration`.

---

## 8. Testy

Tabela przypadków jak w kanonie EN: spinner, N/A, Unlimited, today null, flagi config, 91% żółty, 101% czerwony, 80% dnia żółty.

---

## 9. Bezpieczeństwo

Tooltip **może** mieć email (A7). Nadal bez cookie / tokenu / `sub`.

---

## 10. Przekazanie do fazy 6

Klik już wskazuje `cursorCost.showHistory`. Faza 6 robi panel; faza 7 wiąże komendę. Pasek nie tworzy webview.
