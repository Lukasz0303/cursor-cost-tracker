# Plan v1.4 — Cost Efficiency Score

**Kanon EN:** [cost-efficiency-score.md](./cost-efficiency-score.md)  
**Plan nadrzędny:** [v1.2-overview.pl.md](./v1.2-overview.pl.md)  
**Status:** gotowy do realizacji  
**Zależność:** preferować 1.3.0 (sekwencyjny MINOR). Import daily-guard ani runaway nie jest wymagany.  
**Następna:** [model-cost-advisor.pl.md](./model-cost-advisor.pl.md) (1.5.0)  
**Wersja:** **1.4.0** (MINOR)

Przy rozjeździe z [prd.md](../../context/prd.md) wygrywa **angielski PRD**.

API usage **nie ma** granicy zadania. Efektywność jest **względna wobec próbki Last N tego użytkownika**, nie twierdzeniem, że zadanie zostało rozwiązane. Nie konkurować z projekcją Optimize `.ai/optimize-savings.md`.

---

## 1. Cel

Na Statistics pokazać **Cost efficiency score 0–100** dla **najnowszej sesji** (zapytania skupione przerwą idle) w porównaniu z własnymi medianowymi sesjami użytkownika w tej samej próbce Last N / From-date.

**Gotowe gdy:**

- Czyste `clusterSessions` + `scoreEfficiency` mają pokrycie Vitest (bez `vscode`).
- Karta Statistics: score, jednozdaniowy werdykt, cztery paski składowych; pusty stan gdy próbka za mała.
- **Nie** na status barze (za gęsto).
- Settings: toggle + idle minutes; `npm test` / `typecheck` zielone.
- Copy nigdy nie mówi „task complete” ani „you wasted $X” jako stała heurystyka.

---

## 2. Poza zakresem

| Element | Dlaczego |
|---------|----------|
| Chip score na status barze | Za tłoczno; tylko Statistics |
| Czat / „czy zadanie rozwiązane?” | Brak transkryptu |
| Absolutny benchmark branżowy | Score jest **względny** wobec tego użytkownika |
| Zastąpienie oszczędności Optimize | Lifetime / mid projection zostają jak są |
| Tosty / modal | Tylko wyświetlanie |
| Zmiana kolumn tabeli Last N | Nie |

---

## 3. Delty PRD

Zakładka Statistics: po cycle facts / przed albo obok metryk próbki Last N, karta **Cost efficiency**.

- Sesje = kolejne zapytania z przerwą ≤ `cursorCost.efficiencyIdleMinutes` (domyślnie **15**, 5–120).
- Score 0–100 dla **najnowszej** sesji vs rozkład sesji w próbce.
- Składowe (równa waga): cache hit, koszt na 1M tokenów, udział spike’ów, $ sesji vs mediana $ sesji podobnej wielkości (suma tokenów ±50%).
- Pusto: mniej niż **5** zapytań albo mniej niż **2** sesje → `Need more queries in this sample to score efficiency.`
- Toggle `cursorCost.efficiencyScore` (domyślnie **true**).
- Niezależne od Optimize. Nie jest prognozą run-out.

---

## 4. Pliki

```
src/efficiency/sessions.ts     # klaster po luce idle
src/efficiency/score.ts        # składowe + 0–100
src/config.ts
src/ui/periodStats.ts          # karta na payload stats
src/ui/historyRows.ts          # payload.efficiency
src/ui/historyPanel.ts
package.json                   # 1.4.0
media/history.html|css|js      # karta Statistics + fieldset Settings
test/efficiencySessions.test.ts
test/efficiencyScore.test.ts
```

Bez nowego kontrolera toastu hosta. Bez zmiany `extension.ts`, chyba że watch config już przebudowuje panel (robi to przez `onDidChangeConfiguration` — zweryfikować; payload podpiąć tylko w `historyDataPayload`).

Aktualizacja PRD, architecture, snapshot, webview rule.

---

## 5. Typy i algorytm

