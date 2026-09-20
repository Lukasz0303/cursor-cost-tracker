# Plan v1.3 — Daily Spend Guard

**Kanon EN:** [daily-spend-guard.md](./daily-spend-guard.md)  
**Plan nadrzędny:** [v1.2-overview.pl.md](./v1.2-overview.pl.md)  
**Status:** gotowy do realizacji  
**Zależność:** wydane 1.2.0 ([runaway-agent-detector.pl.md](./runaway-agent-detector.pl.md)) *albo* 1.0.3+ jeśli 1.2 jest pominięte — ta funkcja **nie** importuje modułów runaway. Preferować wydanie po 1.2, żeby numery MINOR zostawały sekwencyjne.  
**Następna:** [cost-efficiency-score.pl.md](./cost-efficiency-score.pl.md) (1.4.0)  
**Wersja:** **1.3.0** (MINOR)

Przy rozjeździe z [prd.md](../../context/prd.md) wygrywa **angielski PRD**. PRD aktualizować w tym samym PR.

Cursor już liczy **plan pace** daily budget: `dailyBudgetUsd = remainingUsd / workingDaysLeft` (albo dni kalendarzowe). To **nie** jest cap użytkownika. Użytkownicy chcą twardego osobistego limitu ($5 / $10 / $20), który nadal **nie potrafi zatrzymać agenta**.

---

## 1. Cel

Użytkownik ustawia **dzienny cap w dolarach**. Gdy suma eventów dnia (`todayUsedUsd`) przekroczy 80% i 100% tego capu, pokazać **nie-modalny** tost raz na lokalny dzień na próg, poczerwienić chip Today od 80%, i pokazać meter na Statistics osobno od plan pace.

**Gotowe gdy:**

- `dailySpendLimitUsd === 0` (domyślnie) → zachowanie identyczne z 1.2 / 1.0.3 (Today nadal używa plan `dailyBudgetUsd`).
- Cap > 0 → chip Today `used $ / cap $`; Pro nadal działa (cap jest w dolarach z eventów, nawet jeśli Current jest w %).
- Tosty: 80% raz, 100% raz, per lokalne `YYYY-MM-DD`; nigdy `{ modal: true }`.
- Copy: **Warning only — Cursor will keep running.**
- Presety Settings Off / $5 / $10 / $20 / custom; `npm test` / `typecheck` zielone.

---

## 2. Poza zakresem

| Element | Kiedy / dlaczego |
|---------|------------------|
| Blocking modal | G5 — tylko critical alert |
| Zatrzymanie agenta albo blokada nowych czatów | Niemożliwe |
| Zastąpienie matematyki MTD / monthly forecast | Forecast zostaje na plan `dailyBudgetUsd` / included % |
| Runaway burn-vs-remaining-cap | Opcjonalny późniejszy PATCH; nie wymagane w 1.3 |
| Dzienny cap w included-% dla Pro | Cap jest w **dolarach** (`todayUsedUsd`), nie w % puli |
| Auto-włączenie capu $10 przy upgrade | Zero-setup: default zostaje `0` |

---

## 3. Delty PRD (wdrożyć razem z kodem)

Rozróżnić dwa dzienne numery:

| Liczba | Źródło | Rola |
|--------|--------|------|
| Plan daily budget | `dailyBudgetUsd` z remaining ÷ pace days | Chip Today **gdy user cap jest off**; MTD / forecast bez zmian |
| User daily cap | `cursorCost.dailySpendLimitUsd` | Chip Today **gdy > 0**; tosty Guard + meter Statistics „Daily cap” |

Nowy podrozdział **Daily spend guard:**

- Setting `dailySpendLimitUsd` (domyślnie **0** = off; min 0,01 $ gdy on; max 10_000 $).
- Presety w Settings: Off, 5, 10, 20 albo custom.
- Używa lokalnego kalendarza `todayUsedUsd` (parse już jest w lokalnym TZ).
- Przy ≥ 80% capu: werdykt `tight`, tost nie-modalny raz tego lokalnego dnia.
- Przy ≥ 100%: werdykt `over`, drugi tost raz tego dnia.
- Niezależne od `showCriticalAlert`. Wizualna czerwień na Today wg `showSpikeWarning` (gdy warnings off: brak zielonego/czerwonego na pasku; tosty nadal honorują `dailySpendGuardToast` — zob. §6).
- Nie zatrzymuje Cursora.

