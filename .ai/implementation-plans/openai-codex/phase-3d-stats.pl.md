# Faza 3d — Statistics, Charts, Optimize

**Plan nadrzędny:** [openai-codex.pl.md](./openai-codex.pl.md) §4.6 oraz decyzje 16–19
**Status:** gotowe do implementacji
**Zależy od:** [phase-3c-webview.pl.md](./phase-3c-webview.pl.md)
**Dalej:** [phase-4-pricing.pl.md](./phase-4-pricing.pl.md)
**Angielski:** [phase-3d-stats.md](./phase-3d-stats.md)
**Wydanie:** 1.1.0. Nie podbijać `package.json`.

Gdy ten plik kłóci się z planem nadrzędnym, **wygrywa plan nadrzędny**. Gdy którykolwiek kłóci się z PRD, **wygrywa PRD**.

Jedna wiadomość w Agent. Ruszać tylko ścieżki z §3. Katalogi: tylko `en` i `pl`. Pozostałe locale to następna wiadomość.

---

## 1. Cel

Gdy źródłem jest Codex, Statistics, Charts i Optimize opisują zaimportowane requesty. Nie rysują mierników planu Cursora jako zera. Run Optimize wkleja brief samych danych rozliczeniowych do otwartego czatu Agenta i go nie wysyła.

**Gotowe, gdy:**

- Statistics Codexa chowa mierniki planu Current/Today, burn rate, generated lines i miesięczną prognozę planu.
- Mieszanka tokenów, liczniki, udział wycenionych oraz szacunek API obok ekwiwalentu API renderują się z agregatów SQL.
- Karta kosztu raportowanego renderuje się tylko wtedy, gdy istnieje kwota raportowana.
- Wykresy zostawiają lukę w dniu bez wierszy.
- Podpowiedzi Optimize są oznaczone jako hipotezy. Prognozowane oszczędności są oznaczone jako prognoza.
- `codex.analyze` buduje brief w hoście i wkleja go przez `composer.focusComposer`. Nie woła `composer.openComposer`.
- Źródło Cursor nadal pokazuje obecne sekcje Statistics.

---

## 2. Poza zakresem

| Element | Kiedy |
|---------|--------|
| Zapisane przebiegi analizy i dopasowanie chipa Optimized | faza 7 |
| Wypełnianie cen z katalogu | faza 4. Karty sumują zapisane stringi dziesiętne i pomijają nulle. |
| Siódma zakładka | nigdy |
| Czytanie transkryptu czatu | nigdy |

`src/ui/historyPanel.ts` jest w tej fazie tylko dla gałęzi `codex.analyze`. Faza 3b zostawiła tę gałąź jako stały błąd, żeby nie wpadła w cursorowy optimize.

---

## 3. Pliki

```
src/openaiHistory/historyStats.ts
src/openaiHistory/historyCharts.ts
src/openaiHistory/optimizeBrief.ts
src/ui/historyPanel.ts
media/src/tabs/stats.js
media/src/tabs/optimize.js
media/src/charts/host.js
src/i18n/catalogs/en.ts
src/i18n/catalogs/pl.ts
```

`historyPanel.ts`: podmienić błąd `codex.analyze` z fazy 3b na wklejkę briefu. Nie przestylowywać ścieżki optimize Cursora.

---

## 4. Statistics (`historyStats.ts`)

Wejście to ten sam filtr co `codex.query` bez paginacji. Wyjście to view-model, który webview może narysować bez sumowania wierszy u siebie.

| Karta | Reguła |
|-------|--------|
| Mieszanka tokenów | Sumy input, cached input, output, reasoning. Pomijać nulle. Nie dodawać C ponad I ani R ponad O. |
| Liczniki | Requesty modelu (`attributes_spend = 1`), różne tury, rozmowy. |
| Udział wycenionych | `26/28` z coverage. |
| Szacunek API i ekwiwalent API | Dwie liczby, obok siebie. Nigdy jedna suma. |
| Koszt raportowany | Pominąć kartę, gdy każde `reported_cost_usd` w filtrze jest null. |
| Cache hit | `sum(C) / sum(I)`, gdzie obie wartości są nie-null na tym samym wierszu. Nie średnia procentów wierszy. |

Schować, nie zerować: mierniki planu Current/Today, burn rate, generated lines, miesięczną prognozę planu. Webview rozgałęzia się na `querySource === 'codex-local'` i nie woła rendererów mierników Cursora.

OpenAI `not-connected` zostaje przy zdaniu z fazy 3c. Bez sum Cursora.

---

## 5. Wykresy (`historyCharts.ts`)

Dzienne tokeny i dzienny szacowany koszt dla aktywnego filtra. Jeden punkt na lokalny dzień kalendarzowy, który ma wiersze. Dzień bez wierszy jest nieobecny, więc wykres ma lukę. Nie wstawiać słupka zera.

Webview używa ponownie hosta dziennego SVG. Codex podaje własną serię. Nie podaje cursorowej serii prognozy.

---

## 6. Optimize

### Podpowiedzi

Tylko lokalne hipotezy, każda linia oznaczona jako hipoteza:

- Input urósł względem poprzedniego przypisanego requestu w tym samym wątku.
- Udział cache jest niski (`sum(C) / sum(I)` poniżej stałego progu wyświetlania **0.2** albo C jest null — powiedzieć „cache unknown”, nie mówić „low”).
- Wiele requestów modelu w jednej turze (więcej niż **4** przypisane requesty dzielące `turn_id`).

Brak prognozowanych dolarów, dopóki faza 4 nie ma ceny. Etykieta prognozy i tak mówi forecast, a liczba zostaje `—`, gdy koszt jest null.

### Brief (`optimizeBrief.ts`)

```typescript
export function buildCodexOptimizeBrief(input: {
  depth: 'quick' | 'balanced' | 'deep'
  row: CodexDetailFields
  hints: readonly string[]
}): string
```

String zawiera liczby, identyfikatory, nazwę modelu i linie hipotez. Nie ma promptu, tekstu narzędzia ani ścieżki bezwzględnej. Głębokość zmienia, ile linii podpowiedzi wchodzi (quick: jedna, balanced: wszystkie, deep: wszystkie plus rozbicie tokenów). Nie dodawać instrukcji transkryptu, które każą agentowi czytać czat.

`historyPanel` wkleja ten string do otwartego czatu Agenta przez `composer.focusComposer` i nie wysyła go. Play na wierszu Codexa używa tego samego briefu dla tego wiersza. Nie woła `composer.openComposer`.

Znak `!` używa `isSpike` z `src/spikes/threshold.ts` z `cursorCost.spikeTokenThreshold`. Modal krytyczny nie jest wołany na tej ścieżce.

---

## 7. Testy

Dodać `test/openaiHistoryStats.test.ts` i `test/codexOptimizeBrief.test.ts`.

- Cache hit używa tylko sparowanych wierszy nie-null.
- Szacunek i koszt raportowany zostają osobnymi polami.
- Brakujący dzień kalendarzowy jest nieobecny w serii.
- Zdanie promptu z fixture nie ma go w wyjściu.
- Brief nie zawiera `composer.openComposer`.

`npm test` i `npm run build` raz na końcu.

---

## 8. Przekazanie

Faza 4 zapisuje dziesiętne stringi kosztu, które te karty już sumują. Następna wiadomość po tej, jeśli katalogi nie przechodzą typecheck, to wyłącznie pozostałe locale — nie mieszać z nią fazy 4.
