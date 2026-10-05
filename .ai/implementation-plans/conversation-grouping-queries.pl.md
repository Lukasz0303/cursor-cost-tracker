# Plan wdrożenia v1.1 — grupowanie zapytań w rozmowy

**Wersja angielska jest kanoniczna:** [conversation-grouping-queries.md](./conversation-grouping-queries.md)
**Status:** fazy 1–2 wdrożone (core + Vitest + podpięcie UI). Faza 3 (dokumentacja / pozostałe locale) otwarta.
**Zależy od:** id rozmowy i lokalnych tytułów (`src/usage/conversationId.ts`, `src/usage/conversationTitles.ts`, `src/usage/readConversationTitles.ts`, `src/usage/groupConversations.ts`); wiersze Last N już niosą `conversationId` / `conversationTitle` (`src/ui/historyRows.ts`).
**Wersja:** **1.1.0** (MINOR — nowa funkcja dla użytkownika)

Przy konflikcie z [prd.md](../context/prd.md) **wygrywa PRD**.

---

## 1. Cel

Na zakładce **Last N Cursor queries** jeden **przełącznik** w pasku narzędzi zwija pojedyncze żądania w **wiersze rozmów opisane lokalnym tytułem czatu**.

- Przełącznik **wyłączony** (domyślnie): dzisiejsza płaska tabela, nic się nie zmienia.
- Przełącznik **włączony**: jeden zwinięty wiersz na rozmowę (tytuł, liczba żądań, sumy). Kliknięcie rozwija należące do niej żądania w dotychczasowych sześciu kolumnach.

**Gotowe, gdy:**

- Klucz grupowania, etykiety i agregaty siedzą w czystych modułach pokrytych Vitest (bez `vscode`, bez DOM).
- `cursorCost.groupQueriesByConversation` (domyślnie **false**) zapamiętuje przełącznik; przełącznik w pasku i Settings → Recent queries są zsynchronizowane.
- Widok zgrupowany respektuje **Over Warn at**, `!` dla spike’ów i przycisk Optimize.
- Export CSV dalej eksportuje płaskie wiersze żądań.
- Do webview nie trafia treść rozmowy, prompt, cookie ani token.
- `npm test` / typecheck zielone; próbka 10 000 wierszy pozostaje responsywna.

---

## 2. Klucz grupowania (jedyna realna decyzja)

Prośba brzmi „po tytule”, ale tytuł **nie jest unikalny**: dwa czaty mogą nazywać się tak samo, a czat bez wpisu w lokalnym indeksie nie ma tytułu. Kolejność rozstrzygania:

| Przypadek | Klucz | Etykieta wiersza |
|-----------|-------|------------------|
| Żądanie ma id **i** lokalny tytuł | `title:` + znormalizowany tytuł (trim, zbite spacje, lowercase) | tytuł w oryginalnej pisowni (wygrywa pierwsza) |
| Żądanie ma id, **brak** tytułu | `id:` + id rozmowy | `#` + pierwsze 8 znaków id |
| Żądanie **nie ma** id | `ungrouped` | `Ungrouped` |

Dwa czaty o nazwie `Fix login bug` **łączą się w jeden wiersz** — tak użytkownik rozumie „po tytule”. Grupa trzyma zbiór id (`ids: string[]`), a ten zbiór decyduje o możliwości optymalizacji (§6).

Wykorzystujemy istniejące `conversationId` i lookup tytułów. **Nie** tworzymy grup z przerw czasowych.

---

## 3. Poza zakresem

| Element | Dlaczego |
|---------|----------|
| Grupowanie na Statistics / Charts / Optimize | Ten wycinek dotyczy tylko tabeli zapytań |
| Czytanie transkryptów / treści promptów | Non-goal PRD; tytuły z lokalnego indeksu |
| Grupowanie po stronie API | Usage API nie ma drzewa rozmów |
| Zapamiętywanie rozwiniętych grup | Stan tylko na czas sesji webview |
| Grupowanie zagnieżdżone (projekt → rozmowa → żądanie) | Później, jeśli padnie prośba |
| Siódma zakładka, React, nowy modal | Nigdy |

---

## 4. Moduły core (faza 1)

