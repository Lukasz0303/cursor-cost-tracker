# Cursor Cost Tracker — wymagania produktu

**Produkt:** rozszerzenie VS Code / Cursor  
**Repo:** `cursor-cost-tracker` (samodzielne, MIT)  
**Wersja dokumentu:** 2.20  
**Data:** 2026-10-05  
**Status:** decyzja produktowa do **1.0.6**  
**Wersja angielska (kanoniczna dla implementacji):** [prd.md](./prd.md)

Przy rozjeździe z [prd.md](./prd.md) wygrywa wersja angielska.

---

## 1. Czym to jest

**Cursor Cost Tracker** to lekka wtyczka do **Cursora** (główny target) i **VS Code** (gdy obok jest zainstalowany Cursor). Pokazuje zużycie AI **w edytorze**, bez wchodzenia na cursor.com.

Dwie powierzchnie UI:

| Powierzchnia | Wzorzec | W IDE |
|--------------|---------|--------|
| Stały podgląd | Current, Today | **status bar** (belka na dole) |
| Szczegóły | Last N zapytań (domyślnie 1000) + Close | **panel webview** (zakładka edytora) |

Klik **Current** albo **Today** otwiera panel historii na **Statistics**. Chip ostatniego zapytania otwiera **listę zapytań**. Bez pośredniego menu i bez przeglądarki.

---

## 2. Problem

Cursor rozlicza chat, agenta i edycje inline w USD i tokenach. Oficjalny usage jest na stronie konta albo w ograniczonym dashboardzie — nie na belce IDE podczas pracy.

1. Nie widać bieżącego i dziennego kosztu podczas kodowania.
2. Duże zapytanie agenta (setki tysięcy albo **miliony** tokenów) zaskakuje kosztem po fakcie.
3. Historia (czas, model, koszt, tokeny, input/output, kind) wymaga wyjścia z IDE.
4. Brak ostrzeżenia w edytorze przy skoku tokenów na jednym zapytaniu i brak Ignore / podglądu tego wiersza.

**Poza zakresem:** płatności Cursor, inne IDE, dashboard zespołu, szacowanie kosztu *przed* wysłaniem promptu, auto-naprawa / przepisywanie kodu, czytanie treści czatu. **Dozwolone (Optimize i Play):** gotowe prompty wyłącznie z metadanych usage (model, tokeny, koszt, lokalny tytuł), które użytkownik otwiera w Composerze.

---

## 3. Wizja

> Jak wskaźnik baterii, ale dla budżetu Cursor: zawsze na dole, jeden klik do pełnej historii.

Po instalacji (zalogowany Cursor) belka pokazuje Current i Today. Klik Current albo Today otwiera Statistics; chip zapytania otwiera tabelę Last N.

---

## 4. Użytkownicy

| Persona | Priorytet | Potrzeba |
|---------|-----------|----------|
| Dev na Cursorze (Pro / Business / Team) | P0 | Current, Today, Last N |
| Power user agenta | P0 | szybki podgląd drogich zapytań |
| VS Code bez Cursora | P2 | „Zaloguj się w Cursorze”; ręczny token później |

**Platformy MVP:** Windows (P0), macOS i Linux (P0 ścieżki `state.vscdb`).  
**IDE MVP:** Cursor. VS Code tylko jeśli znajdzie lokalną bazę sesji Cursora.

---

## 5. Decyzja UI (obowiązująca)

### 5.1 Status bar

Prawa strona belki (`StatusBarAlignment.Right`).

```
… │  $(credit-card) 3.79 $ / 250.00 $  │  $(calendar) 3.79 $ / 11.19 $  │  ↻  │  0.03 $ - 64.8k  │  0.10 $ - 237.0k  │  ! 1.20 $ - 1.2M  │
```

**Plan firmowy:** Current to pula dolarowa (`used $ / limit $`). **Pro / Pro+:** Current to **średnia** procentów included vs 100% (`32% / 100%` przy 33% i 31%). Today to **średnia** dzisiejszego % vs dzienny pace, z sumą `$` w nawiasie (`3.5% / 4.5% (17.12 $)`).

