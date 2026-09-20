# Plan v1.2 — Runaway Agent Detector

**Kanon EN:** [runaway-agent-detector.md](./runaway-agent-detector.md)  
**Plan nadrzędny:** [v1.2-overview.pl.md](./v1.2-overview.pl.md)  
**Status:** gotowy do realizacji  
**Zależność:** ukończone MVP ([mvp.pl.md](../mvp.pl.md)). VSIX bazowy **1.0.3**.  
**Następna:** [daily-spend-guard.pl.md](./daily-spend-guard.pl.md) (1.3.0)  
**Wersja:** **1.2.0** (MINOR)

Przy rozjeździe z [prd.md](../../context/prd.md) wygrywa **angielski PRD**. PRD aktualizować w tym samym PR.

Eventy usage Cursora **nie mają** conversation id. Detekcja to heurystyka szeregu czasowego na `UsageQuery[]` (timestamp, model, kind, tokeny, koszt). To nie jest dowód, że agent się zapętlił — UI musi mówić **may be looping**.

---

## 1. Cel

Ostrzeżenie, gdy ostatnie zapytania wyglądają jak pętla: dużo tur w krótkim oknie, niemal identyczne powtórzenia albo eksplodujący input.

**Gotowe gdy:**

- Czyste `detectRunaway` + `decideRunawayAlert` pokryte Vitestem (bez importu `vscode`).
- Tost **nie-modalny** odpala się **raz na epizod** (Snooze 30 min); klastry historyczne przy pierwszym starcie są zapamiętywane bez toastu (ten sam pomysł grace co critical alert).
- Chipy zapytań na status barze i TOKENS w Last N pokazują `!` / `warnColor` dla zapytań w aktywnym epizodzie, gdy `showSpikeWarning` jest on.
- Statistics pokazuje banner; Optimize może dodać jeden finding z metadanych.
- Fieldset Settings **Runaway detector**; `npm test` / `typecheck` zielone; PRD G5 nadal ma **tylko jeden** blocking modal (critical alert).

---

## 2. Poza zakresem

| Element | Kiedy / dlaczego |
|---------|------------------|
| `{ modal: true }` | Nigdy — G5. Critical alert zostaje jedynym blocking dialogiem. |
| Stop / pauza Composera lub Agenta | Nie jest API rozszerzenia. Copy: ostrzeżenie nie zatrzymuje wydatków. |
| Transkrypt czatu / composer JSON | Reguła produktu. |
| Ignore spike’ów tokenów | leftover v1.1 ([token-spike.pl.md](../token-spike.pl.md)). |
| User daily cap jako sygnał burn | 1.3. W 1.2 burn-$ jest opcjonalny i domyślnie **off**. |
| Nowa zakładka webview | Nigdy w tym epicu. |
| React | Nigdy. |

---

## 3. Delty PRD (wdrożyć razem z kodem)

Dodać podrozdział po Critical last-query alert:

- **Runaway Agent Detector:** gdy `cursorCost.runawayDetector` jest on, rozszerzenie ocenia próbkę Last N w oknie przesuwnym (`runawayWindowMinutes`, domyślnie 10; `runawayMinQueries`, domyślnie 8). Sygnały: **velocity** (≥ min zapytań w oknie), **repeat** (≥ 5 kolejnych ten sam model i tokeny ±15%), **balloon** (input tokens rosną ≥ 50% na ostatnich 3 w oknie), opcjonalny **burn** jeśli `runawayBurnUsd` > 0 (domyślnie 0 = off). Trafienie = **epizod**. Ostrzeżenie nie-modalne raz na fingerprint epizodu; **Snooze** 30 minut w `globalState`. Zapytania starsze niż pięć minut przy pierwszym starcie są zapamiętywane bez toastu. Nie zatrzymuje Cursora. Niezależne od modala critical alert. Wizualne `!` / czerwień wg `showSpikeWarning`.

Historyjki (nowe, np. R1–R4): tost przy żywej pętli; brak toastu po restarcie ze starą gęstą historią; Snooze tłumi 30 min; Show warnings off → brak `!`/kolorów na pasku i w tabeli.

G5 bez zmian: bez extra blocking modala.

