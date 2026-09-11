# Facebook — Cursor Cost Tracker (PL)

Gotowiec do publikacji. Facebook **nie renderuje Markdowna** — treść do wklejenia jest w blokach kodu. Zdjęcia dodaj jako **album** (kolejność poniżej). Pierwsze zdjęcie jest okładką posta.

**Linki (na końcu posta):**

- Open VSX: https://open-vsx.org/extension/lukasz0303/cursor-cost-tracker
- GitHub: https://github.com/Lukasz0303/cursor-cost-tracker
- Buy Me a Coffee: https://buymeacoffee.com/lzzzielinsn

---

## Kolejność zdjęć w albumie

Wgraj dokładnie w tej kolejności. Facebook pokaże pierwsze jako dużą okładkę.

| # | Plik | Filary | Podpis pod zdjęciem (opcjonalnie) |
|---|------|--------|-----------------------------------|
| 1 | `screenshots/status_bar.png` | 1 | Current, Today i ostatnie zapytania — zawsze na belce IDE |
| 2 | `screenshots/status_bar_dark.png` | 1 | Plan Pro: procent included, Today vs tempo, czerwony `!` przy spike |
| 3 | `screenshots/monthly_cost.png` | 2 | Prognoza miesiąca: zużycie, tempo, idealna pozostałość |
| 4 | `screenshots/monthly_cost_dark.png` | 2 | Pro: Cursor Models / Other Models i data wyczerpania limitu |
| 5 | `screenshots/critiacal_alert_2.png` | 2 | Twardy alarm: najnowsze zapytanie ≥ 10 mln tokenów albo 5 $ |
| 6 | `screenshots/optimize.png` | 3 | Optimize: ~1.6M · ~0.97 $ na podobny request, Findings, Quick / Balanced / Deep |
| 7 | `screenshots/alert_list.png` | extra | Last N: czas, model, koszt, tokeny, kind — bez wychodzenia z edytora |
| 8 | `screenshots/statistics_1.png` | extra | Statistics: suma, średnia, mediana, cache hit, mix tokenów |

Podgląd w repo (ta sama kolejność, którą wrzucasz na FB):

### Filary 1 — brak liczb w IDE

Current / Today / ostatnie zapytania na belce. Klik w liczby → Statistics. Klik w chip → Last N.

![Status bar Team](../screenshots/status_bar.png)

![Status bar Pro, dark](../screenshots/status_bar_dark.png)

### Filary 2 — prognoza i twardy alarm

Zużycie, tempo, idealna pozostałość, data wyczerpania. Potem blokujący dialog przy 10 mln tokenów albo 5 $.

![Monthly cost forecast Team](../screenshots/monthly_cost.png)

![Monthly cost forecast Pro](../screenshots/monthly_cost_dark.png)

![Critical alert](../screenshots/critiacal_alert_2.png)

### Filary 3 — Optimize w projekcie

Czerwone zapytanie (≥ Warn at) → **Run Optimize** wkleja prompt do ostatniego czatu Agenta (albo karta Quick / Balanced / Deep + Run). Po Start projekcja ląduje w `.ai/optimize-savings.md`. Karta na górze: **Projected save per similar request** (tu ~1.6M · ~0.97 $). Findings: ostatnie czerwone zapytanie, ile spike’ów w próbce, najdroższy model.

![Optimize](../screenshots/optimize.png)

### Codzienny panel

![Last N spikes](../screenshots/alert_list.png)

![Statistics summary](../screenshots/statistics_1.png)

Jeśli album ma zostać krótszy, zostaw **1, 3, 5, 6** (jeden kadr na filar + alarm).

---

## Wersja krótka (grupy, ~800 znaków)

Wklej jako treść. Hashtagi na końcu — w grupach technicznych nie więcej niż 4.