G5 bez zmian.

Historyjki (np. D1–D5): off = stare Today; cap 10 $ pokazuje `3.79 $ / 10.00 $`; tost przy 8 $; tost przy 10 $ tego samego dnia bez powtórki; następny lokalny dzień może znowu toastować; Pro % Current bez zmian.

---

## 4. Pliki

```
src/dailySpendLimit.ts         # clampy, werdykt, klucz daty lokalnej, decide toast
src/ui/dailySpendAlert.ts      # kontroler hosta (nie-modalny)
src/config.ts
src/ui/statusBarView.ts        # etykieta + ton Today gdy cap on
src/ui/statusBar.ts
src/ui/statusBarTooltip.ts     # opcjonalna linia: user cap vs plan pace
src/ui/periodStats.ts          # meter Daily cap vs plan Today
src/ui/mtdPace.ts              # NIE zmieniać bazy forecastu
src/ui/historyRows.ts          # pola payload
src/ui/historyPanel.ts
src/extension.ts
package.json                   # 1.3.0
media/history.html|css|js      # fieldset Settings, meter Statistics
test/dailySpendLimit.test.ts
test/dailySpendDecide.test.ts
```

Aktualizacja PRD, architecture, snapshot, webview rule.

---

## 5. Typy i algorytm (`src/dailySpendLimit.ts`)

Bez `vscode`. Wstrzykiwać `now` / `todayUsedUsd`.

```typescript
export const DAILY_SPEND_LIMIT_OFF = 0
export const DEFAULT_DAILY_SPEND_LIMIT_USD = 0
export const MIN_DAILY_SPEND_LIMIT_USD = 0.01
export const MAX_DAILY_SPEND_LIMIT_USD = 10_000
export const DAILY_SPEND_TIGHT_RATIO = 0.8
export const DAILY_SPEND_PRESETS_USD = [5, 10, 20] as const

export const DAILY_SPEND_TOAST_STATE_KEY = 'cursorCost.dailySpendToast'

export type DailySpendVerdict = 'off' | 'ok' | 'tight' | 'over'

export type DailySpendState = {
  limitUsd: number
  usedUsd: number
  remainingUsd: number | null
  ratio: number | null
  verdict: DailySpendVerdict
  localDate: string // YYYY-MM-DD
}

export type DailySpendToastState = {
  date: string
  tight: boolean
  over: boolean
}

export type DailySpendDecision =
  | { kind: 'skip' }
  | { kind: 'remember'; state: DailySpendToastState }
  | { kind: 'alert'; level: 'tight' | 'over'; state: DailySpendToastState }
```

### 5.1 Clamp

- Non-finite / ujemne → `0`.
- `0` zostaje off (nie coerce’ować do 0.01).
- `0 < x < 0.01` → `0.01`.
- Zaokrąglenie do centów: `Math.round(x * 100) / 100`.
- Cap przy `10_000`.

### 5.2 Werdykt

`used` = `todayUsedUsd` (traktuj `null` jako dzień bez eventów → `ok` jeśli cap on i used 0, albo `off` jeśli snapshot ma `todayUsedUsd === null` bo fetch today się nie udał — **nie toastować** przy nieznanym today).

```
if limit <= 0 → off
if todayUsedUsd === null → skip toasts; werdykt off-for-chip (zostaw plan Today)
if used / limit >= 1 → over
if used / limit >= 0.8 → tight
else → ok
```

`remainingUsd = max(0, limit - used)` gdy cap on.

### 5.3 Klucz daty lokalnej

`localDateKey(now: Date): string` → `YYYY-MM-DD` w **lokalnym** TZ (ta sama reguła co `sumTodayUsedUsd`). Nie używać daty UTC.

### 5.4 Decyzja toastu

Wejścia: `verdict`, `localDate`, poprzedni `DailySpendToastState | undefined`, `toastsEnabled`.

| Warunek | Wynik |
|---------|--------|
| werdykt `off` albo `ok` | `remember` z `{ date: localDate, tight: false, over: false }` jeśli data się przewinęła (reset flag) albo `skip` jeśli już ten pusty stan |
| `toastsEnabled === false` | `remember` flagi jakby pokazane (włączenie tostów w ciągu dnia nie zrzuca starego 100%) **albo** `remember` bez ustawiania flag — wybrać **ustaw flagi** (bez opóźnionej niespodzianki) i przetestować |
| previous.date ≠ localDate | traktować previous jako puste |
| `tight` i `!previous.tight` | `alert` poziom `tight`, persist `tight: true` |
| `over` i `!previous.over` | `alert` poziom `over`, persist `over: true` (tight może już być true) |
| poziom już oflagowany | `skip` |