```typescript
export const DEFAULT_EFFICIENCY_IDLE_MINUTES = 15
export const MIN_EFFICIENCY_IDLE_MINUTES = 5
export const MAX_EFFICIENCY_IDLE_MINUTES = 120
export const MIN_EFFICIENCY_QUERIES = 5
export const MIN_EFFICIENCY_SESSIONS = 2
export const SIMILAR_SIZE_RATIO = 0.5 // ±50% tokens

export type QuerySession = {
  queries: UsageQuery[] // oldest → newest inside the session
  firstTimestamp: number
  lastTimestamp: number
  costUsd: number
  tokens: number
  cacheHitPercent: number | null
  spikeSharePercent: number
  costPer1M: number | null
}

export type EfficiencyComponent = {
  id: 'cacheHit' | 'costPer1M' | 'spikeShare' | 'sessionCost'
  label: string
  value: string
  score: number // 0–100 contribution before weight; store 0–100 per component
  hint: string
}

export type EfficiencyPayload = {
  empty: boolean
  emptyReason: string | null
  score: number | null          // 0–100 integer
  verdict: 'ok' | 'tight' | 'over' | null
  summary: string
  sessionQueryCount: number
  sessionCount: number
  idleMinutes: number
  components: EfficiencyComponent[]
}
```

### 5.1 Klaster (`clusterSessions`)

1. Sortować zapytania **oldest first**.
2. Zacząć sesję od pierwszego zapytania.
3. Jeśli `next.timestamp - last.timestamp <= idleMinutes * 60_000`, dopisać; inaczej zacząć nową sesję.
4. Ignorować nietskończone timestampy (nie powinny się pojawić po parse).
5. Zwracać sesje oldest-first; **najnowsza sesja = ostatni element**.

Jedno zapytanie → jedna sesja długości 1.

Cache hit per sesja: `sum(cacheRead) / sum(input + cacheRead)` jako percent, albo `null` jeśli mianownik 0.

Spike share: `count(isSpike(tokens, spikeTokenThreshold)) / queryCount * 100`.

`costPer1M`: `tokens > 0 ? costUsd / tokens * 1e6 : null`.

### 5.2 Score (`scoreEfficiency`)

Jeśli `queries.length < 5` albo `sessions.length < 2` → `{ empty: true, ... }`.

**Najnowsza sesja** to ta z największym `lastTimestamp`.

Dla każdej składowej policzyć rangę 0–100 **wobec innych sesji** (wyżej = lepsza efektywność):

| Składowa | Surowa | Lepiej | Score |
|----------|--------|--------|--------|
| cacheHit | % cache sesji | wyżej | percentyl vs sesje z non-null cache (jeśli brak, score składowej 50 / pominąć ze średniej — **preferować 50**) |
| costPer1M | USD na 1M tokenów | niżej | odwrotny percentyl vs sesje z non-null costPer1M |
| spikeShare | % zapytań spike | niżej | odwrotny percentyl |
| sessionCost | `costUsd` sesji | niżej | odwrotny percentyl vs sesje **podobnej wielkości** (`tokens` w ±50% najnowszej). Jeśli `< 2` peerów z sobą włącznie → składowa 50 |

Percentyl: wśród `n` wartości, ranga `r` od worst=0 do best=n-1, score = `round(100 * r / max(n-1, 1))`. Remisy: średnia ranga.

**Ogółem:** średnia czterech score’ów składowych, zaokrąglona 0–100.

**Werdykt (tylko wyświetlanie):** `>= 70` `ok`; `>= 40` `tight`; inaczej `over`. Kolory wg `showSpikeWarning` (gdy off, karta używa domyślnego tekstu, nadal pokazuje liczbę).

**Przykłady summary (English):**

- ok: `Latest session scores 82 vs your other sessions in this sample.`
- tight: `Latest session scores 51 — near your usual cost mix.`
- over: `Latest session scores 28 — more expensive / less cache than your usual sessions.`

Zawsze dopisać, że to względne wobec Last N, nie ocena zadania.

### 5.3 Clampy

`clampEfficiencyIdleMinutes`: 5–120, default 15, round.

---

## 6. Ustawienia i wiadomości

| Klucz | Typ | Domyślnie |
|-------|-----|-----------|
| `cursorCost.efficiencyScore` | boolean | `true` |
| `cursorCost.efficiencyIdleMinutes` | number | `15` |

Fieldset Settings **Efficiency** po Optimize (analityka, nie ostrzeżenie). Checkbox + idle minutes (Apply / Enter / blur). Hint: “Groups queries into sessions when the gap is larger than this. The score compares your latest session with your other sessions — it does not read the chat.”

