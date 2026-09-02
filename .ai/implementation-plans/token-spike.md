# v1.1 implementation plan — token spike + Ignore

**English canonical.** Polish: [token-spike.pl.md](./token-spike.pl.md)  
**Depends on:** MVP complete ([mvp.md](./mvp.md)).  
**PRD:** §5.1 bang, §5.2 Ignore, stories B1–B5.

No Advise, auto-fix, workspace scan, or chat analysis.

Do **not** mix this into MVP phases 0–7.

---

## v1.1 — bang + Ignore

| Step | Work | Files | Status |
|------|------|--------|--------|
| 1 | Setting `spikeTokenThreshold` (default 1e6, min 1e3), `showSpikeWarning`; Settings tab in **k** | `package.json`, `config.ts`, `media/history.*` | **done** |
| 2 | `isSpike(query, threshold)` | `src/spikes/threshold.ts` + Vitest | **done** |
| 3 | `IgnoreStore` on `globalState` (`cursorCost.ignoredSpikes: string[]`) | `src/spikes/ignoreStore.ts` | remaining |
| 4 | Status bar: last 3 query chips; `!` when that query is a spike | `statusBar.ts` / `statusBarView.ts` | **done** |
| 5 | Table: `!` on TOKENS; **Ignore** posts `{ type: 'ignore', key }` | `historyPanel.ts`, `media/history.*` | `!` on TOKENS **done**; Ignore remaining |
| 6 | Recompute bang after ignore / setting change / refresh | `UsageService` or thin `SpikeService` | setting change **done** |

**Done:** PRD §13b checklist.

---

## Tests

- Threshold: 999_999 no bang, 1_000_000 bang, custom 2e6.
- Ignore removes key from “active spikes”; persist round-trip with mock `Memento`.