```
src/usage/groupConversations.ts   # dodaj titleGroupKey + tryb groupByTitle
src/ui/queryGroups.ts             # nowy: payload grup dla tabeli
test/groupConversations.test.ts   # rozszerz
test/queryGroups.test.ts          # nowy
```

### 4.1 `src/usage/groupConversations.ts`

Dodaj bez ruszania `groupConversations` (ścieżka Optimize dalej grupuje po id):

```typescript
export type ConversationGroupKey = { key: string; label: string; named: boolean }

export function normalizeConversationTitle(title: string): string

export function titleGroupKey(
  conversationId: string,
  conversationTitle: string,
): ConversationGroupKey
```

Zwykłe stringi, więc korzystają z tego zarówno `UsageQuery`, jak i gotowe wiersze.

### 4.2 `src/ui/queryGroups.ts` (nowy)

```typescript
export type QueryGroupPayload = {
  key: string
  title: string
  named: boolean
  ids: string[]
  queryCount: number
  firstTimestamp: number
  lastTimestamp: number
  rangeLabel: string      // "14:02 → 15:47" w jednym dniu, inaczej "2 Oct → 3 Oct"
  costLabel: string
  tokensLabel: string
  inputOutputLabel: string
  modelsLabel: string     // jeden model albo "claude-4.5 +2"
  kindsLabel: string
  spike: boolean          // którekolwiek dziecko powyżej Warn at
  optimizable: boolean    // dokładnie jedno id i nie jest to 'ungrouped'
  optimizeId: string | null
  optimizeTimestamp: number | null
  /** Indeksy w płaskiej tablicy wierszy, od najnowszych. Dzieci nie są duplikowane. */
  rowIndexes: number[]
}

export function toQueryGroups(
  queries: readonly UsageQuery[],
  options?: QueryGroupOptions,
): QueryGroupPayload[]
```

Wejściem jest `historyRowSample(queries, limit)` — ta sama próbka od najnowszych,
którą renderuje `toHistoryRows` — więc `rowIndexes` pasują do `events` bez drugiego sortowania.

Zasady:

- Grupy sortowane po `lastTimestamp` **malejąco**; remisy po kluczu, żeby render był stabilny.
- `rowIndexes` od najnowszych, aby webview nie sortował ponownie.
- Formatowanie z `src/format.ts` (`formatDollars`, formatter tokenów) — żadnego nowego formatowania liczb.
- Czysta funkcja na wierszach, które tabela już ma: bez drugiego przebiegu po `UsageQuery` i bez czytania bazy.

Vitest pokrywa: kolizja tytułów łączy dwa id, id bez tytułu daje `#ab12cd34`, brak id trafia do `Ungrouped`, spike propaguje się na rodzica, kolejność od najnowszych, pusta lista zwraca `[]`.

---

## 5. Podpięcie (faza 2 — osobna tura)

```
package.json                  # contributes cursorCost.groupQueriesByConversation
src/config.ts                 # klucz + domyślne false
src/ui/historyRows.ts         # payload.queryGroups + payload.groupQueriesByConversation
src/ui/historyPanel.ts        # obsługa setGroupQueriesByConversation
media/history.html|css|js     # przełącznik, wiersze grup, zwijanie
src/i18n/catalogs/en.ts|pl.ts # etykiety (reszta locale w kolejnej turze)
```

Host → webview dochodzi `groupQueriesByConversation: boolean` i `queryGroups: QueryGroupPayload[]`.
Webview → host dochodzi `{ type: 'setGroupQueriesByConversation', value }`.

`queryGroups` liczymy zawsze (jeden tani przebieg), więc przełączenie nie wymaga rundy po dane.

---

## 6. Zachowanie webview

