# Plan v1.2 — Burn Rate Guard

**Kanon EN:** [burn-rate-guard.md](./burn-rate-guard.md)  
**Status:** zaimplementowane w **1.0.4**  
**Zależność:** ukończone MVP ([mvp.pl.md](./mvp.pl.md)). VSIX bazowy **1.0.3**.  
**Wersja:** **1.0.4** (PATCH)  
**Backlog (nie wdrażać w tym PR):** [additional/README.md](./additional/README.md)

Przy rozjeździe z [prd.md](../context/prd.md) wygrywa **angielski PRD**. PRD aktualizować w tym samym PR.

---

## 1. Cel

Odpowiedzieć na **jak szybko wydaję?**, nie tylko **ile wydałem?**

Cursor może odpalić wiele zwyczajnie wyglądających requestów w kilka minut. Per-query **critical alert** (najnowsze zapytanie ≥ 10M tokenów albo 5 $) i per-query **Warn at** `!` tego nie łapią: każdy wiersz wygląda w porządku, **suma w krótkim oknie** nie.

**Burn Rate Guard** sumuje `costUsd` (oraz, do wyświetlenia, tokeny + liczbę requestów) w oknie czasu ustawionym przez użytkownika (domyślnie **10 minut**). Robi:

1. Zawsze pokazuje **bieżący burn** na Statistics (`3.42 $ / 10 min`, opcjonalny `×` vs własne normalne tempo, suma Today).
2. Tostuje **warning** gdy spend w oknie ≥ `2 $` (domyślnie) i **critical** gdy ≥ `5 $` (domyślnie) — **nie-modalnie**, raz na epizod.
3. Koloruje chip **Today** na status barze, gdy warnings są on i żywe okno jest na warning/critical.

**Nie** czyta czatu, **nie** wykrywa pętli po podobieństwie tokenów (to odłożony [runaway-agent-detector.md](./additional/runaway-agent-detector.md)) i **nie** zatrzymuje Composera. Copy critical może oferować **Focus Composer**, żeby użytkownik sam zatrzymał run w UI Cursora.

**Gotowe gdy:**

- Czyste window / pace / level / `decideBurnRateAlert` pokryte Vitestem (bez importu `vscode`).
- Karta Statistics **Current burn rate** zawsze (gdy funkcja on), także pod progiem warning.
- Tosty warning + critical nie-modalne, raz na epizod, snooze 30 min, grace przy pierwszym starcie (jak [src/spikes/criticalAlert.ts](../src/spikes/criticalAlert.ts)).
- Chip Today + tooltip oddają burn, gdy `showSpikeWarning` jest on.
- Fieldset Settings zgodny z mockiem produktu (enable, okno, warning $, critical $, dwa checkboxy powiadomień).
- `npm test` / `typecheck` zielone. PRD **G5** nadal ma **tylko jeden** blocking modal (critical alert ostatniego zapytania).

---

## 2. Czym to nie jest odłożony plan Runaway

| | **Burn Rate Guard (ten PR)** | **Runaway Agent Detector (backlog)** |
|--|------------------------------|--------------------------------------|
| Pytanie | Jak szybko rośnie **koszt**? | Czy zapytania **wyglądają jak pętla**? |
| Trigger | Suma `$` w `W` minut vs progi `$` użytkownika | Velocity + repeat ±15% tokenów + balloon input |
| Jeden drogi request | Ignorowany jeśli `minQueries` ≥ 2 (domyślnie) — to Query / critical alert | Może nadal odpalić na kształcie repeat |
| Wiersze Pro included `$0` | Tosty dolarowe mogą nigdy nie palnąć; karta i tak pokazuje przerób tokenów | Nadal widzi kształty zapytań |

**Nie** przenosić repeat/balloon do tego PR. Jeden MINOR, jedno pytanie.

---

## 3. Poza zakresem

| Element | Dlaczego |
|---------|----------|
| `{ modal: true }` | G5 — critical alert ostatniego zapytania zostaje jedynym blocking dialogiem |
| Przycisk **Stop Agent**, który naprawdę canceluje Composer | Brak wspieranego API rozszerzenia. Copy nie może udawać. Opcjonalny **Focus Composer** (`composer.focusComposer`), żeby user wcisnął Stop w Cursorze. |
| Transkrypt czatu / composer JSON | Reguła produktu |
| Dzienny cap użytkownika (5 $/dzień) | Odłożony [daily-spend-guard.md](./additional/daily-spend-guard.md) |
| Detektor pętli po podobieństwie tokenów | Odłożony plan runaway |
| Progi **tokenów** jako trigger tostów | Tosty 1.2 są tylko **dolarowe** (mock produktu). Liczby tokenów są **display**. Pro `$0`: §5.6. |
| Extra chip na status barze | Belka to już Current + Today + Refresh + 1–10 zapytań |
| 7. zakładka webview / React | Nigdy |
| Ignore spike’ów tokenów | leftover v1.1 ([token-spike.md](./token-spike.md)) |
| Zmiana matematyki forecastu MTD | Forecast zostaje long-term; burn jest short-term |