Kolejność: **Current**, **Today**, **Refresh**, potem najnowsze zapytania. `cursorCost.recentQueryCount` określa liczbę chipów zapytań (**1–10**, domyślnie **3**). Current+Today to jeden chip (priorytety daleko od Ln/Col ~100). Refresh siedzi zaraz za tym chipem, żeby nie znikał gdy belka się przepełnia. Każde ostatnie zapytanie to **osobny** element, żeby czerwień była tylko przy spike — VS Code nie koloruje fragmentu jednego itemu. Każde zapytanie: `cost - compact tokens`. Prefiks `!` gdy `tokens >= cursorCost.spikeTokenThreshold` (domyślnie **1_000_000**) i `cursorCost.showSpikeWarning` jest włączone. Klik Current / Today otwiera Last N na zakładce **Statistics**. Chip zapytania otwiera **listę zapytań**. Refresh pobiera dane z cursor.com na żądanie. Export CSV jest na pasku Last N, nie na belce.

| Element | Tekst | Tooltip | Klik |
|---------|--------|---------|------|
| Current | Firmowy: `$(credit-card) 3.79 $ / 250.00 $`. Pro: `$(credit-card) 32% / 100%` (średnia included) | Karta hover: plan, miarki included/on-demand, reset, top modele, Open Dashboard / Refresh | **otwórz Statistics** |
| Today | Firmowy: `$(calendar) 3.79 $ / 11.19 $`. Pro: `$(calendar) 3.5% / 4.5% (17.12 $)` (średnia dziś / pace, suma $) | ten sam hover co Current (jeden chip) | **otwórz Statistics** |
| Refresh | `$(sync)` / `$(sync~spin)` | Refresh usage from cursor.com | tylko odśwież, bez panelu |
| 1–10 ostatnich (domyślnie 3) | `0.03 $ - 64.8k` albo `! 1.20 $ - 1.2M` | model · czas · tokeny · kind | **otwórz listę zapytań** |

Kolory: przy włączonych ostrzeżeniach dobry stan to `cursorCost.okColor` (domyślnie zieleń `#89D185` na ciemnym motywie, `#18794E` na jasnym). **Team:** przy/ponad miesięcznym lub dziennym capie dolarowym — `cursorCost.warnColor` (domyślnie czerwień `#F14C4C` na ciemnym, `#C50F1F` na jasnym). Własny hex zostaje bez zmian. **Pro / Pro+:** Current (procenty included) i Today (suma zapytań, często bez dziennego capu) zostają w kolorze dobrym — to nie jest overage puli dolarowej. Spike `!` przy ostatnim zapytaniu używa warnColor. Ładowanie/błąd — domyślny. Gdy `cursorCost.showSpikeWarning` jest wyłączone, nie ma `!` ani kolorów na belce. Warn at, kolory i przełącznik ostrzeżeń są w zakładce **Settings**.

Puste sloty ostatnich zapytań są ukryte. Store Ignore spike’ów (`cursorCost.ignoredSpikes`) jest; przycisk w tabeli + przeliczenie bangu zostają na później w v1.1.

### 5.2 Klik → panel historii

Główna ścieżka: **nie** Quick Pick. Od razu panel. Current / Today lądują na **Statistics**. Chip zapytania ląduje na **liście zapytań**.

**Kontener:** `WebviewPanel`, reuse ID. Tytuł idzie za próbką (Last N albo zakres From–To).

| TIME | MODEL | COST | TOKENS | INPUT / OUTPUT | KIND |
|------|-------|------|--------|----------------|------|
| `1.09.2026, 10:05:12` | default | 0.03 $ | 64,755 | 12,856 / 168 | Included In Business |

Najnowsze na górze, font monospace, CSS `--vscode-*`. Paleta poleceń: `Cursor Cost: Show Usage History`.