- **Przełącznik** w pasku zapytań obok **Over Warn at**, ten sam styl ghost/pill, etykieta `Group by conversation`. Lustrzany checkbox w Settings → Recent queries; oba wysyłają tę samą wiadomość.
- **Wiersz grupy** na całą szerokość tabeli: chevron + tytuł (+ `!`, gdy któreś dziecko przekracza Warn at), dalej liczba żądań, suma kosztu, suma tokenów, input/output, skrót modeli. Monospace, od najnowszych, te same reguły kolorów (nic czerwonego, gdy Show warnings jest wyłączone).
- **Rozwinięcie** renderuje dzieci leniwie w `<tbody>` pod wierszem grupy, w normalnych sześciu kolumnach, z jednym wcięciem. Zwinięcie je usuwa. Rozwinięte klucze trzymamy w `Set` w pamięci webview; po odświeżeniu zostają te, które nadal istnieją.
- **Over Warn at** w trybie grup: grupa jest widoczna, gdy ma co najmniej jedno czerwone dziecko; po rozwinięciu widać tylko czerwone dzieci, a licznik zmienia się na `3 / 12`.
- **Przycisk Optimize**: na wierszach dzieci bez zmian. Na wierszu grupy pojawia się tylko gdy `optimizable` (jedno id) i wysyła to samo `{ type: 'optimizeConversation', id, timestamp }` z najnowszym timestampem grupy. Grupa scalona z dwóch id nie ma przycisku — brief dla dwóch czatów byłby błędny.
- **Export CSV** bez zmian: zawsze płaskie wiersze.
- **Brak tytułów** (brak indeksu, np. Remote SSH) → grupy i tak powstają po id z etykietami `#abcd1234` plus jednolinijkowa podpowiedź, że tytuły pochodzą z lokalnego magazynu Cursora.

---

## 7. Wydajność

- Jeden przebieg na zbudowanie grup, jeden na render wierszy grup; dzieci dopiero po rozwinięciu.
- Przy `historyLimit = 10000` widok grup renderuje najwyżej kilkaset wierszy — taniej niż dzisiejsza płaska tabela.
- Zero dodatkowych odczytów `state.vscdb`: tytuły są już pobierane dla `conversationTitle`.

---

## 8. Zmiany w PRD (faza 3)

- Nowe ustawienie `cursorCost.groupQueriesByConversation` (domyślnie **false**) w sekcji Recent queries.
- Opis zakładki Last N dostaje tryb zgrupowany, tabelę kluczy z §2 i regułę przycisku Optimize z §6.
- Powtórzony non-goal: grupowanie czyta wyłącznie id i lokalne tytuły, nigdy treści wiadomości.

Historyjki:

- C1: Włączony przełącznik → żądania z jednego czatu zwijają się w jeden wiersz z tytułem; sumy zgadzają się z dziećmi.
- C2: Dwa czaty o tej samej nazwie zwijają się w jeden wiersz; ten wiersz nie ma przycisku play.
- C3: Żądanie bez id rozmowy trafia do `Ungrouped` i nigdy nie dostaje briefu.
- C4: Over Warn at + grupowanie pokazuje tylko rozmowy z czerwonym żądaniem.
- C5: Przełącznik przeżywa przeładowanie (ustawienie), stan rozwinięcia nie.

---

## 9. Fazy

| Faza | Zakres | Ścieżki |
|------|--------|---------|
| 1 | Core + Vitest | `src/usage/groupConversations.ts`, `src/ui/queryGroups.ts`, `test/groupConversations.test.ts`, `test/queryGroups.test.ts` |
| 2 | Podpięcie UI | `package.json`, `src/config.ts`, `src/ui/historyRows.ts`, `src/ui/historyPanel.ts`, `media/history.*`, katalogi `en`/`pl` |
| 3 | Dokumentacja / reguły | PRD, README, CHANGELOG, architecture, codebase-snapshot, `.cursor/rules/extension-webview.mdc`; pozostałe locale |

Jedna faza na turę Agenta ([optimize-split-minor-features.mdc](../../.cursor/rules/optimize-split-minor-features.mdc)). VSIX / podbicie wersji to osobna krótka wiadomość.

---

## 10. Lista akceptacyjna

- [ ] `titleGroupKey` + `toQueryGroups` czyste i pokryte Vitest (kolizja, brak tytułu, ungrouped, spike, kolejność)
- [ ] `cursorCost.groupQueriesByConversation` domyślnie false, przełącznik i Settings zsynchronizowane
- [ ] Sumy grup równe sumom dzieci
- [ ] Over Warn at, `!` i reguły kolorów działają w trybie grup
- [ ] Play tylko na grupach z jednym id; przyciski dzieci bez zmian
- [ ] Export CSV bez zmian
- [ ] Brak promptów / cookie / tokenów w payloadzie
- [ ] `npm test` i typecheck zielone
