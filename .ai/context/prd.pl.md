# Cursor Cost Tracker — wymagania produktu

**Produkt:** rozszerzenie VS Code / Cursor  
**Repo:** `cursor-cost-tracker` (samodzielne, MIT)  
**Wersja dokumentu:** 2.6  
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
… │  $(credit-card) 3.79 $ / 250.00 $  │  $(calendar) 3.79 $ / 11.19 $  │  0.03 $ - 64.8k  │  0.10 $ - 237.0k  │  ! 1.20 $ - 1.2M  │  ↻  │
```

**Plan firmowy:** Current to pula dolarowa (`used $ / limit $`). **Pro / Pro+:** Current to procenty włączonego limitu (`7%` albo `7% · 0%` dla Cursor Models · Other Models), jak na dashboardzie Cursora — nie cap on-demand w dolarach.

Kolejność: **Current**, **Today**, **3 najnowsze zapytania**, **Refresh**. Current+Today to jeden chip (priorytety daleko od Ln/Col ~100). Każde ostatnie zapytanie to **osobny** element, żeby czerwień była tylko przy spike — VS Code nie koloruje fragmentu jednego itemu. Każde zapytanie: `cost - compact tokens`. Prefiks `!` gdy `tokens >= cursorCost.spikeTokenThreshold` (domyślnie **1_000_000**) i `cursorCost.showSpikeWarning` jest włączone. Klik Current / Today / zapytanie otwiera Last 100. Refresh tylko odświeża.

| Element | Tekst | Tooltip | Klik |
|---------|--------|---------|------|
| Current | Firmowy: `$(credit-card) 3.79 $ / 250.00 $`. Pro: `$(credit-card) 7%` albo `7% · 0%` | email · plan · koniec cyklu · (Pro: nazwy limitów) | **otwórz Last 100** |
| Today | `$(calendar) 3.79 $ / 11.19 $` | jak wyliczony daily budget | **otwórz Last 100** |
| 3 ostatnie | `0.03 $ - 64.8k` albo `! 1.20 $ - 1.2M` | model · czas · tokeny · kind | **otwórz Last 100** |
| Refresh | `$(sync)` | Refresh | tylko odśwież, bez panelu |

Kolory: przy włączonych ostrzeżeniach dobry stan to `cursorCost.okColor` (domyślnie zieleń `#89D185` na ciemnym motywie, `#18794E` na jasnym). **Team:** przy/ponad miesięcznym lub dziennym capie dolarowym — `cursorCost.warnColor` (domyślnie czerwień `#F14C4C` na ciemnym, `#C50F1F` na jasnym). Własny hex zostaje bez zmian. **Pro / Pro+:** Current (procenty included) i Today (suma zapytań, często bez dziennego capu) zostają w kolorze dobrym — to nie jest overage puli dolarowej. Spike `!` przy ostatnim zapytaniu używa warnColor. Ładowanie/błąd — domyślny. Gdy `cursorCost.showSpikeWarning` jest wyłączone, nie ma `!` ani kolorów na belce. Warn at, kolory i przełącznik ostrzeżeń są w zakładce **Settings**.

Puste sloty ostatnich zapytań są ukryte. Ignore spike’ów (`globalState`) zostaje na później w v1.1.

### 5.2 Klik → Last 100

Główna ścieżka: **nie** Quick Pick. Od razu tabela.

**Kontener:** `WebviewPanel`, reuse ID, tytuł **Last 100 Cursor queries**.

| TIME | MODEL | COST | TOKENS | INPUT / OUTPUT | KIND |
|------|-------|------|--------|----------------|------|
| `1.09.2026, 10:05:12` | default | 0.03 $ | 64,755 | 12,856 / 168 | Included In Business |

Najnowsze na górze, font monospace, CSS `--vscode-*`. Paleta poleceń: `Cursor Cost: Show Usage History`.

Pasek: **Last N Cursor queries** (domyślnie 1000) | **Statistics** | **Charts** | **Settings**. Statistics to słownik Current/Today plus agregaty cyklu / Last N. Charts: tokeny i koszt w czasie plus karty Today / This month / All time z tej próbki. Settings: Warn at, Show last, Show warnings, kolory Good/Warning. Last N to próbka z API eventów — nie pula Current.

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

**Current:** `GET https://cursor.com/api/usage-summary`. Plan firmowy: pula dolarowa (individual onDemand → plan → team onDemand → overall). Odrzuć pulę z limitem powyżej **1 000 000 centów** (10 000 $) — to budżet org (`pooled` / reszta on-demand, np. 24 800 $), nie osobisty limit 250 $. Ten sam filtr co Stack Manager `isPersonalMonthlyPool`. Nigdy nie czytaj `teamUsage.pooled`. Pro: belki dashboardu `autoPercentUsed` (Cursor Models) i `apiPercentUsed` (Other Models) — nie `plan.used/limit`. Unlimited → ukryj Today.

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
| `cursorCost.spikeTokenThreshold` | 1000000 | min 1000; w Settings w jednostce **k** (100 = 100k tokenów); `!` przy tym zapytaniu |
| `cursorCost.showSpikeWarning` | true | wyłączone = bez `!` i bez zieleni/czerwieni |
| `cursorCost.historyLimit` | 1000 | min 100, max 10_000; Settings **Show last** |
| `cursorCost.okColor` | `#89D185` | kolor dobrego stanu (ciemniejszy `#18794E` na jasnym motywie) |
| `cursorCost.warnColor` | `#F14C4C` | kolor ostrzeżenia (ciemniejszy `#C50F1F` na jasnym motywie) |

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

Nieoficjalne API / `state.vscdb` → izolacja w `src/usage/`, stan N/A. Sesja: `node:sqlite` tylko do odczytu, gdy dostępny (bazy wielogigabajtowe); sql.js tylko dla małych plików. Remote SSH: `extensionKind: ui`. Rate limit: polling ≥ 5 min.

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