Pasek: **Last N Cursor queries** (domyślnie 1000) | **Statistics** | **Charts** | **Optimize** | **Support** | **Settings**. Na zakładce zapytań: **Over Warn at** (przełącznik — tylko zapytania ≥ próg ostrzeżenia), **Optimized**, **Group by conversation** (domyślnie wyłączone), **Refresh** (pobierz z cursor.com) i **Export CSV** (zawsze płaska lista requestów). Show last / From date / To date oraz ten sam przełącznik grupowania zostają w Settings. Statistics to słownik Current/Today, miarka **Month to date** (zużycie w tym miesiącu vs dni robocze dotąd × dzienny budżet, albo vs prognoza z tempa dni roboczych gdy nie ma dziennego limitu) z wykresem zużycia i prognozy — na Pro para linii dla każdej included quota na osi 0–100% i miarka dzisiejszego zużycia vs dzienny budżet — plus agregaty cyklu / Last N. Charts: tokeny i koszt w czasie jako skumulowane słupki + linia na jednej skali. Klik słupka pokazuje sumy tego dnia i zapytania już w próbce. **Sample / Last 7 / Month** przybliża tę serię bez kolejnego pobrania. Ta sama kontrolka **Monthly cost forecast** co na Statistics (miarki, zakres, used/forecast/ideal), potem karty Today / This month / All time z tej próbki. **Optimize:** trzy kolorowe zwijane karty głębokości (Quick / Balanced / Deep) z własnym Run i podglądem; badge Default wg `cursorCost.optimizeDepth` (domyślnie Balanced). Toolbar **Run Optimize** i Run na karcie wklejają tę głębokość do **nowego** czatu Agent. Findings skupione na ostatnim drogim / czerwonym zapytaniu. Projekcja pokazuje `0 / 0.00 $` do zapisu `.ai/optimize-savings.md` (`cct-savings` z `project`, mid tokenów/USD, `run`); każdy prompt wymaga końcowego raportu tokeny/USD/projekt. Jedna zwinięta karta to **prognozowany koszt zaoszczędzony na podobnym requeście**; rozwinięcie: wyjaśnienie plus zaksięgowane sumy per projekt z `globalState`. To nie jest audyt całego workspace. Rozszerzenie nie czyta treści czatu. **Support:** Buy Me a Coffee (URL w `src/supportLinks.ts`). Tiery GitHub Sponsors zostają w kodzie, ale są ukryte, dopóki nie ustawi się URL sponsora. Settings trzyma każdy klucz `cursorCost.*`, w tym Warn at, **Group by conversation**, Show last, **From date**, **To date**, okno prognozy, Show warnings, Optimize depth i kolory Good/Warning. Last N to próbka z API eventów — nie pula Current.

**Spike tokenów (v1.1, obowiązkowe po MVP):** kolumna albo `!` na początku wiersza, gdy `tokens >=` próg użytkownika. Akcje w wierszu:

| Akcja | Efekt |
|-------|--------|
| **Ignore** | Fingerprint w `globalState`. Bang znika na wierszu i z belki, jeśli nie ma innych spike’ów. |

Bez **Advise**, auto-naprawy i rady „co obciąć w tej konwersacji”. Store Ignore jest; przycisk w tabeli + zniknięcie bangu po reloadzie — leftover. Opcjonalnie: „Show ignored” w tabeli.

**Krytyczny alert ostatniego zapytania:** gdy **najnowsze** zapytanie osiągnie `cursorCost.criticalTokenThreshold` (domyślnie **10 000 000** tokenów) **lub** `cursorCost.criticalCostUsdThreshold` (domyślnie **5 $**), host pokazuje blokujący dialog. Niezależnie od `!` na belce (`showSpikeWarning`). Każdy fingerprint najnowszego zapytania raz (`globalState` `cursorCost.lastCriticalSeenKey`). Historyczne ostatnie zapytanie starsze niż pięć minut jest zapamiętane przy pierwszym załadowaniu — bez modala — żeby restart nie blokował pracy. Świeżo skończone zapytanie nadal alertuje. **Open History** otwiera Last N. Przełącznik: `showCriticalAlert`.