Skok z 0 $ → 10 $ w jednym pollu: werdykt `over`. Odpalić **jeden** tost `over` (nie tight potem over). Jeśli used ≥ 100%, pominąć tost tight. Jeśli used jest 80–99.99%, tylko tight.

### 5.5 Etykieta chipa Today

Gdy cap on i `todayUsedUsd !== null`:

```
$(calendar) {formatDollars(used)} / {formatDollars(limit)}
```

Ten sam formatter co plan Today (`3.79 $ / 10.00 $`). Plan Unlimited + user cap: nadal pokazać cap (użytkownik chciał osobisty limit). Plan `isUnlimited` obecnie ukrywa Today — **zostawić ukrywanie Today gdy unlimited ORAZ cap jest off**. Gdy unlimited **i** cap > 0, **pokazać Today** względem user cap (udokumentować w PRD: osobisty cap nadpisuje hide-Today). Jeśli to za zaskakujące, alternatywa: zostawić hide Today na unlimited i pokazać tylko meter Statistics — **preferować show Today gdy cap > 0**, żeby Guard był widoczny.

Ton: `ok` → `okColor`; `tight` albo `over` → `warnColor` gdy `showSpikeWarning`. Gdy warnings off: ton domyślny, bez czerwieni.

Plan pace `dailyBudgetUsd` zostaje na glossary Statistics / MTD, nie na chipie gdy cap jest on.

---

## 6. Ustawienia i wiadomości

| Klucz | Typ | Domyślnie | Uwagi |
|-------|-----|-----------|--------|
| `cursorCost.dailySpendLimitUsd` | number | `0` | 0 = off |
| `cursorCost.dailySpendGuardToast` | boolean | `true` | Niezależne od toggle critical-alert. Gdy false: brak tostów; kolory chipa nadal wg `showSpikeWarning`. |

Fieldset Settings **Daily spend guard** po **Monthly budget** (oba związane z budżetem).

Kontrolki:

- Select: Off / $5 / $10 / $20 / Custom
- Number input pokazany dla Custom (i bieżącej wartości jeśli nie jest presetem)
- Checkbox: Show daily cap warnings (mapuje na `dailySpendGuardToast`)
- Hint: “A personal daily dollar limit. It does not stop Cursor. Plan pace (remaining ÷ working days) stays on Statistics.”

Apply / Enter / blur na liczbie custom (częściowe `2` podczas wpisywania `20` nie może zapisać się jako 2 — ta sama lekcja co Show last).

### 6.1 Payload

```typescript
dailySpendLimitUsd: number
dailySpendGuardToast: boolean
dailySpend: {
  verdict: DailySpendVerdict
  usedUsd: number
  limitUsd: number
  remainingUsd: number | null
  percent: number
  body: string
} | null  // null when off
```

Sample `statusBarPreview`: gdy cap w Settings to preset > 0, preview Today jako `3.79 $ / 10.00 $` (przykładowy used, skonfigurowany cap), żeby sample zgadzał się z edytorem.

### 6.2 Webview → host

| `type` | Akcja |
|--------|--------|
| `setDailySpendLimitUsd` | number (0 albo ≥ 0.01) |
| `setDailySpendGuardToast` | boolean |

---

## 7. Powierzchnie UI

### 7.1 Tost (`src/ui/dailySpendAlert.ts`)

`showWarningMessage` **bez** modala.

- Tight: `Today’s spend is 8.00 $ of your 10.00 $ daily cap.` + `Warning only — Cursor will keep running.`
- Over: `Today’s spend is 10.50 $ — over your 10.00 $ daily cap.` + ten sam disclaimer.

Akcje: **Open Statistics** (`cursorCost.showHistory` z zakładką Statistics — jak klik Current/Today). Bez Snooze (flagi daty już raz-na-dzień).

Kontroler: subskrypcja snapshot + config; persist `DAILY_SPEND_TOAST_STATE_KEY`; guard `showing`; rejestracja w `extension.ts`. Nie `await` w `activate()`.

