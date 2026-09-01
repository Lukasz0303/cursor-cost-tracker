# Plan v1.1 — spike tokenów + Ignore

**Kanon EN:** [token-spike.md](./token-spike.md)  
**Zależność:** ukończone MVP ([mvp.pl.md](./mvp.pl.md)).  
**PRD:** §5.1 bang, §5.2 Ignore, historyjki B1–B5.

Bez Advise, auto-naprawy, skanu workspace i analizy czatu.

Nie wplatać w fazy 0–7 MVP.

---

## v1.1 — wykrzyknik + Ignore

| Krok | Praca | Pliki |
|------|--------|--------|
| 1 | Ustawienia `spikeTokenThreshold` (domyślnie 1e6, min 1e5), `showSpikeWarning` | `package.json`, `config.ts` |
| 2 | `isSpike`, fingerprint | `src/spikes/threshold.ts` + Vitest |
| 3 | `IgnoreStore` na `globalState` (`cursorCost.ignoredSpikes`) | `src/spikes/ignoreStore.ts` |
| 4 | Belka: `$(warning)` gdy w Last 100 jest spike nieignorowany | `statusBar.ts` |
| 5 | Tabela: kolumna `!`; **Ignore** → `{ type: 'ignore', key }` | `historyPanel.ts`, `media/history.*` |
| 6 | Przelicz bang po ignore / zmianie ustawienia / refresh | `UsageService` albo `SpikeService` |

**Gotowe:** checklist PRD §13b.

---

## Testy

- Próg: 999_999 bez bangu, 1_000_000 bang, własny 2e6.
- Ignore usuwa klucz ze „active spikes”; persist z mockiem `Memento`.