---

## 4. Delty PRD (wdrożyć razem z kodem)

Po **Critical last-query alert** dodać **Burn Rate Guard**:

- Setting `cursorCost.burnRateGuard` (domyślnie **true**). Okno `burnRateWindowMinutes` (domyślnie 10, 2–60). Warning `burnRateWarningUsd` (domyślnie **2.00**). Critical `burnRateCriticalUsd` (domyślnie **5.00**, zawsze ≥ warning). Min. requestów w oknie `burnRateMinQueries` (domyślnie **2**, 1–50), żeby **pojedyncze** drogie zapytanie zostawało przy istniejącym per-query critical alert.
- **Żywe okno:** zapytania z `timestamp` w `[now − W, now]` (lokalne ms). Nie „ostatnie W minut najnowszego eventu na zawsze”. Po ustaniu wydatków tempo **spada**, gdy wiersze wypadają z okna.
- Karta **Current burn** na Statistics (zawsze gdy włączone): `$` okna / `W min`, liczba requestów, tokeny, opcjonalny `×` vs mediana historycznych okien w tej próbce Last N, Today `$`.
- **Warning** (nie-modalny): `$` okna ≥ warning i `queryCount ≥ minQueries`. **Critical** (nie-modalny `showErrorMessage`, nadal **bez** `{ modal: true }`): `$` okna ≥ critical.
- Niezależne od `showCriticalAlert`. Czerwień na Today / wierszach w oknie wg `showSpikeWarning`. Tosty wg `burnRateWarningToast` / `burnRateCriticalToast`.
- Raz na epizod + Snooze 30 min w `globalState`. Pierwszy load: jeśli najnowsze zapytanie w żywym oknie jest starsze niż pięć minut, zapamiętaj bez toastu.
- Nie zatrzymuje Cursora. Akcje critical: **View details** (Statistics), **Dismiss**, opcjonalnie **Focus Composer**.
- G5 bez zmian.

Historyjki (np. B1–B6):

- B1: 12 requestów, `4.82 $` w 6 min, warning `2 $` → tost warning + karta Statistics.
- B2: to samo okno później osiąga `5.10 $` → **jeden** extra tost critical (eskalacja raz).
- B3: restart z burstem już 10 min starym → brak toastu (grace).
- B4: jeden request `6 $`, `minQueries = 2` → **brak** toastu burn (per-query critical alert może nadal pokazać modal).
- B5: Snooze → brak toastu przez 30 min nawet jeśli nadal over.
- B6: Show warnings off → Today zostaje w kolorze default; tosty nadal honorują własne checkboxy.

---

## 5. Algorytm (czyste, `src/burnRate/`)

Bez `vscode`. Wstrzykiwać `nowMs`. Reuse `queryFingerprint` z `src/spikes/criticalAlert.ts`.

### 5.1 Żywe okno (`window.ts`)

Typ `BurnRateWindow` i `liveWindow(queries, windowMinutes, nowMs)` — kanon EN §5.1.

- `endMs = nowMs`, `startMs = nowMs - windowMinutes * 60_000`.
- Brać `timestamp >= startMs && timestamp <= nowMs`. Timestampy z przyszłości (skew zegara) — **wykluczyć**, przetestować.
- Sortować newest first.
- `costUsd = sum(costUsd)`, `tokens = sum(tokens)`.

Pusto → `queryCount = 0`, sumy `0`.

**Dlaczego `now`, nie najnowszy event:** jeśli ostatnie zapytanie było 45 min temu, „current burn” musi być `0.00 $ / 10 min`, nie tamtym starym burstem.

### 5.2 Poziom (`detect.ts`)

```
if !enabled → off
if queryCount < minQueries → ok
if costUsd >= criticalUsd → critical
if costUsd >= warningUsd → warning
else → ok
```

`criticalUsd` clampowane ≥ `warningUsd` w config, żeby gałęzie nie mogły się odwrócić.

