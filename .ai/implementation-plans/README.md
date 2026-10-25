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

## Planned (fork / upstream)

- Billing-cycle forecast alignment ([#8](https://github.com/Lukasz0303/cursor-cost-tracker/issues/8)): [billing-cycle-forecast.md](./billing-cycle-forecast.md)
- Group queries by conversation (toolbar toggle on Last N, **1.1.0** MINOR): [conversation-grouping-queries.md](./conversation-grouping-queries.md) · [conversation-grouping-queries.pl.md](./conversation-grouping-queries.pl.md)
- Datetime consistency + media frontend split: [datetime-media-foundation.md](./datetime-media-foundation.md) · [datetime-media-foundation.pl.md](./datetime-media-foundation.pl.md)
- Codex local history + OpenAI requests (**1.1.0** MINOR): [openai-codex.md](./openai-codex/openai-codex.md) · [openai-codex.pl.md](./openai-codex/openai-codex.pl.md) · [phase index](./openai-codex/README.md)

## Contributor feedback (25 Oct 2026)

Checked against **1.0.8**. Index: [feedback-2026-10-25.md](./feedback-2026-10-25.md) · [feedback-2026-10-25.pl.md](./feedback-2026-10-25.pl.md)

Row expand, red over-plan chips, and group-by-conversation are shipped. The forecast bar report is closed. A React / Svelte rewrite of `media/` is rejected.

| Piece | Status | English | Polish |
|-------|--------|---------|--------|
| Spend mix pie (vendor / grade / later workspace) | backlog | [spend-mix-pie.md](./spend-mix-pie.md) | [spend-mix-pie.pl.md](./spend-mix-pie.pl.md) |
| Query sheet column sort + CSV order | not started | [queries-column-sort.md](./queries-column-sort.md) | [queries-column-sort.pl.md](./queries-column-sort.pl.md) |
| Forecast bars vs the cumulative line | closed in 1.0.8 | [forecast-daily-bars.md](./forecast-daily-bars.md) | [forecast-daily-bars.pl.md](./forecast-daily-bars.pl.md) |
| Rewrite the panel | rejected | [webview-rewrite.md](./webview-rewrite.md) | [webview-rewrite.pl.md](./webview-rewrite.pl.md) |

## Additional / backlog

Deferred spend-control notes (loop heuristic, daily cap, efficiency, model advisor, attribution). Not scheduled; re-number if picked up later.

Index: [additional/README.md](./additional/README.md)

## Market follow-ups (30 Sep 2026)

Review plus seven ordered slices. These replace the **order** of the old 1.2–1.6 backlog when something from that review is picked up. They do not delete those notes.

Index: [market-2026-09/README.md](./market-2026-09/README.md) · [market-2026-09/README.pl.md](./market-2026-09/README.pl.md)