**Burn Rate Guard (1.0.4):** suma billed `costUsd` w żywym oknie kończącym się **teraz** (domyślnie **10 minut**). Statistics zawsze pokazuje **Current burn rate**, gdy funkcja jest włączona (`3.42 $ / 10 min`, opcjonalnie `×` względem własnego tempa, Today). ≥ **2 $** (domyślnie) — **niemodalny** toast ostrzegawczy; ≥ **5 $** — **niemodalny** toast błędu. Raz na epizod, eskalacja warning→critical raz, Snooze 30 min, grace 5 min przy pierwszym załadowaniu. **Nie zatrzymuje** Cursora. Opcjonalnie **Focus Composer** na toście krytycznym. `minQueries` domyślnie **2**, żeby pojedyncze drogie zapytanie zostawało przy alercie ostatniego zapytania. Zdarzenia Pro included przy 0 $ nadal pokazują przepustowość tokenów na karcie. Chip Today używa warnColor, gdy okno jest warning/critical i Show warnings jest włączone. Wiersze Last N w oknie dostają styl ostrzeżenia (bez 7. kolumny). Przełącznik: `cursorCost.burnRateGuard`.

**Generated Lines Insight / Coding stats (1.0.4, stawki $ w 1.0.6):** dla **aktywnego workspace** karta **Coding stats** w tym samym oknie próbki co tabela zapytań: **landed / AI = %** (Twoje insercje git na `main`/`master` ÷ linie AI composera w tym repo), to samo **jeśli ten branch wylądował** (`(landed + this branch) / AI`), oraz **All on Cursor** (dashboard Lines Edited, podział pod **Projects** wg lokalnego mixu composera). Gdy okno ma i koszt, i linie, karta pokazuje też wydatek okna **na 1k landed** i **na 1k linii AI**. Charts używa tych samych wzorów. Nie `AI − pending`; bez blame linii. Przełącznik: `cursorCost.codeLinesInsight` (domyślnie **true**).

**Cennik modeli (1.0.5):** Statistics pokazuje publiczną tabelę cen Cursora (`https://cursor.com/docs/models-and-pricing.md`, cache sześć godzin, bez ciasteczka sesji): input / output / cache, Active / Hidden, liczby requestów z próbki i wynik CursorBench. Toolbar **Model pricing** woła `cursorCost.openPricing`.

**Wiadomość do autora (1.0.5):** Support → Write a message wysyła Comment / New feature / Bug report / Other przez FormSubmit. Aplikacja poczty zostaje zamknięta. Token sesji nie wchodzi do POST. Buy Me a Coffee zostaje na zakładce. GitHub Sponsors jest ukryty, dopóki nie ma URL.

**Okno próbki (1.0.6):** `historySample` to jeden resolver dla tabeli, próbki Statistics, słupków Charts, Coding stats i CSV. Last N **albo** zakres From–To (cap 10 000). Puste `cursorCost.historyToDate` znaczy do dziś. Nie zmienia Current, Today, Burn Rate Guard, alertu krytycznego ani serii prognozy.

**Play na czerwonym zapytaniu (1.0.6):** czerwona komórka TOKENS ma Play. Host wkleja brief samych liczb tej konwersacji do **nowego** czatu Agent i nie wciska Start. Brak id konwersacji → brief to to jedno zapytanie. Grupowanie używa tylko id z eventu (bez zgadywania po przerwie w czasie). Rozszerzenie nie czyta treści promptu ani kodu. Wiersze po Play albo Run Optimize trafiają do `globalState` `cursorCost.optimizedTargets`. Filtr **Optimized** na pasku zapytań pokazuje te wiersze.

**Cena katalogowa (1.0.6):** rozwinięcie wiersza pokazuje dolary katalogowe input / output / cache-write / cache-read obok kosztu zafakturowanego. To tabela cen, nie faktura. Próbka Statistics pokazuje też, ile cache-read zaoszczędził względem ceny input.

**Grupowanie rozmów (1.0.6):** `cursorCost.groupQueriesByConversation` domyślnie **false**. Przełącznik na pasku zapytań i Settings → Recent queries są zsynchronizowane. Włączone: jeden zwinięty wiersz na lokalny tytuł czatu (liczba requestów i sumy); rozwinięcie pokazuje te same sześć kolumn. Czaty o tym samym tytule łączą się (trim, zbite białe znaki, bez rozróżniania wielkości liter). Id bez tytułu to `#` plus pierwsze 8 znaków. Request bez id konwersacji trafia do **Ungrouped** i nie dostaje briefu Play. **Over Warn at**, `!` przy spike i Play nadal działają. Play na złączonym tytule bierze id konwersacji, która ma najdroższy request. Export CSV zostaje płaski. Tytuły pochodzą z lokalnego indeksu. Rozszerzenie nie zgaduje czatów po przerwie w czasie i nie czyta treści promptu. Statistics, Charts i Optimize nie są grupowane.

