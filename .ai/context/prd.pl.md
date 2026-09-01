# Cursor Cost Tracker — wymagania produktu

**Produkt:** rozszerzenie VS Code / Cursor  
**Repo:** `cursor-cost-tracker` (samodzielne, MIT)  
**Wersja dokumentu:** 2.3  
**Data:** 2026-09-01  
**Status:** decyzja produktowa (MVP)  
**Wersja angielska (kanoniczna dla implementacji):** [prd.md](./prd.md)

Przy rozjeździe z [prd.md](./prd.md) wygrywa wersja angielska.

---

## 1. Czym to jest

**Cursor Cost Tracker** to lekka wtyczka do **Cursora** (główny target) i **VS Code** (gdy obok jest zainstalowany Cursor). Pokazuje zużycie AI **w edytorze**, bez wchodzenia na cursor.com.

Dwie powierzchnie UI:

| Powierzchnia | Wzorzec | W IDE |
|--------------|---------|--------|
| Stały podgląd | Current, Today | **status bar** (belka na dole) |
| Szczegóły | „Last 100 Cursor queries” + Close | **panel webview** (zakładka edytora) |

Klik w belkę **od razu** otwiera ostatnie 100 zapytań. Bez pośredniego menu i bez przeglądarki.

---

## 2. Problem

Cursor rozlicza chat, agenta i edycje inline w USD i tokenach. Oficjalny usage jest na stronie konta albo w ograniczonym dashboardzie — nie na belce IDE podczas pracy.

1. Nie widać bieżącego i dziennego kosztu podczas kodowania.
2. Duże zapytanie agenta (setki tysięcy albo **miliony** tokenów) zaskakuje kosztem po fakcie.
3. Historia (czas, model, koszt, tokeny, input/output, kind) wymaga wyjścia z IDE.
4. Brak ostrzeżenia w edytorze przy skoku tokenów na jednym zapytaniu i brak Ignore / podglądu tego wiersza.

**Poza zakresem:** płatności Cursor, inne IDE, dashboard zespołu, szacowanie kosztu *przed* wysłaniem promptu, auto-naprawa / przepisywanie kodu, analiza konkretnego czatu/promptu, rada „co obciąć w tej konwersacji”.

---

## 3. Wizja

> Jak wskaźnik baterii, ale dla budżetu Cursor: zawsze na dole, jeden klik do pełnej historii.

Po instalacji (zalogowany Cursor) belka pokazuje Current i Today. Klik otwiera tabelę „Last 100 Cursor queries”.

---

## 4. Użytkownicy

| Persona | Priorytet | Potrzeba |
|---------|-----------|----------|
| Dev na Cursorze (Pro / Business / Team) | P0 | Current, Today, Last 100 |
| Power user agenta | P0 | szybki podgląd drogich zapytań |
| VS Code bez Cursora | P2 | „Zaloguj się w Cursorze”; ręczny token później |

**Platformy MVP:** Windows (P0), macOS i Linux (P0 ścieżki `state.vscdb`).  
**IDE MVP:** Cursor. VS Code tylko jeśli znajdzie lokalną bazę sesji Cursora.

---

## 5. Decyzja UI (obowiązująca)

### 5.1 Status bar

Prawa strona belki (`StatusBarAlignment.Right`).

```
… │  $(warning) 3.79 $ / 250.00 $  │  Today 3.79 $ / 11.19 $  │  ↻  │
```

`$(warning)` / `!` na belce, gdy **przynajmniej jedno nieignorowane** zapytanie z Last 100 ma `tokens >= cursorCost.spikeTokenThreshold` (domyślnie **1_000_000**). Tooltip: liczba spike’ów. Klik nadal otwiera Last 100 (wiersze spike podświetlone). Gdy wszystkie spike’y są **Ignore** albo znikną z Last 100, wykrzyknik znika.

| Element | Tekst | Tooltip | Klik |
|---------|--------|---------|------|
| Current | `$(credit-card) 3.79 $ / 250.00 $` albo `$(warning) 3.79 $ / 250.00 $` | email · plan · koniec cyklu · liczba spike | **otwórz Last 100** |
| Today | `$(calendar) 3.79 $ / 11.19 $` | jak wyliczony daily budget | **otwórz Last 100** |
| Refresh | `$(sync)` | Refresh | tylko odśwież, bez panelu |

