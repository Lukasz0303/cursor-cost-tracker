# Plan v1.5 — Model Cost Advisor

**Kanon EN:** [model-cost-advisor.md](./model-cost-advisor.md)  
**Plan nadrzędny:** [v1.2-overview.pl.md](./v1.2-overview.pl.md)  
**Status:** gotowy do realizacji  
**Zależność:** preferować 1.4.0, żeby stos kart Statistics był stabilny. Import efficiency nie jest wymagany.  
**Następna:** [project-cost-attribution.pl.md](./project-cost-attribution.pl.md) (1.6.0)  
**Wersja:** **1.5.0** (MINOR)

Przy rozjeździe z [prd.md](../../context/prd.md) wygrywa **angielski PRD**.

Statistics już ma spend **by model** ([periodStats.ts](../../../src/ui/periodStats.ts), [modelBreakdown.ts](../../../src/ui/modelBreakdown.ts)). Advisor odpowiada: *przy tej wielkości tury w tokenach, który model był tańszy w **Twojej** próbce?* **Nigdy** nie wolno zmyślać cennika listowego Cursor.

---

## 1. Cel

Pokazać kartę Statistics (pod spend-by-model) z co najwyżej kilkoma wskazówkami **opartymi na dowodach**: ten sam kubełek tokenów, ≥ 3 requesty na model, ≥ 2 modele w tym kubełku, średni $ na request ≥ 20% niższy.

**Gotowe gdy:**

- Czyste `adviseModels` + Vitest (bez `vscode`, bez zahardkodowanych tabel $/1M).
- Karta + opcjonalny finding Optimize; toggle w Settings.
- Copy pustego stanu, gdy próbka nie daje porównania.
- `npm test` / `typecheck` zielone.

---

## 2. Poza zakresem

| Element | Dlaczego |
|---------|----------|
| Oficjalny cennik Cursor / scraping sieci | Nieoficjalny, się starzeje, myli included vs usage-based |
| Rekomendowanie modelu, którego user nigdy nie użył | Brak dowodu |
| Auto-przełączanie modeli w Cursorze | Nie jest API, którego powinniśmy wołać |
| Status bar | Tylko Statistics (+ opcjonalny finding Optimize) |
| Tost / modal | Tylko wyświetlanie |
| Porady tylko po kind bez kubełków tokenów | Kubełek jest proxy „typu pracy” (brak transkryptu) |

---

## 3. Delty PRD

Statistics: **Model cost advisor** pod paskami by-model.

- Kubełki tokenów: `<50k`, `50–500k`, `500k–2M`, `≥2M` (łącznie `UsageQuery.tokens`).
- Per kubełek, grupa po `stripModelPrefix(model)` (`null` → `unknown`).
- Porada tylko jeśli **dwa** modele w kubełku mają po **≥ 3** requesty.
- Porównanie **średniego `costUsd` na request** w tym kubełku (nie cennik). Linia dodatkowa: średnie tokeny i średni koszt na 1M w kubełku (informacyjnie).
- Pokazać tip gdy średni koszt requestu tańszego modelu jest **≥ 20% niższy**.
- Cap **3** tipy (najpierw najwyższe oszczędności: `(expensiveAvg - cheapAvg) * cheapCount` **nie** jest wymagane; sortować po **procencie zaoszczędzonym**, potem po wielkości próbki).
- Toggle `cursorCost.modelAdvisor` (domyślnie **true**).
- Copy: `For 50–500k turns, composer-2 averaged 0.12 $ vs claude-4.6-sonnet 0.45 $ (n=8 / n=5).`
- Disclaimer: `Based on your Last N sample, not Cursor’s price list.`

---

## 4. Pliki

```
src/advisor/bands.ts           # id kubełka + etykieta
src/advisor/advise.ts          # agregacja + tipy
src/config.ts
src/ui/periodStats.ts          # opcjonalnie: by-model bez zmian
src/ui/historyRows.ts          # payload.advisor
src/ui/optimizeInsights.ts     # opcjonalny pierwszy finding
src/ui/historyPanel.ts
package.json                   # 1.5.0
media/history.html|css|js
test/advisorBands.test.ts
test/adviseModels.test.ts
```