### 5.3 Normalne tempo (`pace.ts`)

Tylko linia `×`. **Nigdy** trigger toastu.

1. Próbka Last N z `timestamp < startMs` (ściśle przed żywym oknem).
2. **Nienachodzące** kubełki długości `windowMs` kończące się na `startMs`, `startMs - windowMs`, … dopóki kubełek ma ≥ `minQueries` **albo** stop po 24 kubełkach (cap pracy).
3. Każdy kubełek: `sum(costUsd)` zapytań w `[bucketStart, bucketEnd)`.
4. Zostawić kubełki z `queryCount ≥ minQueries`.
5. Jeśli mniej niż **3** takie kubełki → `normalUsd = null` (ukryć `×`).
6. Inaczej `normalUsd = mediana(kosztów kubełków)`.
7. `multiplier = costUsd / normalUsd` gdy `normalUsd >= 0.01`; inaczej `null` (uniknąć `400×` na medianie `0.001 $`).

Mediana parzystej listy: średnia dwóch środkowych; do wyświetlenia zaokrąglić do centów; `multiplier` liczyć na pełnym float.

### 5.4 Epizod + decyzja toastu (`detect.ts`)

**Epizod** zaczyna się, gdy level staje się `warning` albo `critical`, kończy gdy wraca do `ok`/`off` **albo** snooze/dismiss.

Stałe: `BURN_RATE_SEEN_KEY`, `BURN_RATE_SNOOZE_UNTIL_KEY`, grace 5 min, snooze 30 min. Typy `BurnRateEpisode` / `BurnRateDecision` — kanon EN §5.4.

**Preferowany klucz:** `lastSeenKey` jako `"warning:<episodeStartFloor>"` / `"critical:<episodeStartFloor>"`, gdzie `episodeStartFloor = floor(newestInWindow.timestamp / 60_000)` przy **pierwszym** przekroczeniu, zamrożony aż `ok`. Level w kluczu → warning→critical to **nowy** klucz → drugi tost.

`decideBurnRateAlert` — tabela guardów jak EN §5.4 (off/ok czyści epizod; wyłączony tost = remember jak pokazany; snooze; grace; skip tego samego poziomu; escalate; nowy burst po `ok`).

### 5.5 Clampy

| Funkcja | Zakres | Domyślnie |
|---------|--------|-----------|
| `clampBurnRateWindowMinutes` | 2–60, round | 10 |
| `clampBurnRateUsd` | ≥ 0.01, ≤ 10_000, centy | warning 2, critical 5 |
| `clampBurnRateMinQueries` | 1–50, round | 2 |
| critical vs warning | `critical = max(critical, warning)` | |

`0` **nie** jest legalne dla warning/critical (wyłączenie to boolean). Non-finite → defaulty.

### 5.6 Pro / included `$0`

Wiele eventów Pro parsuje się do `0 $`. Wtedy `costUsd` w oknie zostaje `0` → level `ok` na zawsze.

- Nadal pokazywać **tokeny / W min** i liczbę requestów na karcie.
- Hint Settings: “Warnings use dollars from Cursor’s usage events. Included Pro requests that bill as 0.00 $ do not raise the dollar burn — the card still shows token throughput.”
- **Nie** wymyślać toastu tokenowego w 1.2 (zostają kontrolki `$` z mocka). Alerty na tempo tokenów mogą być późniejszym PATCH, jeśli poproszą userzy Pro.

Team / usage-based `$` zachowują się jak mock.

---

## 6. Ustawienia i wiadomości

### 6.1 `package.json` / `CursorCostConfig`

| Klucz | Typ | Domyślnie | Uwagi |
|-------|-----|-----------|--------|
| `cursorCost.burnRateGuard` | boolean | `true` | Master: karta + detekcja |
| `cursorCost.burnRateWindowMinutes` | number | `10` | 2–60 |
| `cursorCost.burnRateWarningUsd` | number | `2` | Apply / Enter / blur |
| `cursorCost.burnRateCriticalUsd` | number | `5` | ≥ warning po clampie |
| `cursorCost.burnRateMinQueries` | number | `2` | Ukryte w mocku marketingowym; i tak setting. W tym samym fieldsecie pod hintem „Minimum requests in the window (default 2) so a single spike stays the query alert.” |
| `cursorCost.burnRateWarningToast` | boolean | `true` | “Show warning notification” |
| `cursorCost.burnRateCriticalToast` | boolean | `true` | “Show critical notification” |

