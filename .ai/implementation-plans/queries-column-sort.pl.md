# Arkusz zapytań — sortowanie kliknięciem nagłówka

**Polski.** Kanoniczny angielski: [queries-column-sort.md](./queries-column-sort.md)
**Rodzic:** [feedback-2026-10-25.pl.md](./feedback-2026-10-25.pl.md)
**Status:** nie zaczęte. Nie wciągać przed otwartym błędem.
**Zależy od:** wierszy Last N (`src/ui/historyRows.ts`) i grup konwersacji (`src/ui/queryGroups.ts`). Samo grupowanie już jest.
**Wersja:** nieustalona.

Przy sprzeczności wygrywa [prd.md](../context/prd.md).

Prośba: w arkuszu zapytań kliknięcie nagłówka sortuje. Działa w liście płaskiej i w zgrupowanej. Eksport CSV trzyma tę kolejność.

Sprawdzone 2026-10-25: nagłówki tabeli Cursora w `media/history.html` to zwykły tekst `<th>`. `buildQueriesCsv` (`src/ui/exportCsv.ts`) zawsze sortuje od najnowszych i ignoruje arkusz. Codex ma już listę sortowania (`#codexSort`), a `codex.exportCsv` dostaje `sort`. Ten plan dotyczy arkusza Cursora. Parytet klikania nagłówków w Codexie jest poza pierwszym kawałkiem.

---

## 1. Cel

Klik TIME, MODEL, CONTEXT, COST, TOKENS, INPUT / OUTPUT albo KIND przestawia wiersze na ekranie. Drugie kliknięcie odwraca kierunek. Aktywny nagłówek ma `aria-sort`.

- **Płasko:** każde widoczne zapytanie idzie według tego klucza.
- **Grupy:** wiersze grup idą według tego klucza na **sumach grupy**. Rozwinięcie pokazuje zapytania grupy tym samym kluczem. Grupowanie zostaje po tytule (`titleGroupKey`). Sortowanie nie przebudowuje grup.
- **Eksport CSV** zapisuje tę samą kolejność zapytań. Nadal jeden wiersz na zapytanie, także przy włączonym grupowaniu. Nie staje się jednym wierszem na konwersację.

**Gotowe, gdy:**

- Jeden komparator w `src/ui/querySort.ts`, Vitest na kolejność płaską, kolejność grup i spłaszczoną kolejność CSV.
- Arkusz i `buildQueriesCsv` wołają ten komparator. Każdy nie wymyśla własnego sortu.
- Brak kliknięcia zostawia najnowsze na górze — dzisiejszą kolejność.
- Eksport z palety poleceń przy zamkniętym panelu zostaje od najnowszych.
- Over Warn at, Optimized i ukrywanie wątków CLI zostają filtrami widoku. CSV nadal eksportuje próbkę, której te filtry nie zawężają. Zmienia się tylko **kolejność**. O to chodziło w „respektuje sortowanie”.

---

## 2. Klucze

Wiersze niosą dziś sformatowane napisy (`cost`, `tokens` z `!` z przodu). Nie sortować po tych napisach. Obok etykiet dodać pola liczbowe na `HistoryRow` i `QueryGroupPayload`:

| Nagłówek | Klucz zapytania | Klucz grupy |
|----------|-----------------|-------------|
| TIME | `timestamp` | najnowszy `timestamp` w grupie |
| MODEL | etykieta modelu | etykieta już stojąca na wierszu grupy |
| CONTEXT | procent kontekstu, brak na końcu | procent kontekstu grupy (najnowsza tura, już w ładunku) |
| COST | `costUsd` | suma `costUsd` |
| TOKENS | `tokens` | suma `tokens` |
| INPUT / OUTPUT | `inputTokens`, potem `outputTokens` | te same sumy |
| KIND | etykieta rodzaju | etykieta już stojąca na wierszu grupy |