Aktualizacja PRD, architecture, snapshot, webview rule.

---

## 5. Typy i algorytm

```typescript
export const ADVISOR_MIN_REQUESTS = 3
export const ADVISOR_MIN_MODELS = 2
export const ADVISOR_MIN_SAVINGS_RATIO = 0.2 // 20%
export const ADVISOR_MAX_TIPS = 3

export type TokenBandId = 'micro' | 'small' | 'medium' | 'large'

export type TokenBand = {
  id: TokenBandId
  label: string // "50–500k"
  minTokens: number // inclusive
  maxTokens: number | null // exclusive; null = no upper bound
}

export const TOKEN_BANDS: readonly TokenBand[] = [
  { id: 'micro', label: '<50k', minTokens: 0, maxTokens: 50_000 },
  { id: 'small', label: '50–500k', minTokens: 50_000, maxTokens: 500_000 },
  { id: 'medium', label: '500k–2M', minTokens: 500_000, maxTokens: 2_000_000 },
  { id: 'large', label: '≥2M', minTokens: 2_000_000, maxTokens: null },
]

export type AdvisorModelStats = {
  model: string
  requests: number
  costUsd: number
  tokens: number
  avgCostUsd: number
  avgCostPer1M: number | null
}

export type AdvisorTip = {
  bandId: TokenBandId
  bandLabel: string
  cheaper: AdvisorModelStats
  expensive: AdvisorModelStats
  savingsRatio: number // (exp - cheap) / exp, 0–1
  summary: string
}

export type AdvisorPayload = {
  empty: boolean
  emptyReason: string | null
  tips: AdvisorTip[]
  note: string
}
```

### 5.1 Przypisanie kubełka

`bandForTokens(tokens: number): TokenBand`  
`50_000` należy do **small** (min inclusive, max exclusive). Ujemne / NaN tokeny → pominąć zapytanie.

### 5.2 Agregacja

Dla każdego kubełka Map model → { requests, costUsd, tokens }. Odrzucić modele z `requests < 3`. Odrzucić kubełki z `< 2` pozostałymi modelami.

### 5.3 Tipy

Dla każdego pozostałego kubełka:

- Sortować modele po `avgCostUsd` rosnąco.
- `cheaper = models[0]`, `expensive = models[models.length - 1]` (najszersza luka). Jeśli więcej niż dwa, nadal jeden tip na kubełek: najtańszy vs **najdroższy** (najczytelniejsza historia na Reddit). Nie emitować tipu dla każdej pary (szum).
- `savingsRatio = (expensive.avgCostUsd - cheaper.avgCostUsd) / expensive.avgCostUsd` gdy expensive avg > 0.
- Jeśli `savingsRatio < 0.2` pominąć kubełek.
- Jeśli oba avg są 0 (eventy included 0 $) pominąć — nie ma lekcji dolarowej.

Sortować tipy po `savingsRatio` malejąco, potem po `cheaper.requests + expensive.requests` malejąco. Slice do 3.

`summary`:  
`For ${bandLabel} turns, ${cheaper.model} averaged ${formatDollars(cheaper.avgCostUsd)} vs ${expensive.model} ${formatDollars(expensive.avgCostUsd)} (n=${cheaper.requests} / n=${expensive.requests}).`

`note`: `Based on your Last N sample, not Cursor’s price list.`

Powody pustki:

- brak zapytań → `No queries in this sample.`
- tylko jeden model ogółem → `Need at least two models in the same size band.`
- modele istnieją, ale żaden kubełek nie ma 2× ≥3 requestów → `Need at least 3 requests per model in the same size band.`
- kubełki się porównują, ale oszczędność < 20% → `Models in the same size band cost about the same in this sample.`

### 5.4 Included vs usage-based

**Nie** splituj tipów po `kind` w 1.5 (included 0 $ vs usage-based uczyniłoby „tańszy” trywialnym). Użycie **średniego $ na request** już traktuje modele included 0 $ jako tańsze — to uczciwe wobec rachunku użytkownika. Wspomnieć w hicie karty: requesty included mogą pokazywać 0.00 $.

