# Context maintenance plan

File names in `.ai/context/` use **kebab-case, lowercase** (`architecture.md`, `tech-stack.md`, `plan.md`). The only exception is `README.md` (folder index).

## Sources of truth

| Topic | File |
|-------|------|
| Product | [prd.md](./prd.md) (English) · [prd.pl.md](./prd.pl.md) (Polish) |
| Stack | [tech-stack.md](./tech-stack.md) |
| Files and flow | [architecture.md](./architecture.md) |
| Token / CSP | [security.md](./security.md) |
| Store / VSIX | [publishing.md](./publishing.md) |
| What the code does | [codebase-snapshot.md](./codebase-snapshot.md) |
| Agent index | [README.md](./README.md) |
| MVP implementation | [../implementation-plans/mvp.md](../implementation-plans/mvp.md) · [../implementation-plans/mvp.pl.md](../implementation-plans/mvp.pl.md) |
| MVP phases 0–7 | [../implementation-plans/README.md](../implementation-plans/README.md) |
| Token spike / Ignore | [../implementation-plans/token-spike.md](../implementation-plans/token-spike.md) · [../implementation-plans/token-spike.pl.md](../implementation-plans/token-spike.pl.md) |
| 1.0.4 Burn Rate Guard | [../implementation-plans/burn-rate-guard.md](../implementation-plans/burn-rate-guard.md) · [../implementation-plans/burn-rate-guard.pl.md](../implementation-plans/burn-rate-guard.pl.md) |
| 1.0.4 Generated Lines Insight | [../implementation-plans/generated-lines-insight.md](../implementation-plans/generated-lines-insight.md) · [../implementation-plans/generated-lines-insight.pl.md](../implementation-plans/generated-lines-insight.pl.md) |
| 1.0.5–1.0.6 and later slices | [../implementation-plans/market-2026-09/README.md](../implementation-plans/market-2026-09/README.md) · billing cycle: [../implementation-plans/billing-cycle-forecast.md](../implementation-plans/billing-cycle-forecast.md) |
| Additional / backlog plans | [../implementation-plans/additional/README.md](../implementation-plans/additional/README.md) |
| What each release contains | root `CHANGELOG.md` and the history table in [codebase-snapshot.md](./codebase-snapshot.md) |

## When to update

One command refreshes the whole set: [`.cursor/commands/11-sync-product-docs.md`](../../.cursor/commands/11-sync-product-docs.md). It does not bump the version, tag, or commit.

- New directory or changed file ownership → `architecture.md` + `shared.mdc`.
- Cursor API, `state.vscdb` paths, or parse changes → `prd.md` §8 + `tech-stack.md` + tests.
- After a version ships or a slice lands in `src/` → `codebase-snapshot.md`, and `prd.md` / `prd.pl.md` when the behavior is now a requirement.
- `engines.vscode` / publisher / homepage changes → `publishing.md` and `package.json`.

## What not to duplicate

Full PRD only in `prd.md`. Repo README = human-facing description. `.ai/context/README.md` = agent summary + links.