Fieldset **Burn Rate Guard** po **Critical alert**. Layout jak EN §6.1. Liczby: Apply / Enter / blur. Stepper ±0.50 $ jak critical cost.

### 6.2 Host → webview

Pola `burnRateGuard`, `burnRateWindowMinutes`, `burnRateWarningUsd`, `burnRateCriticalUsd`, `burnRateMinQueries`, `burnRateWarningToast`, `burnRateCriticalToast` oraz `burnRate: { level, costUsd, tokens, queryCount, windowMinutes, multiplier, todayUsd, summary, paceLabel } | null`.

`HistoryRow` dodaje `inBurnWindow: boolean`. Gdy `showSpikeWarning` i level warning/critical, te wiersze używają `warnColor` (oprócz istniejącego spike `!`). **Nie** prefixować TOKENS drugim znakiem; `!` zostaje tokenowy.

### 6.3 Webview → host

`setBurnRateGuard`, `setBurnRateWindowMinutes`, `setBurnRateWarningUsd`, `setBurnRateCriticalUsd`, `setBurnRateMinQueries`, `setBurnRateWarningToast`, `setBurnRateCriticalToast`. Persist `ConfigurationTarget.Global` + overlay.

---

## 7. Powierzchnie UI

### 7.1 Tosty (`src/ui/burnRateAlert.ts`)

**Warning** — `showWarningMessage` **bez** `modal`:

```
High burn rate: 4.82 $ in the last 6 minutes (12 requests, 18.4M tokens).
Warning only — Cursor will keep running.
```

Przyciski: **View details**, **Dismiss**.

**Critical** — `showErrorMessage` **bez** `modal`:

```
Possible runaway cost: 8.41 $ in 9 minutes (24 requests, 31.2M tokens).
This does not stop Cursor. Check the active Agent run before continuing.
```

Przyciski: **View details**, **Focus Composer** (jeśli `composer.focusComposer` jest w `getCommands`; inaczej pominąć), **Dismiss**.

Bez **Stop Agent**. Jeśli nie da się zfocusować Composer, wystarczy View details.

- **View details** → `cursorCost.showHistory` na **Statistics** (jak Current/Today).
- **Dismiss** → `remember` bieżącego klucza epizodu.
- **Focus Composer** → `composer.focusComposer`, fallback `composer.openComposer` (ten sam pomysł allowlisty co [openOptimizeChat.ts](../src/ui/openOptimizeChat.ts)). Nie wklejać. Nie tworzyć nowego czatu.

Snooze: **Snooze 30 min** na obu tostach. Zapis `now + BURN_RATE_SNOOZE_MS`.

Kontroler: kopia `CriticalAlertController`. `activate()` nie `await`uje toastu.

Copy: `formatDollars`, `formatCompactTokens`. Czas w copy: `max(1, round((now - oldestInWindow) / 60_000))` minut, żeby „6 minutes” było uczciwe, gdy burst jest krótszy niż `W`.

### 7.2 Status bar

Gdy `burnRateGuard` i level `warning` | `critical` i `showSpikeWarning`: chip **Today** używa `warnColor` (nawet jeśli plan daily budget jest OK). Chip Current bez zmian.

Tooltip: extra wiersz **Burn** `3.42 $ / 10 min` i `2.8×` gdy jest multiplier.

Minimal mode: Today może być ukryty — wtedy tylko tost + Statistics. Nie dodawać chipa.

Preview Settings: preferować **niezmieniony sample**.

### 7.3 Statistics

**Zawsze** (funkcja on) karta **Current burn rate** obok glossary Current/Today:

- Tytuł: `Current burn rate`
- Wartość: `3.42 $ / 10 min`
- Subline: `↑ 2.8× your normal rate` albo pominąć
- Body: `12 requests · 18.4M tokens` + `Today: 12.84 $` gdy `todayUsd` nie jest null
- Meter: wypełnienie `costUsd / criticalUsd` (cap 100%). Kolor `--cost-ok` / `--cost-warn` z level gdy `showSpikeWarning`
- Gdy `ok`: i tak pokazać kartę. Pusta próbka: `0.00 $ / 10 min`, `0 requests`

Gdy warning/critical: **banner** nad glossary (`High burn rate` / `Possible runaway cost` + „Does not stop Cursor.”).

Bez nowej serii Charts w 1.2.

### 7.4 Last N

Wiersze `inBurnWindow` przy warning/critical: ten sam warn styling co spike. Bez nowej kolumny. Pill **This window** **poza 1.2**.

