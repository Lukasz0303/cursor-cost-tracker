# Codex local history and OpenAI requests

Product plan: [openai-codex.md](./openai-codex.md) · [Polish](./openai-codex.pl.md)

Spec: [cursor-cost-tracker-openai-requests-spec.md](../../reports/cursor-cost-tracker-openai-requests-spec.md)

If a phase file and the product plan disagree, **the product plan wins**. If either disagrees with the PRD, **the PRD wins**.

Work **1 → 4** for **1.1.0**. One phase file is one Agent message. Do not bump `package.json` inside a phase turn. Phases **5–7** are later minors.

## Phases

| Phase | English | Polish | Release |
|---|---|---|---|
| 1 Parse and usage | [phase-1-parse.md](./phase-1-parse.md) | [phase-1-parse.pl.md](./phase-1-parse.pl.md) | 1.1.0 |
| 2a Store | [phase-2a-store.md](./phase-2a-store.md) | [phase-2a-store.pl.md](./phase-2a-store.pl.md) | 1.1.0 |
| 2b Import | [phase-2b-import.md](./phase-2b-import.md) | [phase-2b-import.pl.md](./phase-2b-import.pl.md) | 1.1.0 |
| 3a Query, rows, CSV | [phase-3a-query.md](./phase-3a-query.md) | [phase-3a-query.pl.md](./phase-3a-query.pl.md) | 1.1.0 |
| 3b Host wire | [phase-3b-host.md](./phase-3b-host.md) | [phase-3b-host.pl.md](./phase-3b-host.pl.md) | 1.1.0 |
| 3c Queries webview | [phase-3c-webview.md](./phase-3c-webview.md) | [phase-3c-webview.pl.md](./phase-3c-webview.pl.md) | 1.1.0 |
| 3d Statistics, Charts, Optimize | [phase-3d-stats.md](./phase-3d-stats.md) | [phase-3d-stats.pl.md](./phase-3d-stats.pl.md) | 1.1.0 |
| 4 Tariff | [phase-4-pricing.md](./phase-4-pricing.md) | [phase-4-pricing.pl.md](./phase-4-pricing.pl.md) | 1.1.0 |
| 5 Recorder | [phase-5-recorder.md](./phase-5-recorder.md) | [phase-5-recorder.pl.md](./phase-5-recorder.pl.md) | later |
| 6 Organization comparison | [phase-6-organization.md](./phase-6-organization.md) | [phase-6-organization.pl.md](./phase-6-organization.pl.md) | later |
| 7 Analysis runs | [phase-7-analysis.md](./phase-7-analysis.md) | [phase-7-analysis.pl.md](./phase-7-analysis.pl.md) | later |

## Archive

| Document | |
|---|---|
| Repo-native plan | [codex-openai-queries.md](./archive/codex-openai-queries.md) · [Polish](./archive/codex-openai-queries.pl.md) |
| Codex / OpenAI plan | [openai-codex-request-history-plan.md](./archive/openai-codex-request-history-plan.md) · [Polish](./archive/openai-codex-request-history-plan.pl.md) |
| Comparison write-up | [openai-codex-history-summary.md](./archive/openai-codex-history-summary.md) · [Polish](./archive/openai-codex-history-summary.pl.md) |