Remis, zawsze: nowszy `timestamp` pierwszy, potem pierwotny indeks próbki. Sort jest stabilny przy odświeżeniu, które nie zmienia próbki.

Pierwsze kliknięcie kolumny liczbowej albo czasu sortuje malejąco (największe / najnowsze). Pierwsze kliknięcie MODEL albo KIND sortuje rosnąco. Następne kliknięcie odwraca.

Sort żyje w pamięci otwartego panelu. To nie jest ustawienie `cursorCost.*` i nie przeżywa przeładowania. Po przeładowaniu znowu najnowsze na górze.

---

## 3. Eksport

Eksport na pasku to link `command:`, więc host nie widzi kolejności kliknięć. Kontrolka na pasku ma sprawić, że webview wyśle `{ type: 'exportCsv', sort }` z `{ key, dir }`. Allowlista hosta zostaje `cursorCost.exportCsv` dla palety poleceń.

`saveQueriesCsv` nakłada `sortQueryRows` przed dotychczasowym limitem. Tryb grup: uporządkować grupy przez `sortQueryGroups`, potem spłaszczyć zapytania każdej grupy tym samym kluczem. Plik nadal jest płaski.

Wywołanie z palety albo brak `sort` zostawia `timestamp` malejąco.

Eksport Codexa już przekazuje wartość listy. W tym kawałku Codexa nie ruszać.

---

## 4. Pliki

| Faza | Ścieżki |
|------|---------|
| 1. Rdzeń + Vitest | `src/ui/querySort.ts`, `test/querySort.test.ts`. `buildQueriesCsv` przyjmuje opcjonalny sort i używa helpera. |
| 2. Podpięcie | Pola liczbowe w `src/ui/historyRows.ts` i `src/ui/queryGroups.ts`. Przyciski nagłówków w `media/history.html` (tylko `<thead>` Cursora). Obsługa kliknięcia w `media/src/tabs/queries.js`. Komunikat `exportCsv` w `src/webview/messages.ts` i `src/ui/historyPanel.ts`. Etykiety aria tylko `en` + `pl`. |

Faza 1 nie edytuje `media/`. Nie poprawiać ręcznie `media/history.js`; w turze podpięcia `npm run build` generuje go od nowa.

Rysowanie zostaje w `paintRows` / `paintGroupedRows`. Sortować pamięciowe `tableEvents` / `tableGroups` przed rysowaniem. Nie przestawiać DOM przez przenoszenie `<tr>` po fakcie.

---

## 5. Poza zakresem

| Element | Dlaczego |
|---------|----------|
| Trzymanie kolumny w ustawieniach | Sort sesji wystarcza. Ustawienie to drugi produkt. |
| CSV ograniczone do wierszy Over Warn at / Optimized | Te filtry zostają na ekranie. Zakres eksportu zostaje próbką. |
| Jeden wiersz CSV na grupę | Obecna umowa to płaska lista zapytań. |
| Przyciski nagłówków Codexa | Lista i `sort` w `codex.exportCsv` już się zgadzają. |
| Sortowanie Statistics, Charts albo tabeli cen modeli | Tabela modeli sortuje się sama. |
| Sort wielokolumnowy (Shift-klik) | Jedna kolumna. |

---

## 6. Testy

- Czas malejąco jest tożsamością próbki już ułożonej od najnowszych.
- Koszt malejąco kładzie wiersz 0 $ za wierszem rozliczonym. Równy koszt spada do czasu.
- Sformatowana etykieta `! 1.2M` nigdy nie jest kluczem sortu.
- Dwie grupy: grupa z wyższą **sumą** tokenów jest pierwsza, nawet gdy jej najnowsze zapytanie jest starsze.
- Spłaszczona kolejność CSV równa się kolejności grup, a potem dzieci. Dzieci używają tego samego klucza, nie „najnowsze w grupie”, chyba że kluczem jest TIME.
- Nieznane `key` / `dir` z webview jest odrzucane i host sortuje po czasie malejąco.