**Strona:** produkt na `https://cursorcosttracker.com/` (`site/`, GitHub Pages). `homepage` w `package.json` to ten URL.

### 5.3 Poza MVP

Quick Pick jako domyślny klik, Activity Bar, blokujący modal na ścieżce kliknięcia historii, TreeView na 6 kolumn, React/Vue w webview, osobna aplikacja Electron, Advise / skan workspace / auto-naprawa LLM.

---

## 6. Cele MVP

| ID | Cel | Kryterium |
|----|-----|-----------|
| G1 | Koszty w IDE | status bar w ≤ 10 s po starcie (zalogowany user) |
| G2 | Jeden klik do historii | Statistics (Current/Today) albo tabela Last N (chip zapytania) < 2 s (cache) |
| G3 | Spójne liczby | Current/Today zgodne z usage Cursor (± 0,01 $) |
| G4 | Zero konfiguracji | VSIX, bez `.env` |
| G5 | Nie blokuje pracy | brak modalów na zwykłej ścieżce; błąd API = N/A. Blokujący dialog tylko przy krytycznym alercie ostatniego zapytania (domyślnie 10M tokenów lub 5 $). Burn Rate Guard tylko niemodalne toasty |

---

## 7. User stories (MVP)

| ID | Jako… | chcę… | aby… |
|----|-------|-------|------|
| A1 | programista | widzieć Current na belce | znać zużycie cyklu |
| A2 | programista | widzieć Today na belce | pilnować dziennego budżetu |
| A3 | programista | kliknąć Current albo Today | zobaczyć Statistics (prognoza miesiąca) |
| A4 | programista | kolor ostrzegawczy | zauważyć przekroczenie |
| A5 | programista | Refresh | zsynchronizować po długim agencie |
| A6 | programista | czytelny błąd bez tokenu | wiedzieć, że trzeba się zalogować |
| A7 | programista | tooltip z planem i datą cyklu | mieć kontekst bez tabeli |

Z v1.1 nadal otwarte: **Ignore** w tabeli, alerty 80%/90% wydatków, Copy stats. `!` i próg są już w produkcie.  
**1.0.2–1.0.6** (to, co jest w drzewie) opisuje §5.2 i tabela historii w [codebase-snapshot.md](./codebase-snapshot.md): prognoza, alert krytyczny, Optimize, Burn Rate Guard, Coding stats, **11 języków UI** (ukraiński doszedł po 1.0.4), cennik modeli, prognoza cyklu rozliczeniowego, Play, cena katalogowa, To date, grupowanie rozmów, szczegóły dnia na wykresie.

### 7b. User stories (v1.1 — spike tokenów)

| ID | Jako… | chcę… | aby… |
|----|-------|-------|------|
| B1 | programista | `!` na belce, gdy zapytanie przekroczy mój limit tokenów | zauważyć spike bez otwierania tabeli |
| B2 | programista | ten sam `!` przy wierszu w Last 100 | wiedzieć, które zapytanie eksplodowało |
| B3 | programista | ustawić limit (domyślnie 1 000 000 tokenów) | 1M nie było sztywne dla wszystkich |
| B4 | programista | **Ignore** na tym wierszu | wykrzyknik zniknął, jeśli akceptuję koszt |
| B5 | programista | żeby Ignore przeżyło reload | nie być nękanym ponownie |
| B6 | programista | blokujący alert, gdy ostatnie zapytanie trafi w 10M tokenów lub 5 $ | nie przegapić ekstremalnego requestu |

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