---

## 6. Ustawienia i wiadomości

| Klucz | Typ | Domyślnie |
|-------|-----|-----------|
| `cursorCost.modelAdvisor` | boolean | `true` |

Settings: checkbox na fieldsecie **Efficiency** **albo** mały fieldset **Advisor** pod ustawieniami związanymi ze Statistics. Preferować **jeden fieldset „Insights”** zawierający Efficiency (jeśli 1.4 jest) + checkbox Model advisor — tylko jeśli to nie przepisuje Settings 1.4 bardziej niż o jedną linię. Inaczej osobny fieldset **Model advisor** po Efficiency.

Gdy off: `advisor: null`, ukryć kartę i finding Optimize.

| `type` | Akcja |
|--------|--------|
| `setModelAdvisor` | boolean |

Payload: `modelAdvisor: boolean`, `advisor: AdvisorPayload | null`.

---

## 7. Powierzchnie UI

### 7.1 Statistics

Karta **Model cost advisor** **poniżej** pasków by-model (naturalne rozszerzenie). Lista `tips[].summary`. Stopka `note`. Pusto: body = `emptyReason`.

Bez nowego wykresu.

### 7.2 Optimize

Jeśli istnieje `tips[0]`, dopisać finding `{ id: 'model-advisor', label: 'Cheaper model in sample', detail: tips[0].summary }`. Nie zmieniać szablonów promptu.

### 7.3 Status bar / Last N / tost

Bez zmian.

---

## 8. Kroki wdrożenia

| Krok | Praca | Pliki |
|------|--------|--------|
| 1 | Bump `1.5.0`. Klucz `modelAdvisor`. | `package.json` |
| 2 | Boolean config. | `config.ts` |
| 3 | Kubełki + testy przypisania (granice 49999 / 50000 / 2M). | `src/advisor/bands.ts` |
| 4 | `adviseModels` puste + przypadki tipów. | `src/advisor/advise.ts` + testy |
| 5 | Payload + render Statistics. | `historyRows.ts`, `media/history.*` |
| 6 | Opcjonalny finding Optimize. | `optimizeInsights.ts` albo `optimizePayload.ts` |
| 7 | Checkbox Settings. | `media/history.*`, `historyPanel.ts` |
| 8 | PRD, architecture, snapshot, webview rule. | `.ai/context/*` |

Nie dodawać attribution ani kolumn CSV. Nie dodawać `prices.ts` ze zmyślonymi stawkami.

---

## 9. Testy

Użyć `formatDollars` w oczekiwanych summary albo asertować pola strukturalne `AdvisorTip` i osobno zsnapshotować helper summary.

- `bandForTokens(0)` micro; `49999` micro; `50000` small; `499999` small; `500000` medium; `1999999` medium; `2000000` large.
- Dwa modele × 3 requesty w kubełku small, avg 0.10 $ vs 0.50 $ → jeden tip, ratio 0.8, nazwa tańszego się zgadza.
- To samo, ale 2 requesty na tanim modelu → brak tipu (min 3).
- Tylko jeden model → powód pustki „two models”.
- Oba avg 0 $ → brak tipu.
- 10% oszczędności → brak tipu (`< 0.2`).
- Cztery kubełki z tipami → zwrócone tylko 3, najwyższy ratio pierwszy.
- Etykieta `unknown` gdy `model === null`.

Bez sieci. Bez tabeli cen.

---

## 10. Bezpieczeństwo

Nazwy modeli z API usage (już pokazywane w Last N). Escape w webview tak samo jak etykiety by-model. Bez emaili.

---

## 11. Kryteria gotowości

- [ ] Wersja **1.5.0**
- [ ] Tipy tylko z próbki użytkownika; bez zmyślonych cen
- [ ] Min 3 requesty × 2 modele × 20% oszczędności; max 3 tipy
- [ ] Karta Statistics pod by-model; opcjonalny finding Optimize
- [ ] Puste stany pokryte
- [ ] `npm test` + `typecheck`
- [ ] Brak kodu 1.6