Kolory: w limicie — domyślny / `charts.green`; ≥ 80% dnia lub ≥ 90% miesiąca — żółty; przekroczenie — czerwony; ładowanie — spinner; błąd — `N/A` + tooltip.

Na belce **nie** ma pigułek pojedynczych zapytań. Opcjonalnie w tooltipie Current (v1.1): 3 ostatnie zapytania.

### 5.2 Klik → Last 100

Główna ścieżka: **nie** Quick Pick. Od razu tabela.

**Kontener:** `WebviewPanel`, reuse ID, tytuł **Last 100 Cursor queries**.

| TIME | MODEL | COST | TOKENS | INPUT / OUTPUT | KIND |
|------|-------|------|--------|----------------|------|
| `1.09.2026, 10:05:12` | default | 0.03 $ | 64,755 | 12,856 / 168 | Included In Business |

Najnowsze na górze, font monospace, CSS `--vscode-*`. Paleta poleceń: `Cursor Cost: Show Usage History`.

**Spike tokenów (v1.1, obowiązkowe po MVP):** kolumna albo `!` na początku wiersza, gdy `tokens >=` próg użytkownika. Akcje w wierszu:

| Akcja | Efekt |
|-------|--------|
| **Ignore** | Fingerprint w `globalState`. Bang znika na wierszu i z belki, jeśli nie ma innych spike’ów. |

Bez **Advise**, auto-naprawy i rady „co obciąć w tej konwersacji”. Ignore przeżywa reload. Opcjonalnie: „Show ignored” w tabeli.

### 5.3 Poza MVP

Quick Pick jako domyślny klik, Activity Bar, blokujący modal, TreeView na 6 kolumn, React/Vue w webview, osobna aplikacja Electron, Advise / skan workspace / auto-naprawa LLM.

---

## 6. Cele MVP

| ID | Cel | Kryterium |
|----|-----|-----------|
| G1 | Koszty w IDE | status bar w ≤ 10 s po starcie (zalogowany user) |
| G2 | Jeden klik do historii | tabela Last 100 < 2 s (cache) |
| G3 | Spójne liczby | Current/Today zgodne z usage Cursor (± 0,01 $) |
| G4 | Zero konfiguracji | VSIX, bez `.env` |
| G5 | Nie blokuje pracy | brak modalów; błąd API = N/A |

---

## 7. User stories (MVP)

| ID | Jako… | chcę… | aby… |
|----|-------|-------|------|
| A1 | programista | widzieć Current na belce | znać zużycie cyklu |
| A2 | programista | widzieć Today na belce | pilnować dziennego budżetu |
| A3 | programista | kliknąć belkę | zobaczyć Last 100 |
| A4 | programista | kolor ostrzegawczy | zauważyć przekroczenie |
| A5 | programista | Refresh | zsynchronizować po długim agencie |
| A6 | programista | czytelny błąd bez tokenu | wiedzieć, że trzeba się zalogować |
| A7 | programista | tooltip z planem i datą cyklu | mieć kontekst bez tabeli |

v1.1: wykrzyknik przy spike (§5.1–5.2), Ignore, próg w ustawieniach; alerty 80%/90% wydatków; Copy stats.  
v1.2: sidebar; opcjonalny Quick Pick.

### 7b. User stories (v1.1 — spike tokenów)

| ID | Jako… | chcę… | aby… |
|----|-------|-------|------|
| B1 | programista | `!` na belce, gdy zapytanie przekroczy mój limit tokenów | zauważyć spike bez otwierania tabeli |
| B2 | programista | ten sam `!` przy wierszu w Last 100 | wiedzieć, które zapytanie eksplodowało |
| B3 | programista | ustawić limit (domyślnie 1 000 000 tokenów) | 1M nie było sztywne dla wszystkich |
| B4 | programista | **Ignore** na tym wierszu | wykrzyknik zniknął, jeśli akceptuję koszt |
| B5 | programista | żeby Ignore przeżyło reload | nie być nękanym ponownie |

---

## 8. Dane

**Sesja:** `cursorAuth/accessToken` z SQLite `state.vscdb` → cookie `WorkosCursorSessionToken={sub}::{token}`.

| OS | Ścieżka |
|----|---------|
| Windows | `%APPDATA%\Cursor\User\globalStorage\state.vscdb` |
| macOS | `~/Library/Application Support/Cursor/User/globalStorage/state.vscdb` |
| Linux | `~/.config/Cursor/User/globalStorage/state.vscdb` |