**Month to date / Monthly cost forecast:** ta sama próbka eventów. **Jednostka zależy od planu:** Team / Business / Enterprise → **dolary** (`unit: 'usd'`); osobisty Pro / Pro+ → **procent included** (`unit: 'percent'`). Team: zużycie w tym miesiącu / (dni robocze od 1. × dzienny budżet), jedna seria Spend z run-out / dziś vs dzienny budżet. Pro: procent included vs równe tempo (100% ÷ dni robocze w tym miesiącu). Dni robocze to pon–pt, lokalna strefa, wliczając dziś gdy dziś jest dniem roboczym. Ten sam wykres prognozy jest na Statistics i Charts (dni od 1. do końca miesiąca: skumulowane słupki + used na jednej skali, przerywana prognoza, kropkowany leftover). Brak dziennego budżetu dolarowego na Team → zużycie / prognoza dolarowa. Brak dnia roboczego → zużycie / — bez miarki.

**Okno prognozy:** `cursorCost.forecastWindow` domyślnie `calendarMonth`, opcjonalnie `billingCycle`, dotyczy tylko Monthly cost forecast. Billing Cycle jest dostępny przy poprawnym miesięcznym oknie `[start, end)` z `usage-summary` (26–35 dni); w innym przypadku opcja jest ukryta, a efektywne okno wraca do miesiąca kalendarzowego. Przy odnowieniu w trakcie miesiąca wykres oznacza dzień odnowienia i zeruje used/forecast; status bar i Today pozostają oparte o miesiąc kalendarzowy.

Na Pro blok nazywa się **Monthly cost forecast**. Każda miarka pokazuje zużycie cyklu vs 100% oraz datę wyczerpania (albo „lasts the month”), a wykres 0–100% oznacza miejsce, w którym prognoza uderza w sufit. API podaje procent tylko per cykl, więc udział dnia jest ważony jego kosztem dolarowym.

**Próbka (`historySample`):** ta sama API eventów, `pageSize=100`. Domyślnie Last N: `cursorCost.historyLimit` (domyślnie **1000**, min 100, max 10_000). Gdy `cursorCost.historyFromDate` to lokalny dzień (`YYYY-MM-DD`), pobierz od 00:00 tego dnia do `cursorCost.historyToDate` albo do końca dziś, gdy To jest puste (nadal cap 10_000). Jeden resolver zasila tabelę, próbkę Statistics, słupki Charts, Coding stats i CSV.

**Polityka strefy czasowej:** wszystkie dni kalendarzowe (Today, From–To, Charts, Coding stats, MTD) używają **lokalnej strefy IDE**. Timestampy wewnętrzne to epoch ms. Kolumna TIME i briefy Optimize pokazują czas lokalny; Optimize dodaje krótką etykietę strefy. Kanoniczne helpery: `src/time/`.

**Fingerprint spike (v1.1):** id z API jeśli jest, inaczej `${timestamp}|${tokens}|${costUsd}|${model}`. Zignorowane id w `context.globalState` pod `cursorCost.ignoredSpikes`.

**Odświeżanie:** `activate` nie może blokować UI; polling co 1 minutę (1–60); ręczny Refresh; `AbortController`.

**Bezpieczeństwo:** token tylko w extension host; webview dostaje wyłącznie eventy; nigdy nie logować tokenu; brak telemetrii w MVP.

---

## 9. Technologia

VS Code Extension API. TypeScript + esbuild + StatusBarItem + vanilla webview + `fetch` + sql.js + Vitest + vsce.

Szczegóły: [tech-stack.md](./tech-stack.md).

Mapa plików: [architecture.md](./architecture.md). Co doszło w której wersji: [codebase-snapshot.md](./codebase-snapshot.md).

---

## 10. Komendy i ustawienia

| Command ID | Tytuł | Od |
|------------|--------|-----|
| `cursorCost.showHistory` | Show Usage History | 1.0.0 |
| `cursorCost.refresh` | Refresh | 1.0.0 |
| `cursorCost.openDashboard` | Open Dashboard | 1.0.0 |
| `cursorCost.exportCsv` | Export recent queries CSV | 1.0.0 |
| `cursorCost.openPricing` | Open model pricing | 1.0.5 |