### 7.5 Optimize / Charts / Support

Bez zmian.

---

## 8. Pliki

```
src/burnRate/window.ts
src/burnRate/pace.ts
src/burnRate/detect.ts
src/burnRate/copy.ts
src/ui/burnRateAlert.ts
src/config.ts
src/ui/historyRows.ts
src/ui/historyPanel.ts
src/ui/periodStats.ts
src/ui/statusBarView.ts
src/ui/statusBar.ts
src/ui/statusBarTooltip.ts
src/extension.ts
package.json
media/history.html|css|js
test/burnRateWindow.test.ts
test/burnRatePace.test.ts
test/burnRateDetect.test.ts
test/burnRateCopy.test.ts
```

Aktualizacja: `prd.md`, `prd.pl.md`, `architecture.md`, `codebase-snapshot.md`, `extension-webview.mdc`, `shared.mdc` (`src/burnRate/`).

Poll zostaje (domyślnie 1 min). Activity refresh ([activityRefresh.ts](../src/usage/activityRefresh.ts)) już refetchuje on focus/edit — tak burn zostaje bliżej live niż jedna minuta. Nie dodawać osobnego szybszego polla.

---

## 9. Kroki wdrożenia

| Krok | Praca | Pliki |
|------|--------|--------|
| 1 | Bump **1.0.4**. Klucze `cursorCost.burnRate*` + opisy. | `package.json` |
| 2 | Clampy + `CursorCostConfig`. | `detect.ts` / `clamp.ts`, `config.ts` + testy |
| 3 | `liveWindow` + przyszłe timestampy / pusto. | `window.ts` + testy |
| 4 | `normalUsd` / `multiplier`. | `pace.ts` + testy |
| 5 | `burnRateLevel` + `decideBurnRateAlert`. | `detect.ts` + testy |
| 6 | Helpery copy EN. | `copy.ts` + testy |
| 7 | `BurnRateAlertController`. | `burnRateAlert.ts`, `extension.ts` |
| 8 | Payload + karta + banner. | `historyRows.ts`, `media/history.*` |
| 9 | Ton Today + tooltip. | `statusBarView.ts`, `statusBarTooltip.ts` |
| 10 | Fieldset Settings. | `media/history.*`, `historyPanel.ts` |
| 11 | PRD, architecture, snapshot, rules. | `.ai/context/*`, `.cursor/rules/*` |

Nie wdrażać funkcji z additional/ w tym PR.

---

## 10. Testy

Wstrzykiwać `nowMs` i timestampy. Bez `Date.now()`. Przypadki — kanon EN §10 (okno vs `now`, future exclude, idle → `$0`, progi, `minQueries`, clamp critical≥warning, mediana pace, grace, escalate, snooze, toasts off, `inBurnWindow`).

---

## 11. Bezpieczeństwo

Tost, tooltip i payload: tylko `$`, tokeny, liczby requestów. Bez cookie, access token, emaila, transkryptu. Focus Composer woła **istniejące** id komendy Cursora; bez tekstu użytkownika. Bez logowania raw eventów.

---

## 12. Warstwy (jak siada obok tego, co jest)

```
                 COST PROTECTION
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
     QUERY ALERT   BURN RATE    MONTHLY FORECAST
      per query    short-term      long-term
      Warn at !    to 1.0.4       istniejące MTD
      critical $5                 istniejące charts
```

- **Query alert:** jeden request za duży.
- **Burn Rate Guard:** wiele requestów, niebezpieczne **tempo**.
- **Monthly forecast:** to tempo może opróżnić miesiąc (już jest; bez zmiany wzoru).

---

## 13. Kryteria gotowości

- [ ] Wersja **1.0.4**
- [ ] Żywe okno vs `now`; tempo spada przy bezczynności
- [ ] Karta zawsze gdy włączone; `×` tylko przy wystarczającej historii
- [ ] Warning + critical nie-modalne; eskalacja raz; snooze; grace
- [ ] Bez Stop Agent; opcjonalny Focus Composer; disclaimer
- [ ] `minQueries` domyślnie 2 — jeden spike ≠ tost burn
- [ ] Chip Today warn gdy level wysoki i Show warnings on
- [ ] Fieldset Settings; liczby nie w trakcie pisania
- [ ] Ograniczenie Pro `$0` w PRD + hicie Settings
- [ ] `npm test` + `npm run typecheck`
- [ ] G5: tylko critical alert ostatniego zapytania jest blocking
- [ ] Brak kodu additional/ backlog w PR