---

## 4. Pliki

```
src/runaway/detect.ts          # czyste: okno, sygnały, epizod, decide
src/runaway/alert.ts           # copy toastu (czyste stringi)
src/ui/runawayAlert.ts         # kontroler hosta: tost, globalState, Open History
src/config.ts                  # nowe klucze
src/ui/historyRows.ts          # HistoryRow.runaway; payload.runaway
src/ui/statusBarView.ts        # bang / ton chipa dla zapytań runaway
src/ui/statusBar.ts            # przekaz flag
src/ui/historyPanel.ts         # wiadomości set*; runaway w data
src/ui/optimizeInsights.ts     # opcjonalny finding id `runaway-loop`
src/extension.ts               # rejestracja kontrolera
package.json                   # 1.2.0 + contributes
media/history.html|css|js      # badge, banner Statistics, fieldset Settings
test/runawayDetect.test.ts
test/runawayDecide.test.ts
```

Aktualizacja: `.ai/context/prd.md`, `prd.pl.md`, `architecture.md`, `codebase-snapshot.md`, `.cursor/rules/extension-webview.mdc`, `.cursor/rules/shared.mdc` (nowy `src/runaway/`).

Podział jak critical alert: `src/spikes/criticalAlert.ts` (czyste) vs `src/ui/criticalAlert.ts` (host).

---

## 5. Typy i algorytm (`src/runaway/detect.ts`)

Bez `vscode`. W testach wstrzykiwać `nowMs`.

```typescript
export const DEFAULT_RUNAWAY_WINDOW_MINUTES = 10
export const MIN_RUNAWAY_WINDOW_MINUTES = 2
export const MAX_RUNAWAY_WINDOW_MINUTES = 60
export const DEFAULT_RUNAWAY_MIN_QUERIES = 8
export const MIN_RUNAWAY_MIN_QUERIES = 3
export const MAX_RUNAWAY_MIN_QUERIES = 50
export const DEFAULT_RUNAWAY_BURN_USD = 0
export const RUNAWAY_REPEAT_COUNT = 5
export const RUNAWAY_TOKEN_SIMILARITY = 0.15
export const RUNAWAY_BALLOON_RATIO = 1.5
export const RUNAWAY_BALLOON_LOOKBACK = 3
export const DEFAULT_RUNAWAY_GRACE_MS = 5 * 60_000
export const RUNAWAY_SNOOZE_MS = 30 * 60_000

export const RUNAWAY_SEEN_KEY = 'cursorCost.lastRunawaySeenKey'
export const RUNAWAY_SNOOZE_UNTIL_KEY = 'cursorCost.runawaySnoozeUntil'

export type RunawaySignal = 'velocity' | 'repeat' | 'balloon' | 'burn'

export type RunawayEpisode = {
  firstTimestamp: number
  lastTimestamp: number
  queryCount: number
  costUsd: number
  signals: RunawaySignal[]
  fingerprints: string[]
}

export type RunawayDecision =
  | { kind: 'skip' }
  | { kind: 'remember'; key: string }
  | { kind: 'alert'; episode: RunawayEpisode; key: string }
```

Reuse `queryFingerprint` z `src/spikes/criticalAlert.ts` (nie duplikować).

### 5.1 Okno

1. Sortować zapytania **newest first**.
2. `anchor = queries[0].timestamp` (najnowszy event). **Nie** używać zegara ściany do *budowy* okna (testy zostają deterministyczne). Zegar ściany tylko do grace / snooze w `decideRunawayAlert`.
3. `windowStart = anchor - windowMinutes * 60_000`.
4. `inWindow = queries` z `timestamp >= windowStart` (nadal newest-first).

Pusta próbka → brak epizodu.

### 5.2 Sygnały (wystarczy jeden)

**Velocity:** `inWindow.length >= minQueries`.

**Repeat:** spacer `inWindow` w kolejności newest-first. Ciąg trwa, gdy `stripModelPrefix(model)` jest równy (traktuj `null` jako `"unknown"`) **oraz** `|tokens_a - tokens_b| / max(tokens_a, 1) <= 0.15`. Jeśli długość ciągu ≥ `RUNAWAY_REPEAT_COUNT` (5) → `repeat`. Ciągi nie przechodzą krawędzi okna.