| Klucz | Domyślnie | Uwagi |
|-------|-----------|--------|
| `cursorCost.pollIntervalMinutes` | 1 | 1–60; Settings **Auto-refresh** |
| `cursorCost.showStatusBar` | true | edytor belki w Settings |
| `cursorCost.showToday` | true | edytor belki w Settings |
| `cursorCost.minimalMode` | false | tylko Current + Refresh; edytor belki w Settings |
| `cursorCost.recentQueryCount` | 3 | 1–10 najnowszych zapytań na belce |
| `cursorCost.spikeTokenThreshold` | 1000000 | min 1000; w Settings w jednostce **k** (100 = 100k tokenów); `!` przy tym zapytaniu |
| `cursorCost.showSpikeWarning` | true | wyłączone = bez `!` i bez zieleni/czerwieni |
| `cursorCost.showCriticalAlert` | true | blokujący dialog, gdy najnowsze zapytanie trafi w próg tokenów lub dolarów |
| `cursorCost.criticalTokenThreshold` | 10000000 | min 1000; Settings w **k** (10000 = 10M); wystarczy jeden próg |
| `cursorCost.criticalCostUsdThreshold` | 5 | min 0,01 USD; wystarczy jeden próg |
| `cursorCost.burnRateGuard` | true | żywe okno na Statistics; niemodalne toasty; tint Today gdy wysoko |
| `cursorCost.burnRateWindowMinutes` | 10 | 2–60; prawa krawędź to teraz |
| `cursorCost.burnRateWarningUsd` | 2 | min 0,01; niemodalny toast ostrzegawczy |
| `cursorCost.burnRateCriticalUsd` | 5 | nigdy poniżej warning; niemodalny toast błędu; nie zatrzymuje Cursora |
| `cursorCost.burnRateMinQueries` | 2 | 1–50; pojedyncze zapytanie zostaje przy alercie ostatniego zapytania |
| `cursorCost.burnRateWarningToast` | true | wyłączone = zapamiętaj epizod bez tosta |
| `cursorCost.burnRateCriticalToast` | true | wyłączone = zapamiętaj epizod bez tosta |
| `cursorCost.codeLinesInsight` | true | Coding stats na Statistics i Charts (landed / AI · All on Cursor) |
| `cursorCost.groupQueriesByConversation` | false | Zwiń listę zapytań do jednego wiersza na lokalny tytuł czatu. Wspólne tytuły się łączą. Brak id → **Ungrouped**. Export CSV zostaje płaski |
| `cursorCost.language` | `en` | 11 locale: en, pl, zh-cn, fr, de, ja, ko, pt-br, ru, es, uk. Niezależnie od języka VS Code / Cursor |
| `cursorCost.historyLimit` | 1000 | min 100, max 10_000; Settings **Show last**; ignorowane gdy From date jest ustawione |
| `cursorCost.historyFromDate` | (puste) | lokalne `YYYY-MM-DD`; Settings **From date**; puste = Last N |
| `cursorCost.historyToDate` | (puste) | lokalny koniec próbki `YYYY-MM-DD`; puste = do dziś; wymaga From date |
| `cursorCost.budgetDayBasis` | `workingDays` | `workingDays` (pn–pt, domyślnie) albo `calendarDays`; Settings **Pace by** |
| `cursorCost.forecastWindow` | `calendarMonth` | `calendarMonth` albo `billingCycle`; Billing Cycle tylko dla poprawnego miesięcznego cyklu z usage-summary i wyłącznie dla Monthly cost forecast |
| `cursorCost.optimizeDepth` | `balanced` | Prompt Optimize: Quick / Balanced / Deep |
| `cursorCost.okColor` | `#89D185` | kolor dobrego stanu (ciemniejszy `#18794E` na jasnym motywie) |
| `cursorCost.warnColor` | `#F14C4C` | kolor ostrzeżenia (ciemniejszy `#C50F1F` na jasnym motywie) |

Aktywacja: `onStartupFinished`.

---

## 11. Fazy