**Current:** `GET https://cursor.com/api/usage-summary` — pula individual onDemand → plan → team → overall. Unlimited → ukryj Today.

**Today:** `POST …/dashboard/get-filtered-usage-events` — `dailyBudget = remaining / dni robocze do końca`; `todayUsed` = suma dzisiejszych centów (lokalna strefa czasowa).

**Last 100:** ta sama API eventów, `pageSize=100`.

**Fingerprint spike (v1.1):** id z API jeśli jest, inaczej `${timestamp}|${tokens}|${costUsd}|${model}`. Zignorowane id w `context.globalState` pod `cursorCost.ignoredSpikes`.

**Odświeżanie:** `activate` nie może blokować UI; polling co 5 minut (1–60); ręczny Refresh; `AbortController`.

**Bezpieczeństwo:** token tylko w extension host; webview dostaje wyłącznie eventy; nigdy nie logować tokenu; brak telemetrii w MVP.

---

## 9. Technologia

VS Code Extension API. TypeScript + esbuild + StatusBarItem + vanilla webview + `fetch` + sql.js + Vitest + vsce.

Szczegóły: [tech-stack.md](./tech-stack.md).

Docelowy układ:

```
src/extension.ts
src/usage/{session,api,parse,service}.ts
src/ui/{statusBar,historyPanel}.ts
src/spikes/{threshold,ignoreStore}.ts   # v1.1
src/format.ts
media/history.{html,css,js}
```

---

## 10. Komendy i ustawienia

| Command ID | Tytuł | Faza |
|------------|--------|------|
| `cursorCost.showHistory` | Show Usage History (Last 100) | MVP |
| `cursorCost.refresh` | Refresh | MVP |

| Klucz | Domyślnie | Uwagi |
|-------|-----------|--------|
| `cursorCost.pollIntervalMinutes` | 5 | MVP |
| `cursorCost.showStatusBar` | true | MVP |
| `cursorCost.showToday` | true | MVP |
| `cursorCost.spikeTokenThreshold` | 1000000 | v1.1; min 100000 |
| `cursorCost.showSpikeWarning` | true | v1.1 |

Aktywacja: `onStartupFinished`.

---

## 11. Fazy

| Faza | Zakres |
|------|--------|
| **MVP** | sesja + API, status bar, webview Last 100, polling, błędy |
| **v1.1** | `!` przy spike (domyślnie 1M tokenów, ustawienie), Ignore + persist, alerty 80/90% wydatków, Copy stats |
| **v1.2** | sidebar, opcjonalny Quick Pick |
| **v2** | Secret Storage, CSV, Open VSX |

---

## 12. Ryzyka

Nieoficjalne API / `state.vscdb` → izolacja w `src/usage/`, stan N/A. Windows: kopia pliku SQLite do pamięci (sql.js). Remote SSH: `extensionKind: ui`. Rate limit: polling ≥ 5 min.

---

## 13. Kryteria akceptacji MVP

- [ ] VSIX w Cursorze (Windows): Current w ≤ 10 s przy zalogowanym koncie
- [ ] Today ukryte przy błędzie events; Current nadal widoczne
- [ ] Klik Current/Today → panel Last 100 z kolumnami z §5.2
- [ ] Close / X zamyka; ponowny klik reużywa panel
- [ ] Refresh aktualizuje belkę i tabelę
- [ ] Brak tokenu → komunikat, brak crasha
- [ ] Token nigdy w webview ani w logach
- [ ] Restart Cursora: activate bez błędów

### 13b. Akceptacja v1.1 (po MVP)

- [ ] Zapytanie z `tokens >=` ustawienia ma `!` w wierszu i na belce
- [ ] Domyślny próg 1 000 000; zmiana ustawienia działa bez reinstalki
- [ ] **Ignore** chowa bang wiersza i na belce, jeśli nie ma innych spike’ów
- [ ] Ignore przeżywa reload okna
- [ ] Zapytania poniżej progu nigdy nie mają `!`

---

## 14. Otwarte

UI marketplace po angielsku. Brak skrótu ostatniego zapytania na belce w MVP. Najpierw lokalny VSIX.

---

## 15. Podsumowanie

Wtyczka Cursor/VS Code. Belka: Current + Today + sync + **`!` przy spike**. Klik: Last 100; wiersze spike można **Ignore**. Bez Advise / auto-naprawy. Stack: TypeScript, esbuild, sql.js, Vitest. Logika usage w `src/usage/`.