```
Kodujesz w Cursorze. Tokeny lecą. A ile to kosztuje, widzisz dopiero na stronie konta — za późno, żeby zatrzymać agenta.

Cursor Cost Tracker to darmowa wtyczka do Cursora (i VS Code obok Cursora). Trzy rzeczy, których dashboard na stronie nie daje w trakcie pracy:

1. Koszty na belce IDE. Current, Today i ostatnie zapytania (koszt + tokeny). Czerwony wykrzyknik, gdy jedno zapytanie przekroczy próg — domyślnie milion tokenów.

2. Prognoza miesiąca + twardy alarm. Wykres: zużycie, tempo, idealna pozostałość i data wyczerpania limitu. Gdy najnowsze zapytanie dobije 10 mln tokenów albo 5 $, wyskakuje blokujący dialog.

3. Optimize. Po czerwonym zapytaniu (np. 2 mln tokenów) wtyczka składa prompt Quick / Balanced / Deep, wkleja go do ostatniego czatu Agenta i pozwala sprawdzić, co w projekcie spala tokeny. Na górze karty widać projekcję na podobny request (np. ~1.6M tokenów · ~0.97 $). Plik .ai/optimize-savings.md zostaje lokalnie — bez wysyłania transkryptu.

Zero konfiguracji: jesteś zalogowany w Cursorze, belka się pojawia. MIT.

Open VSX: https://open-vsx.org/extension/lukasz0303/cursor-cost-tracker
GitHub: https://github.com/Lukasz0303/cursor-cost-tracker

Wtyczka jest darmowa. Jeśli oszczędziła Ci tokeny — możesz postawić kawę:
https://buymeacoffee.com/lzzzielinsn

#Cursor #VSCode #AI #OpenSource
```

---

## Wersja pełna (profil / strona / dłuższy post)

Pierwsza linia to haczyk w feedzie — nie zaczynaj od nazwy wtyczki.