**Balloon:** weź ostatnie `RUNAWAY_BALLOON_LOOKBACK` (3) zapytania w oknie **oldest-first**. Potrzeba 3 z `inputTokens > 0`. Sygnał jeśli każdy następny `inputTokens >= previous * RUNAWAY_BALLOON_RATIO` (1.5), czyli ≥ 50% wzrostu na krok, albo równoważnie last ≥ first × 1.5². Wybrać **strict chain** (każdy krok ≥ 1.5×) i przetestować. Guard `inputTokens === 0` (brak balloon).

**Burn:** jeśli `runawayBurnUsd > 0` i `sum(costUsd in window) >= runawayBurnUsd` → `burn`. Domyślny setting `0` = pomiń ten sygnał.

Jeśli `signals.length === 0` → brak epizodu.

### 5.3 Epizod

```
firstTimestamp = min(inWindow.timestamp)
lastTimestamp  = max(inWindow.timestamp)
queryCount     = inWindow.length
costUsd        = sum(inWindow.costUsd)
fingerprints   = inWindow.map(queryFingerprint)
key            = `${firstTimestamp}|${lastTimestamp}|${queryCount}`
```

`detectRunaway(queries, config): RunawayEpisode | null`

`queryInRunaway(query, episode): boolean` — fingerprint w `episode.fingerprints`.

### 5.4 Decyzja toastu (`decideRunawayAlert`)

Wejścia: `episode`, `enabled`, `lastSeenKey`, `snoozeUntilMs`, `nowMs`, `graceMs`.

| Warunek | Wynik |
|---------|--------|
| `enabled === false` | Jeśli epizod istnieje i klucz ≠ lastSeenKey → `remember`; inaczej `skip` |
| brak epizodu | `skip` |
| `nowMs < snoozeUntilMs` | `remember` (trzymaj klucz aktualny, żeby nowy epizod po snooze mógł ostrzec) |
| `key === lastSeenKey` | `skip` |
| pierwsze zobaczenie (`lastSeenKey === undefined`) i `nowMs - lastTimestamp > graceMs` | `remember` (stara gęsta historia przy instalacji / restarcie) |
| w przeciwnym razie | `alert` |

Ten sam kształt co `decideCriticalAlert`. Nie reuse’ować tamtej funkcji — inny klucz i snooze.

### 5.5 Clampy

```
clampRunawayWindowMinutes  → 2…60, default 10, non-finite → default
clampRunawayMinQueries     → 3…50, default 8, round
clampRunawayBurnUsd        → 0 lub ≥ 0.01, max 10_000; non-finite → 0
```

---

## 6. Ustawienia i wiadomości

### 6.1 `package.json` / `CursorCostConfig`

| Klucz | Typ | Domyślnie | Uwagi |
|-------|-----|-----------|--------|
| `cursorCost.runawayDetector` | boolean | `true` | Master: detekcja + tost + banner + finding + flaga wiersza |
| `cursorCost.runawayWindowMinutes` | number | `10` | 2–60 |
| `cursorCost.runawayMinQueries` | number | `8` | 3–50 |
| `cursorCost.runawayBurnUsd` | number | `0` | `0` = off; zapis na Apply / Enter / blur |

Nowy fieldset Settings **Runaway detector** po **Critical alert** (rodzina ostrzeżeń). Checkbox + okno + min zapytań + opcjonalny burn. Hint: “Metadata only — does not read the chat and does not stop the agent.”

### 6.2 Host → webview (`HistoryDataPayload`)

```typescript
runawayDetector: boolean
runawayWindowMinutes: number
runawayMinQueries: number
runawayBurnUsd: number
runaway: {
  active: boolean
  queryCount: number
  minutes: number
  costUsd: number
  signals: RunawaySignal[]
  summary: string  // English, e.g. "8 queries in 6 min · 1.20 $"
} | null
```

