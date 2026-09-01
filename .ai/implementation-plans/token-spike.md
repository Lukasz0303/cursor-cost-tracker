# v1.1 implementation plan — token spike + Ignore

**English canonical.** Polish: [token-spike.pl.md](./token-spike.pl.md)  
**Depends on:** MVP complete ([mvp.md](./mvp.md)).  
**PRD:** §5.1 bang, §5.2 Ignore, stories B1–B5.

No Advise, auto-fix, workspace scan, or chat analysis.

Do **not** mix this into MVP phases 0–7.

---

## v1.1 — bang + Ignore

| Step | Work | Files |
|------|------|--------|
| 1 | Setting `spikeTokenThreshold` (default 1e6, min 1e5), `showSpikeWarning` | `package.json`, `config.ts` |
| 2 | `isSpike(query, threshold)`, fingerprint helper | `src/spikes/threshold.ts` + Vitest |
| 3 | `IgnoreStore` on `globalState` (`cursorCost.ignoredSpikes: string[]`) | `src/spikes/ignoreStore.ts` |
| 4 | Status bar: `$(warning)` when any Last-100 query is spike and not ignored | `statusBar.ts` |
| 5 | Table: `!` column; **Ignore** posts `{ type: 'ignore', key }` | `historyPanel.ts`, `media/history.*` |
| 6 | Recompute bang after ignore / setting change / refresh | `UsageService` or thin `SpikeService` |

**Done:** PRD §13b checklist.

---

## Tests

- Threshold: 999_999 no bang, 1_000_000 bang, custom 2e6.
- Ignore removes key from “active spikes”; persist round-trip with mock `Memento`.