```
Kodujesz w Cursorze. Agent robi swoje. Tokeny lecą.

A ile to kosztuje — wiesz dopiero, gdy otworzysz dashboard na stronie. Za późno, żeby zatrzymać run. Za późno, żeby zobaczyć, które zapytanie zjadło milion tokenów. Za późno, żeby przewidzieć, czy limit dotrwa do końca miesiąca.

Dlatego jest Cursor Cost Tracker — darmowa wtyczka do Cursora (i VS Code, gdy Cursor jest na tej samej maszynie). Nie zastępuje faktury. Daje to, czego brakuje w IDE: liczby obok Gita i Problems, prognozę, twardy alarm i sposób, żeby kolejny podobny run był tańszy.

Trzy filary.

—— 1. Ślepy punkt kosztów ——

Cursor rozlicza chat, agenta i edycje inline w dolarach i tokenach. Oficjalny usage żyje na stronie konta. W edytorze, w trakcie pracy, nie widać nic.

Na belce statusu: Current, Today i 1–10 ostatnich zapytań (domyślnie 3), w formacie koszt + tokeny.

Plan Team / Business: Current to pula dolarowa (np. 30.66 $ / 250.00 $), Today vs dzienny budżet — czerwony, gdy tempo ucieka.
Plan Pro: Current to średnia included vs 100% (np. 32% / 100%), Today to dzisiejsze % vs równe tempo dnia, z sumą $ w nawiasie.

Klik Current albo Today otwiera Statistics. Klik chipa zapytania otwiera tabelę Last N. Refresh na belce tylko synchronizuje.

Czerwony ! przy zapytaniu, które przekroczy Twój próg (domyślnie 1 000 000 tokenów). Kolory zielony / czerwony z Settings. Możesz je wyłączyć.

Zero setupu: wtyczka czyta lokalną sesję Cursora (state.vscdb). Bez API key, bez wklejania cookie, bez .env. Token sesji nie wychodzi z hosta rozszerzenia — nie idzie do panelu, logów ani Settings.

—— 2. Prognoza + twardy alarm ——

Statistics i Charts mają ten sam wykres Monthly cost forecast.

Słupki i linia ciągła: skumulowane zużycie. Linia przerywana: prognoza, jeśli utrzyma się tempo dni roboczych. Linia kropkowana: idealna pozostałość do końca miesiąca. Zakres: Today / 7 dni / miesiąc.

Team: dolary. Pro: procent included osobno dla Cursor Models i Other Models, z datą wyczerpania limitu albo werdyktem „starczy na miesiąc”.

Pace możesz liczyć dniami roboczymi (pn–pt, domyślnie) albo całym kalendarzem.

A gdy najnowsze zapytanie dobije 10 000 000 tokenów albo 5 $ (progi w Settings) — blokujący dialog. Niezależny od wykrzyknika na belce. Raz na zapytanie. Restart IDE nie wyświetla historycznego alertu sprzed kilku minut, więc nie blokuje startu dnia.

To jest twardy hamulec. Dashboard na stronie go nie ma.

—— 3. Automatyczne sprawdzenie, co poprawić ——

Drogi spike to sygnał, nie wyrok. Zakładka Optimize nie skanuje całego repo za Twoimi plecami i nie czyta transkryptu czatu.

Bierze ostatnie czerwone zapytanie (≥ Warn at) — np. grok-4.6-high, 2 mln tokenów. Findings pokazują też, ile spike’ów jest w próbce Last N i który model spala najwięcej (kontekst).

Trzy głębokości: Quick (dlaczego ostatni turn spalił + trzy wskazówki na kolejną wiadomość), Balanced (wzorzec, plan, krótki snippet reguł), Deep (pełny playbook). Set default przypina, którą kartę wkleja toolbar Run Optimize.

Run wkleja prompt do ostatniego aktywnego czatu Agenta. Ty naciskasz Start. Agent sprawdza projekt — reguły, za szeroki kontekst, zbędne pętle — i zapisuje projekcję w .ai/optimize-savings.md w tym workspace.

Na górze karty: Projected save per similar request. Do pierwszego runu 0 / 0.00 $. Potem mid tokenów i USD z agenta (np. ~1.6M · ~0.97 $). Rozwinięcie: wyjaśnienie i suma per projekt.

Nic nie wychodzi z maszyny poza tym, co i tak wyślesz do Cursora, wciskając Start.

—— Reszta, której używasz codziennie ——

Last N — 100 do 10 000 zapytań (domyślnie 1000), albo od wybranej daty (np. od 1. dnia miesiąca). Kolumny: TIME, MODEL, COST, TOKENS, INPUT / OUTPUT, KIND. Filtr Over Warn at. Export CSV.

Statistics — Current / Today, miarki cyklu, Last N: suma, średnia, mediana, cache hit, koszt na 1 mln tokenów, mix input/output/cache, spend per model i per kind.

Charts — tokeny i koszt w czasie (skumulowane słupki + linia, jedna skala) plus ta sama prognoza miesiąca i karty Today / This month / All time.

Settings — wszystko w panelu: belka (podgląd, Show Today, Minimal mode, 1–10 chipów), Warn at, Critical alert, tempo budżetu, głębokość Optimize, Show last / From date, auto-refresh 1–60 min, kolory.

Auto-refresh co minutę (do zmiany). Start edytora nigdy nie czeka na sieć.

MIT. Nieoficjalne API usage Cursora — to overlay, nie faktura. Windows, macOS, Linux.

Szukaj „Cursor Cost Tracker” w Cursor → Extensions (Open VSX), albo zainstaluj z VSIX.

https://open-vsx.org/extension/lukasz0303/cursor-cost-tracker
https://github.com/Lukasz0303/cursor-cost-tracker

Jeśli wtyczka złapała drogi run zanim zjadł budżet — możesz postawić kawę. Bez paywalla, bez funkcji za napiwek. MIT zostaje MIT.

https://buymeacoffee.com/lzzzielinsn

#Cursor #VSCode #AI #OpenSource
```

---

## Szybkie odpowiedzi pod postem

**Gdzie to zainstalować?**
```
Cursor → Extensions → szukaj „Cursor Cost Tracker” (Open VSX). Albo Install from VSIX. Microsoft Marketplace nie jest potrzebny — Cursor i tak bierze wtyczki z Open VSX.
```

**Czy to oficjalne od Cursora?**
```
Nie. MIT, nieoficjalne API usage. Liczby to overlay, nie faktura. Token sesji zostaje w hoście rozszerzenia.
```

**Czy działa na Pro i na Team?**
```
Tak. Pro: procent included (Cursor Models / Other Models). Team / Business: pula dolarowa i dzienny budżet. Unlimited chowa Today.
```

**Czy wysyła transkrypt czatu?**
```
Nie. Optimize składa prompt z metadanych usage (model, tokeny, koszt). Ty wklejasz i wciskasz Start. Projekcja oszczędności zapisuje się lokalnie w .ai/optimize-savings.md.
```

**Ile to kosztuje?**
```
Wtyczka jest darmowa (MIT). Jeśli pomaga w codziennej pracy, możesz postawić kawę — bez paywalla:
https://buymeacoffee.com/lzzzielinsn
```