| Faza | Zakres |
|------|--------|
| **1.0.0** | sesja + API, belka, Last N, Statistics, Charts, CSV, Settings, polling |
| **1.0.1** | dodatki Statistics; Current na koncie firmowym zostaje przy osobistej puli miesięcznej |
| **1.0.2** | prognoza miesiąca; alert krytyczny; 1–10 ostatnich zapytań; odświeżanie domyślnie 1 min |
| **1.0.3** | Optimize; Support Buy Me a Coffee; podstawa dni budżetu; From date; Pro % na belce |
| **1.0.4** | Burn Rate Guard; Coding stats; języki UI (10 w dniu wydania) |
| **1.0.5** | cennik modeli; wiadomość w Support; strona w `site/` |
| **po 1.0.5** | ukraiński (11. locale); prognoza wg cyklu rozliczeniowego |
| **1.0.6** | cursorcosttracker.com; Play i Run Optimize do nowego czatu Agent; cena katalogowa; cache $ saved; $ / 1k linii; To date; `historySample`; filtr Optimized; grupowanie rozmów (domyślnie wyłączone); szczegóły dnia na wykresie i zoom Sample / Last 7 / Month |
| **Nadal otwarte** | Ignore w tabeli i przeliczenie bangu; alerty 80/90%; Copy stats; strzałki tempa przy Today; symulator kosztu modelu; Secret Storage |

---

## 12. Ryzyka

Nieoficjalne API / `state.vscdb` → izolacja w `src/usage/`, stan N/A. Sesja: `node:sqlite` tylko do odczytu, gdy dostępny (bazy wielogigabajtowe); sql.js tylko dla małych plików. Remote SSH: `extensionKind: ui`. Rate limit: polling ≥ 1 min.

---

## 13. Kryteria akceptacji MVP

- [ ] VSIX w Cursorze (Windows): Current w ≤ 10 s przy zalogowanym koncie
- [ ] Today ukryte przy błędzie events; Current nadal widoczne
- [ ] Klik Current/Today → zakładka Statistics; chip zapytania → kolumny Last N z §5.2
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

### 13c. Krytyczny alert ostatniego zapytania

- [ ] Najnowsze zapytanie ≥ 10M tokenów lub ≥ 5 $ pokazuje blokujący dialog (domyślne progi)
- [ ] To samo zapytanie nie wraca po dismiss / reload
- [ ] Późniejsze nowsze zapytanie ponad progiem alertuje znowu
- [ ] Pierwsze załadowanie ostatniego zapytania starszego niż pięć minut nie blokuje
- [ ] Wyłączenie przez `showCriticalAlert`; niezależnie od `showSpikeWarning`

### 13d. Burn Rate Guard (1.0.4)

- [ ] Statistics **Current burn rate** gdy włączone, nawet poniżej progu ostrzeżenia
- [ ] Okno ≥ 2 $ warning / ≥ 5 $ critical: niemodalne toasty, raz na epizod, Snooze 30 min
- [ ] Pierwsze załadowanie z newest-in-window starszym niż pięć minut nie pokazuje toasta
- [ ] Chip Today warnColor gdy okno jest wysokie i Show warnings jest włączone
- [ ] Pojedyncze drogie zapytanie (minQueries domyślnie 2) nie odpala tego toasta
- [ ] Brak drugiego blokującego modala; G5 nadal ma tylko krytyczny alert ostatniego zapytania

---

## 14. Otwarte

Teksty panelu są w 11 językach; domyślny jest angielski. Instalacja w Cursorze idzie przez Open VSX. Homepage to `https://cursorcosttracker.com/`. Nadal otwarte: Ignore w tabeli, alerty 80/90%, Copy stats, strzałki tempa przy Today, symulator kosztu modelu, Secret Storage.

---

## 15. Podsumowanie

Wtyczka Cursor/VS Code, drzewo w wersji **1.0.6**. Belka: Current + Today + sync + 1–10 zapytań + **`!` przy spike**. Klik Current/Today: Statistics; chip zapytania: lista. Play na czerwonym wierszu wkleja brief samych liczb. Lista zapytań może zwinąć się do jednego wiersza na lokalny tytuł czatu (domyślnie wyłączone). Store Ignore jest; przycisku w tabeli nie ma. Optimize to same metadane (bez transkryptu). Stack: TypeScript, esbuild, sql.js, Vitest, GitHub Actions. Logika usage w `src/usage/`.