Gdy toggle jest off: payload `efficiency` może być `null`; ukryć kartę Statistics.

### 6.1 Payload

`efficiency: EfficiencyPayload | null` (`null` gdy setting off).

Brak nowych typów webview → host poza:

| `type` | Akcja |
|--------|--------|
| `setEfficiencyScore` | boolean |
| `setEfficiencyIdleMinutes` | number |

---

## 7. Powierzchnie UI

### 7.1 Karta Statistics

- Tytuł: **Cost efficiency**
- Hero: całkowity score albo `—` jeśli pusto
- Słowo werdyktu: Efficient / Typical / Costly (`ok` / `tight` / `over`)
- Body: `summary`
- Cztery kompaktowe metery (etykieta składowej + wartość + pasek)
- Pusto: tylko przygaszone body, bez fałszywego 0

Użyć istniejącego CSS glossary / sample card (`--vscode-*`, karty ghost). Nie dodawać serii Charts.

### 7.2 Status bar / Last N / tost

Bez zmian.

### 7.3 Optimize

**Nie** dodawać finding (Optimize zostaje last-red-query). Opcjonalny późniejszy PATCH.

---

## 8. Kroki wdrożenia

| Krok | Praca | Pliki |
|------|--------|--------|
| 1 | Bump `1.4.0`. Klucze `efficiencyScore`, `efficiencyIdleMinutes`. | `package.json` |
| 2 | Clampy config. | `config.ts` |
| 3 | `clusterSessions` + agregaty sesji. | `src/efficiency/sessions.ts` + testy |
| 4 | `scoreEfficiency` percentile + puste stany. | `src/efficiency/score.ts` + testy |
| 5 | `stats` / top-level `efficiency` na payload. | `historyRows.ts`, `periodStats.ts` (albo zbudować w `score.ts` i podpiąć w `historyDataPayload`) |
| 6 | Render karty Statistics. | `media/history.js` + `history.css` + placeholder `history.html` |
| 7 | Fieldset Settings. | `media/history.*`, `historyPanel.ts` |
| 8 | PRD, architecture, snapshot, webview rule. | `.ai/context/*` |

Nie dodawać advisor ani attribution w tym PR. Zostawić **slot** karty Statistics, żeby 1.5 usiadł pod spend-by-model bez walki o layout (efficiency obok metryk próbki Last N).

---

## 9. Testy

Wstrzykiwać timestampy. Nie używać `Date.now()`.

### 9.1 Sesje

- Dwa zapytania 14 min od siebie, idle 15 → **jedna** sesja.
- Dwa zapytania 16 min od siebie → **dwie** sesje.
- Trzy zapytania 0, 10 min, 40 min → sesje 2 + 1.
- Pusto → `[]`.
- Kolejność w sesji oldest → newest nawet jeśli wejście było newest-first.

### 9.2 Score

- 4 zapytania → pusto (`MIN_EFFICIENCY_QUERIES`).
- 5 zapytań, 1 sesja (wszystkie blisko) → pusto (`MIN_EFFICIENCY_SESSIONS`).
- Dwie sesje: najnowsza ma cache 90% vs wcześniejsza 10%, niższy costPer1M, 0 spike’ów, podobne tokeny → score **wysoki** (≥ 70) na deterministycznych fixture.
- Odwrotny fixture → score **niski** (≤ 40).
- Podobny rozmiar: sesja 100 tokenów nie jest peerem sesji 10M tokenów dla `sessionCost`.
- Clamp idle: `4` → 5; `200` → 120.

---

## 10. Bezpieczeństwo

Score używa tylko tokenów/kosztu/cache już na `UsageQuery`. Bez ścieżek, emaili ani promptów.

---

## 11. Kryteria gotowości

- [ ] Wersja **1.4.0**
- [ ] Względny score 0–100 + cztery składowe + pusty stan
- [ ] Tylko Statistics; bez toastu, chipa na pasku, modala
- [ ] Copy: względne wobec próbki, nie „task solved”
- [ ] Toggle Settings + idle minutes
- [ ] `npm test` + `typecheck`
- [ ] Brak kodu 1.5–1.6