### 7.2 Status bar

Etykieta + ton chipa Today jak §5.5. Tooltip: dodać jeden wiersz **Daily cap** `used / limit` gdy cap on, zostawić metery planu jak są.

### 7.3 Statistics

Nowa karta / meter w stylu glossary **Daily cap** gdy `dailySpend !== null`:

- Tytuł: `Daily cap`
- Wartość: `8.00 $ / 10.00 $`
- Body: `Personal limit for this local day. Does not stop Cursor. Plan pace stays below.`
- Percent paska: `used/limit` obcięty do 100 na wypełnienie; `over` z `--cost-warn`.
- Zostawić istniejące glossary Today (plan pace / Pro %). Nie zastępować.

### 7.4 Last N / Charts / Optimize

Bez wymaganego zmian. Nie dodawać finding.

---

## 8. Kroki wdrożenia

| Krok | Praca | Pliki |
|------|--------|--------|
| 1 | Bump `1.3.0`. Klucze `dailySpendLimitUsd`, `dailySpendGuardToast`. | `package.json` |
| 2 | Clampy + pola config. | `src/dailySpendLimit.ts`, `config.ts` |
| 3 | `verdict` + `localDateKey` + `decideDailySpendToast`. | `dailySpendLimit.ts` + testy |
| 4 | Etykieta/ton chipa Today + preview + linia tooltip. | `statusBarView.ts`, `statusBar.ts`, `statusBarTooltip.ts` |
| 5 | `DailySpendAlertController`. | `src/ui/dailySpendAlert.ts`, `extension.ts` |
| 6 | Payload + meter Statistics. | `historyRows.ts`, `periodStats.ts` |
| 7 | Fieldset Settings (presety + custom + checkbox toastu). | `media/history.*`, `historyPanel.ts` |
| 8 | Unlimited + cap > 0 nadal pokazuje Today (testy + PRD). | `statusBarView.ts`, testy parse/UI |
| 9 | PRD, architecture, snapshot, webview rule. | `.ai/context/*`, `.cursor/rules/*` |

Nie dodawać efficiency / advisor / attribution w tym PR. Nie zmieniać forecastu `mtdPace` na user cap (monthly forecast zostaje plan-based).

---

## 9. Testy

Wstrzykiwać `now` i `todayUsedUsd`. Lokalny TZ: konstruować `Date` z lokalnym Y-M-D.

### 9.1 Clamp / werdykt

- `0` → off; `-1` → off; `0.001` → 0.01; `10.456` → 10.46; `20000` → 10000.
- used 7.99 / limit 10 → `ok`; 8.00 → `tight`; 10.00 → `over`; 10.01 → `over`.
- `todayUsedUsd === null` → brak ścieżki toastu (decyzja `skip` albo remember bez alert).

### 9.2 Decide

- Nowy dzień, used 8/10 → jeden alert `tight`; drugi poll tego samego dnia → `skip`.
- Ten sam dzień, used skacze 7 → 11 → jeden alert `over` (bez tight).
- tight już oflagowany, potem over → alert `over` raz.
- Data się przewija `2026-09-11` → `2026-09-12`, used 9/10 → znowu `tight`.
- `toastsEnabled: false` przy over → brak `alert`; włączenie później tego samego dnia → nadal brak `alert` (flagi ustawione).

### 9.3 Chip

- Cap off: Team Today nadal `used / dailyBudgetUsd`.
- Cap 10: `3.79 $ / 10.00 $` niezależnie od plan daily 11.19.
- Warnings off: ton default nawet jeśli over.

---

## 10. Bezpieczeństwo

Tost i payload używają tylko kwot dolarowych już na `UsageReady`. Bez emaila, tokenu ani cookie.

---

## 11. Kryteria gotowości

- [ ] Wersja **1.3.0**
- [ ] Domyślny cap off; presety 5/10/20/custom
- [ ] Chip Today używa user cap gdy ustawiony; plan pace zostaje na Statistics / MTD
- [ ] Tosty nie-modalne raz dziennie przy 80% i 100% (100% tylko jeśli skok pomija 80%)
- [ ] Copy disclaimera
- [ ] Cap dolarowy działa na Pro; unlimited + cap pokazuje Today
- [ ] `npm test` + `typecheck`
- [ ] Bez extra blocking modala; bez kill-switcha agenta
- [ ] Brak kodu 1.4–1.6
