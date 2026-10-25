# Nie przepisywać panelu na React ani Svelte

**Polski.** Kanoniczny angielski: [webview-rewrite.md](./webview-rewrite.md)
**Rodzic:** [feedback-2026-10-25.pl.md](./feedback-2026-10-25.pl.md)
**Status:** odrzucone. Nie ma fazy implementacji.
**Sprawdzone:** 2026-10-25. Podział, na którym opiera się ta notatka, to [datetime-media-foundation.pl.md](./datetime-media-foundation.pl.md), status: zrobione.

Notatka zgadzała się, że najbliższy odcinek to stabilizacja, poprawki i testy, a potem rzuciła pomysł nowego UI `media/` w Reactcie, bo generowany kod słabo utrzymuje obecny duży plik. Svelte padło jako możliwe tańsze w tokenach. Ta sama notatka od razu wątpiła, czy przepisanie wyjdzie taniej nawet na dłuższą metę.

Ta wątpliwość jest decyzją.

---

## 1. Decyzja

Zostaje panel vanilla. Nie zaczynać portu `media/` na React ani Svelte.

[shared.mdc](../../.cursor/rules/shared.mdc) już zabrania Reacta w tym panelu. Plan fundamentu już ma „Rewrite webview in TypeScript / React” poza zakresem, bo przy modułach vanilla jest za drogie.

Ból utrzymania był prawdziwy, gdy UI było jednym IIFE. Źródła są teraz w `media/src/` (`tabs/`, `charts/`, `session.js`). `media/history.js` jest wyjściem esbuild i nie edytuje się go ręcznie. Nowy framework kazałby kupić od nowa każdą zakładkę: zapytania, Statistics, Charts, Optimize, Support, Settings i arkusze Codexa.

---

## 2. Dlaczego port nie jest tańszym utrzymaniem

- Host już trzyma logikę, którą warto testować jednostkowo (usage, grupy, serie prognozy, straże). Webview rysuje. Przeniesienie rysowania do Reacta nie ułatwia modułów hosta, a dokłada drugi runtime do każdej zmiany CSS i CSP.
- CSP to `default-src 'none'` z nonce. Build frameworka musi to utrzymać. To nie jest darmowe drzewo komponentów.
- Mniejszy output Svelte nie spłaca przepisania wykresu prognozy, zgrupowanego arkusza, Optimize i Settings. Koszt tokenów portu to cała powierzchnia, nie rozmiar jednego pliku komponentu.
- Stabilizacja, o którą notatka prosiła w pierwszej kolejności, przy porcie się przesuwa. Każde zachowanie trzeba udowodnić od nowa. Otwarte luki produktu to wykres kołowy i sort kolumn — oba mieszczą się w obecnych modułach.

---

## 3. Co zamiast tego

- Błędy poprawiać w module, który je posiada. Jeden kawałek, ścieżki nazwane w tym kawałku.
- Vitest na czystych funkcjach hosta. Nie gonić pokrycia w `media/src` przez przepisanie.
- Gdy plik zakładki znowu urośnie, dzielić tę zakładkę. To jest plan fundamentu, nie nowy framework.

Bez zależności w `package.json`, bez szkieletu `media/`, bez podbicia wersji.
