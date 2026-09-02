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

## When to update

- New directory or changed file ownership → `architecture.md` + `shared.mdc`.
- Cursor API, `state.vscdb` paths, or parse changes → `prd.md` §8 + `tech-stack.md` + tests.
- After MVP lands on main → `codebase-snapshot.md` (stop saying “no src”).
- `engines.vscode` / publisher changes → `publishing.md` and `package.json`.

## What not to duplicate

Full PRD only in `prd.md`. Repo README = human-facing description. `.ai/context/README.md` = agent summary + links.
