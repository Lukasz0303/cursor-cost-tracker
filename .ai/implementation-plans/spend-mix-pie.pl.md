# Wykres kołowy struktury wydatków

**Polski.** Kanoniczny angielski: [spend-mix-pie.md](./spend-mix-pie.md)
**Rodzic:** [feedback-2026-10-25.pl.md](./feedback-2026-10-25.pl.md)
**Status:** wydane w 1.0.8. Drzewo ma więcej chipów niż ta notatka (Model, Size, Limit, Kind, Conversations, Cache oraz Vendor i Grade). Wygrywa [prd.md](../context/prd.md).
**Zależy od:** załadowanej próbki Last N / Od–Do (`UsageQuery`). Plasterki workspace czekają na [additional/project-cost-attribution.pl.md](./additional/project-cost-attribution.pl.md) — też jeszcze nie ma.
**Wersja:** nieustalona. Ta notatka nie podbija `package.json`.

Przy sprzeczności wygrywa [prd.md](../context/prd.md).

Prośba: jeden wykres kołowy **rozliczonego** wydatku. Te same zapytania da się ciąć po katalogu workspace, po dostawcy modelu (Anthropic, OpenAI, Cursor, …) albo po klasie modelu (tani / zrównoważony / wysoki). Klasy to lista JSON, którą użytkownik może zmienić. Kreator pivotów nie jest wart ekranu.

---

## 1. Cel

W **Statistics**, pod istniejącymi paskami wydatku wg modelu, jeden wykres kołowy (albo pierścień) z `costUsd` bieżącej próbki.

Trzy chipy wybierają wymiar:

| Chip | Klucz plasterka | Kiedy |
|------|-----------------|-------|
| Dostawca | Nazwa providera | Pierwszy kawałek. Bez nowego API Cursora. |
| Klasa | Id koszyka z JSON | Pierwszy kawałek. Wchodzi z wbudowanym przykładem. |
| Workspace | Ostemplowany folder projektu | Ukryty, dopóki atrybucja nie zapisze folderu na wierszu. |

**Gotowe, gdy:**

- Klasyfikacja i agregacja są czyste i pokryte Vitestem (bez `vscode`, bez DOM).
- Dostawca i Klasa rysują się z próbki. Wiersz z `costUsd === 0` nie pompuje plasterka dolarowego.
- Zły JSON nie podmienia ostatniej dobrej listy koszyków.
- Workspace nie ma na wykresie, dopóki nie ma atrybucji. Plan nie wymyśla katalogu ze zdarzenia usage.
- `npm test` / `typecheck` zielone dla nowych modułów.

---

## 2. Czego nie ma w zdarzeniu usage

`UsageQuery` (`src/usage/types.ts`) to czas, model, rodzaj, dolary i liczniki tokenów oraz opcjonalne id konwersacji. **Nie ma** ścieżki workspace, cwd ani dostawcy.

To jest dokładnie ta obserwacja: aktywnego katalogu nie da się odczytać z zapytania do LLM. Nie skanować JSON composera ani transkryptu, żeby go zgadnąć. Atrybucja projektu, jeśli wejdzie, stempluje workspace otwarty w chwili, gdy to rozszerzenie pierwszy raz zobaczyło wiersz. Starsze wiersze zostają **Unattributed**. Przy chipie Workspace wykres mówi to jednym zdaniem.

Dostawcę da się odzyskać bez stempla:

1. Złączyć id modelu zapytania z katalogiem konta (`src/pricing/accountModels.ts` już czyta `vendorName` / `vendor.displayName` do `provider`).
2. Gdy id nie ma w katalogu, mała lokalna mapa: `claude` → Anthropic, `gpt` / `o1` / `o3` / `o4` → OpenAI, `grok` → xAI, `gemini` → Google, `cursor` / `composer` → Cursor.
3. Inaczej **Unknown**.

Mapa jest awaryjna, nie cennikiem. Nie pobierać nowej strony cen na ten widok.

---

## 3. Koszyki klas

Wbudowany przykład, wygrywa pierwsze trafienie, substring bez względu na wielkość liter, na id modelu:

```json
{
  "buckets": [
    { "id": "cheap", "label": "Cheap", "match": ["luna", "haiku"] },
    { "id": "balanced", "label": "Balanced", "match": ["terra", "sonnet"] },
    { "id": "high", "label": "High", "match": ["sol", "opus"] }
  ]
}
```

