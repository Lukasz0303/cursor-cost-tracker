# Słupki prognozy miesięcznej — narastająco czy ten dzień

**Polski.** Kanoniczny angielski: [forecast-daily-bars.md](./forecast-daily-bars.md)
**Rodzic:** [feedback-2026-10-25.pl.md](./feedback-2026-10-25.pl.md)
**Status:** zamknięte w **1.0.8**. Nie otwierać ponownie jako „narysuj oba”.
**Sprawdzone:** 2026-10-25, `media/src/charts/forecast.js`, `media/src/session.js`.

Zgłoszenie (przy **1.0.6**, zrzut z 10 października): dzień za około 0,05 $ dostał słupek w okolicy dolara. Słupki nigdy nie spadały, więc dublowały linię ciągłą. Oczekiwany kształt:

- linie ciągłe = narastająco, nigdy nie spadają
- słupki = wydatek tego dnia, dowolna wysokość, także zero

Diagnoza **domyślnego** widoku z 1.0.6 była trafna. Poprawka jest już w drzewie. Położenie obu kodowań na jednej osi jest złym następnym krokiem.

---

## 1. Co kod robi teraz

`mtdBarMode` startuje od `'cumulative'` (`media/src/session.js`). Prognoza na Statistics / Charts ma przełącznik Cumulative / Daily.

| Tryb | Wysokość słupka | Linie |
|------|-----------------|-------|
| Cumulative (domyślny) | `series.used` — suma bieżąca do tego dnia | Ciągła `used`, przerywana `forecast` |
| Daily | `series.day` — wydatek tego dnia | Tylko przerywana `forecastDay`. Linii narastającej nie ma. |

Tryb narastający nadal rysuje słupek i linię ciągłą z tej samej tablicy `used`. Dzień za 0,05 $, którego suma od początku miesiąca wynosi około 1 $, nadal ma wysoki słupek **w tym trybie**. To jest widok tempa: słupek jest zielony, dopóki suma bieżąca mieści się w planie, a czerwony tylko na odcinku powyżej planu (changelog **1.0.5** i **1.0.8**).

Tryb dzienny jest tym widokiem, o który chodziło w zgłoszeniu. Dzień za 0,05 $ to krótki słupek. Oś Y przelicza się na wartości dzienne (`forecast.js` bierze `day` / `forecastDay` / `dayAllowanceUsd`, gdy `daily` jest prawdziwe), więc suma narastająca nie ustawia skali.

Dzień bez dodatniego wydatku nie dostaje słupka (warunek `usedVal > 0`). To luka, nie prostokąt o wysokości zero. Zostawić. Lukę da się przeczytać; kreska na każdym pustym dniu nie jest tym błędem.

Tryb żyje w pamięci panelu. Przeładowanie panelu wraca do Cumulative. Nie zapisywać go i nie zmieniać domyślnego. Domyślny jest wykresem planu wobec sumy narastającej, o którym mówi reszta copy prognozy.

---

## 2. Dlaczego oba kodowania nie wchodzą na jedną oś

Linia narastająca i słupek dzienny nie mają wspólnej skali. 10 października narastająco było około dolara, a dzień około pięciu centów. Na jednej osi słupek dnia znika w linii bazowej i widać tylko linię — odwrotnie do tego, co zgłoszenie chciało odczytać. Dwie osie Y wyglądałyby precyzyjnie, a oko porównywałoby niepowiązane jednostki.

Rozwiązaniem jest przełącznik: Cumulative trzyma linię i słupek na skali narastającej; Daily trzyma słupek na skali dnia i usuwa linię narastającą. Legenda już chowa linię „used” w trybie Daily (`syncMtdBarModeUi`).

Nie „poprawiać” Daily przez dorysowanie `series.used` na ten wykres.

---

## 3. Poza zakresem

| Element | Dlaczego |
|---------|----------|
| Kolejna zmiana kodu pod to zgłoszenie | Tryb dzienny wszedł w 1.0.8. |
| Domyślne ustawienie wykresu na Daily | Zmienia znaczenie karty prognozy. |
| Zapamiętywanie Cumulative / Daily | Nikt o to nie prosił. Reset przy przeładowaniu jest wspólny z resztą przełączników wykresu trzymanych w pamięci. |
| Słupki o wysokości zero na pustych dniach | Pusty dzień to luka. |
| Wykres limitu Codexa | Inna seria. Już dzieli zielony równy plan od odcinka powyżej planu. |