`HistoryRow` dodaje `runaway: boolean` (true gdy fingerprint jest w aktywnym epizodzie). TOKENS już prefixuje `! ` dla spike’ów — jeśli runaway i jeszcze nie spike, prefix `! ` także gdy `showSpikeWarning`. Jeśli i spike, i runaway, jeden `!` wystarczy.

### 6.3 Webview → host

| `type` | Akcja |
|--------|--------|
| `setRunawayDetector` | boolean |
| `setRunawayWindowMinutes` | number (Apply / Enter / blur) |
| `setRunawayMinQueries` | number |
| `setRunawayBurnUsd` | number |

Persist przez `workspace.getConfiguration('cursorCost').update(..., ConfigurationTarget.Global)` jak inne klucze. Overlay patch, żeby UI zaktualizowało się zanim wyląduje settings.json.

---

## 7. Powierzchnie UI

### 7.1 Tost nie-modalny (`src/ui/runawayAlert.ts`)

`vscode.window.showWarningMessage(message, 'Open History', 'Snooze 30 min')` — **bez** `{ modal: true }`.

Copy (`src/runaway/alert.ts`):

- Message: `Agent may be looping (8 queries in 6 min, 1.20 $).`
- Detail nie jest dostępny na nie-modalnym `showWarningMessage`; pierwsza linia musi być samowystarczalna. Opcjonalne drugie zdanie w message: `Warning only — Cursor will keep running.`

Akcje:

- **Open History** → `cursorCost.showHistory` na zakładce **queries** (jak chip zapytania, nie Statistics).
- **Snooze 30 min** → `globalState.update(RUNAWAY_SNOOZE_UNTIL_KEY, now + RUNAWAY_SNOOZE_MS)`.
- Zamknięcie (X) → nadal `remember` klucza epizodu, żeby nie spamować. *Nowy* epizod (inny klucz) może ostrzec.

Wzorzec kontrolera: kopia `CriticalAlertController` (guard re-entrancy `showing`, subskrypcja `UsageService.onDidChange` + config). `lastSeenKey` w `RUNAWAY_SEEN_KEY`. Rejestracja z `extension.ts` na `context.subscriptions`.

`activate()` nie może `await`ować toastu.

### 7.2 Status bar

Gdy `showSpikeWarning` i epizod aktywny: chip zapytania, którego fingerprint jest w epizodzie, używa `!` i `warnColor` nawet jeśli tokeny < Warn at. Chipy Current/Today **nie** czerwienieją wyłącznie przez runaway (overage Today to 1.3). Minimal mode: brak chipów zapytań → brak `!` na chipie; tost + banner Statistics nadal działają.

### 7.3 Last N

- Wiersze `runaway`: `warnColor` na wierszu gdy warnings on (jak wiersze spike).
- Toolbar: opcjonalny pill **Looping** obok **Over Warn at**, filtr klienta `row.runaway`. Jeśli to za dużo chrome na 1.2, pominąć pill i oprzeć się na `!` + bannerze Statistics — **preferować pill** (widoczny na Reddit, lokalny filtr, bez extra kolumny).

### 7.4 Statistics

Banner nad glossary gdy `runaway.active`: tytuł **Possible agent loop**, body = `runaway.summary` + “Warning only — Cursor will keep running.” Kolor werdyktu `--cost-warn` gdy warnings on, inaczej domyślna karta.

### 7.5 Optimize

Jeśli epizod aktywny, prepend finding `{ id: 'runaway-loop', label: 'Possible loop', detail: summary }`. Nie zmieniać szablonów promptu.

### 7.6 Preview paska w Settings

Sample chipy mogą pokazać fałszywe `!` gdy checkbox runaway jest on **tylko jeśli** to nie kłóci się z istniejącym sample (przykładowy spend, nie live). Preferować nie udawać pętli w preview; udokumentować „preview unchanged”, chyba że trywialne.

---

## 8. Kroki wdrożenia