Modele bez trafienia idą do **Other**. Puste `match` jest błędne.

Settings → zwinięty fieldset **Spend mix**, jedno wielowierszowe pole, Apply / blur. Przykład jako placeholder. Webview wysyła sam napis. Waliduje host.

Reguły schematu:

- Najwyżej **8** koszyków, **32** napisy `match`, **4 KB** JSON.
- `id`: `^[a-z][a-z0-9-]{0,31}$`, unikalne.
- `label`: 1–40 znaków, zwykły tekst.
- `match`: 1–24 napisy, każdy 1–40 znaków, bez regexu.

`zod` tylko w `src/spendMix/schema.ts`. esbuild może wciągnąć go do `dist/extension.js`. Nie importować `zod` z `media/`. Przy błędzie zostaje poprzednia lista, a fieldset pokazuje problem. Nie wywracać pollingu usage.

Puste ustawienie: przykład trzymany w kodzie, nie parsowany z placeholdera.

To cały interfejs konfiguracji. Bez formularza „dodaj wiersz”, bez przeciągania, bez projektanta pivotów.

---

## 4. Wykres

- Tylko dolary (`costUsd`). Tytuł mówi wprost: wydatek z rozliczenia, nie cena katalogowa, nie procent puli included.
- Gdy suma rozliczona w próbce wynosi 0, nie rysować koła i napisać, że próbka nie ma rozliczonych dolarów. Nie przełączać po cichu na tokeny.
- Plasterki poniżej 1% sumy zwinąć do **Other** (po klasowym **Other** łączyć po etykiecie).
- Legenda: etykieta, dolary, udział. Bez siódmej zakładki. SVG w `media/src/charts/`, te same tokeny `--vscode-*` co reszta wykresów.
- Chipy wymiaru są po stronie klienta. Nie robią nowego pobrania.
- Jedno zdanie pod wykresem: mix dotyczy tej próbki (Last N albo Od–Do), nie faktury.

Chip Workspace: rysować dopiero, gdy wiersze niosą stempel projektu. Zanim wejdzie [project-cost-attribution.pl.md](./additional/project-cost-attribution.pl.md), nie dodawać chipa ani pustego stanu, który sugeruje, że katalog był w zapytaniu.

---

## 5. Pliki

| Faza | Ścieżki |
|------|---------|
| 1. Rdzeń + Vitest | `src/spendMix/schema.ts`, `src/spendMix/classify.ts`, `src/spendMix/aggregate.ts`, `test/spendMix.test.ts`. `zod` dochodzi tylko w tej fazie. |
| 2. Podpięcie | Klucz `cursorCost.spendMixBuckets` w `package.json` (string, domyślnie `""`), `src/config.ts`, montaż w `media/src/tabs/stats.js`, rysowanie `media/src/charts/spendMix.js`, fieldset w `media/history.html`, `src/i18n/catalogs/en.ts`, `src/i18n/catalogs/pl.ts`. |
| Później | Pozostałe katalogi locale. Plasterki workspace dopiero po stemplach atrybucji. |
| Docs | PRD / README / CHANGELOG w osobnej turze, gdy kawałek wejdzie. |

Faza 1 nie rusza `media/`. Faza 2 nie dodaje Workspace.

---

## 6. Poza zakresem

| Element | Dlaczego |
|---------|----------|
| Czytanie katalogu z API usage albo z transkryptu | Tego pola tam nie ma. Atrybucja to inny plan. |
| Kreator pivotów, zapisane widoki, konfiguracje zespołu | Prośba mówi, że wystarczy pole tekstowe. |
| Matchery regex | Wejście użytkownika jako regex łatwo zrobić sobie krzywdę. Tylko substring. |
| Koło ceny katalogowej, koło tokenów, koło rodzaju | Paski wg modelu i wg rodzaju już są. |
| Pasek statusu, prompt Optimize, kolumna CSV | Tylko Statistics, dopóki nie ma osobnej prośby. |
| React / biblioteka wykresów | SVG bez frameworka. |

---

## 7. Bezpieczeństwo

Pole to lokalne ustawienie. `JSON.parse` na napisie z limitem długości, potem Zod. Bez `eval`, bez `Function`, bez sieci. Ładunek wykresu to agregaty (etykieta, dolary, udział). Bez ciasteczka sesji, bez maila, bez tekstu promptu.
