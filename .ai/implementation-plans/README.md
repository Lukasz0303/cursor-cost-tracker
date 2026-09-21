# Implementation plans

On conflict with the PRD, [prd.md](../context/prd.md) wins.

## MVP (overview)

- English (canonical): [mvp.md](./mvp.md)
- Polish: [mvp.pl.md](./mvp.pl.md)

Work phases **0 → 7** in order. Each phase has a detailed plan (steps, files, tests, done criteria):

| Phase | English | Polish |
|-------|---------|--------|
| 0 Scaffold | [phase-0-scaffold.md](./phase-0-scaffold.md) | [phase-0-scaffold.pl.md](./phase-0-scaffold.pl.md) |
| 1 Parse + format | [phase-1-parse-format.md](./phase-1-parse-format.md) | [phase-1-parse-format.pl.md](./phase-1-parse-format.pl.md) |
| 2 Session | [phase-2-session.md](./phase-2-session.md) | [phase-2-session.pl.md](./phase-2-session.pl.md) |
| 3 Cursor API | [phase-3-cursor-api.md](./phase-3-cursor-api.md) | [phase-3-cursor-api.pl.md](./phase-3-cursor-api.pl.md) |
| 4 UsageService | [phase-4-usage-service.md](./phase-4-usage-service.md) | [phase-4-usage-service.pl.md](./phase-4-usage-service.pl.md) |
| 5 Status bar | [phase-5-status-bar.md](./phase-5-status-bar.md) | [phase-5-status-bar.pl.md](./phase-5-status-bar.pl.md) |
| 6 History webview | [phase-6-history-webview.md](./phase-6-history-webview.md) | [phase-6-history-webview.pl.md](./phase-6-history-webview.pl.md) |
| 7 Wire-up + VSIX | [phase-7-wire-up.md](./phase-7-wire-up.md) | [phase-7-wire-up.pl.md](./phase-7-wire-up.pl.md) |

Start at **phase 0**. Do not mix [token-spike.md](./token-spike.md) into these phases.

## After MVP

- Token spike / Ignore: [token-spike.md](./token-spike.md) · [token-spike.pl.md](./token-spike.pl.md)

## Shipped (1.0.4)

- **Burn Rate Guard** + **Generated Lines Insight** (PATCH **1.0.4**):
  - [burn-rate-guard.md](./burn-rate-guard.md) · [burn-rate-guard.pl.md](./burn-rate-guard.pl.md)
  - [generated-lines-insight.md](./generated-lines-insight.md) · [generated-lines-insight.pl.md](./generated-lines-insight.pl.md)

Do **not** mix this into MVP phases 0–7 or into remaining v1.1 Ignore. On conflict, [prd.md](../context/prd.md) wins.

## Additional / backlog

Deferred spend-control notes (loop heuristic, daily cap, efficiency, model advisor, attribution). Not scheduled; re-number if picked up later.

Index: [additional/README.md](./additional/README.md)