| Krok | Praca | Pliki |
|------|--------|--------|
| 1 | Bump `1.2.0`. Dodać cztery klucze `cursorCost.runaway*` + opisy markdown. | `package.json` |
| 2 | Clampy + pola na `CursorCostConfig` / defaults / `cursorCostConfigFrom`. | `src/config.ts` + istniejące testy config |
| 3 | `detectRunaway`, clampy, `queryInRunaway`. | `src/runaway/detect.ts` + `test/runawayDetect.test.ts` |
| 4 | `decideRunawayAlert` + copy toastu. | `detect.ts`, `alert.ts` + `test/runawayDecide.test.ts` |
| 5 | `RunawayAlertController`: tost, snooze, grace, Open History. | `src/ui/runawayAlert.ts`, `src/extension.ts` |
| 6 | Flaga wiersza + payload `runaway` + wiadomości Settings. | `historyRows.ts`, `historyPanel.ts` |
| 7 | Last N `!` / filtr Looping; banner Statistics; finding Optimize. | `media/history.*`, `optimizeInsights.ts` |
| 8 | Bang chipa status bara dla fingerprintów runaway. | `statusBarView.ts`, `statusBar.ts` |
| 9 | Fieldset Settings Runaway detector (Apply / Enter / blur na liczbach). | `media/history.html\|js\|css` |
| 10 | PRD, architecture, snapshot, webview + shared rules. | `.ai/context/*`, `.cursor/rules/*` |

Nie wdrażać Daily Guard, efficiency, advisor ani attribution w tym PR.

---

## 9. Testy

Uruchomienie: `npm test`. Zamrozić czas przez wstrzyknięte `nowMs` / timestampy zapytań — bez zegara maszyny.

### 9.1 `runawayDetect.test.ts`

- 7 zapytań w 10 min, minQueries 8 → brak epizodu.
- 8 zapytań w 10 min → tylko `velocity`.
- 8 zapytań rozłożonych na 11 min (okno 10) → brak velocity (najstarsze poza oknem).
- 5 kolejnych ten sam model, tokeny 1000 / 1100 / 1050 / 1000 / 1140 (±15%) → `repeat` nawet jeśli `minQueries` to 8 i jest tylko 5.
- 5 kolejnych, tokeny 1000 vs 2000 → brak repeat.
- Różne modele, podobne tokeny → brak repeat.
- 3 zapytania input 1000 → 1600 → 2500 (każde ≥ 1.5×) → `balloon`.
- input 0 na środkowym zapytaniu → brak balloon.
- `runawayBurnUsd = 0` → nigdy `burn` nawet jeśli suma okna to 10 $.
- `runawayBurnUsd = 2` i suma okna 2.00 $ → `burn`.
- Pusta tablica → `null`.
- Fingerprinty na epizodzie zgadzają się z `queryFingerprint`.

### 9.2 `runawayDecide.test.ts`

- Pierwszy load, epizod `lastTimestamp` 10 min temu → `remember`, nie `alert`.
- Pierwszy load, ostatnie zapytanie 30 s temu, match velocity → `alert`.
- Ten sam klucz co `lastSeenKey` → `skip`.
- `enabled: false` + nowy klucz → `remember`.
- `nowMs < snoozeUntilMs` → `remember` (nie `alert`).
- Po wygaśnięciu snooze, nowy klucz → `alert`.

### 9.3 Integracja (lekka)

- Payload: `events[].runaway` true tylko dla wierszy w epizodzie.
- Clampy config: okno `1` → 2; `999` → 60; minQueries `0` → 3.

Bez fixture z prawdziwymi emailami/tokenami.

---

## 10. Bezpieczeństwo

- Bez cookie, tokenów ani emaili w toście, payloadzie ani logach.
- Fingerprinty to timestamp|tokens|cost|model — już używane przez critical alert.
- Nie dumpować raw eventów API do Output channel.

---

## 11. Kryteria gotowości

- [ ] Wersja **1.2.0**
- [ ] Tost nie-modalny raz na epizod; Snooze 30 min; grace przy pierwszym starcie
- [ ] Copy mówi, że Cursor dalej działa
- [ ] `!` / kolory pod `showSpikeWarning`
- [ ] Banner Statistics + opcjonalny finding Optimize
- [ ] Fieldset Settings; liczby nie zapisują się w trakcie pisania
- [ ] `npm test` + `npm run typecheck`
- [ ] PRD G5 nadal: tylko critical alert jest blocking
- [ ] Brak kodu 1.3–1.6 w PR
