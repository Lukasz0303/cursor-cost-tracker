# Codex operating guide

This is the entry point for Codex working in Cursor Cost Tracker. It turns the
existing product context and Cursor rules into a small, task-specific read set.
Its purpose is to improve correctness without repeatedly loading the whole
repository or reviving already-shipped plans.

## Source order and current state

Use this order when sources disagree:

1. The user's explicit request and safety constraints.
2. The current implementation and its focused tests for behavior that already
   exists.
3. [`../context/prd.md`](../context/prd.md) for intended, user-visible behavior.
4. [`../context/architecture.md`](../context/architecture.md),
   [`../context/security.md`](../context/security.md), and the applicable
   `.cursor/rules/*.mdc` for ownership and hard constraints.
5. A named implementation plan for work that is not yet in the tree.

Do not infer that a feature is absent merely because an old plan says "planned".
The MVP phase index still says to start at phase 0, and
`implementation-plans/openai-codex/openai-codex.md` still has a 1.0.7 planned
baseline. Both are historical plans. The current tree is 1.0.8 and already has
`src/openaiHistory/`; verify any remaining gap in code and focused tests before
changing it.

The working tree can contain unrelated, uncommitted work. Preserve it. Restrict
edits and diffs to the user-requested slice; report a conflict instead of
rewriting a neighboring change.

## Read only what the task needs

Always read this file and the root `AGENTS.md`. Then use the matching row. Read
the English documents; their Polish counterparts are translations, not a second
source of truth.

| Task | Required read set before an edit | Usually do not load |
|---|---|---|
| Small bug or test failure in named files | target module, its test, applicable rule by glob | full PRD, all plans, webview bundle |
| Usage/session/API change | `context/prd.md` relevant section, `architecture.md`, `security.md`, `usage-api-security.mdc`, target tests | `media/src/`, old MVP phases |
| Extension-host/status-bar change | relevant PRD section, `architecture.md`, `extension-vscode-api.mdc`, target tests | generated webview files, unrelated plans |
| Webview or CSS change | relevant PRD section, `architecture.md`, `extension-webview.mdc`, exact `media/src/` owner | `media/history.js`, unrelated host code |
| Local Codex history or OpenAI source | [`OPENAI-API.md`](./OPENAI-API.md), `context/security.md`, target modules/tests; phase file only for an unimplemented capability | Cursor usage parser unless the boundary changes |
| New feature with an existing plan | the one plan named by the user, relevant PRD section, target modules/tests | every other feature plan |
| Docs / release wording | named command or doc, current code for the described surface | source-wide refactor, all locale catalogs |
| VSIX package only | `package.json` and the requested packaging command | product/context audit |

When ownership is unclear, use `architecture.md` and a narrow `rg` search. Do
not begin with a repository-wide scan. Generated artifacts are not source:
edit `media/src/**`, never `media/history.js`, `media/history.css`,
`media/limits.js`, or `media/leaderboard.js` by hand.

## Product invariants worth loading once

These are common regression points. For an affected change, verify them against
the PRD rather than relying on this abbreviated list:

- Current and Today open **Statistics**; a recent-query chip opens the queries
  list. Do not replace that path with Quick Pick.
- The extension host owns secrets. Cursor session tokens, cookies, OpenAI admin
  keys, prompt bodies, and tool output never reach logs, CSV, or webview
  payloads.
- `activate()` starts background work and must not wait for network. Refresh has
  one in-flight request and a timeout.
- The webview is vanilla JS with VS Code theme tokens and a nonce CSP; React,
  Vue, a new Activity Bar, and a localhost service are out of scope.
- Cursor, local Codex, and OpenAI API are separate sources. The status bar and
  Cursor dollar forecast remain on Cursor; an OpenAI API source must never use
  Cursor totals as a fallback.

## Work protocol

1. Restate the bounded outcome internally: behavior, allowed paths, and proof.
2. Inspect only the routed files and the current diff for those paths. Reuse a
   local helper before creating a parallel implementation.
3. Make one coherent patch. Keep parsing, extension-host orchestration, and
   webview rendering in their established layers.
4. Run the smallest relevant check. Escalate to the full validation ladder only
   when the changed surface warrants it or the user requests it.
5. Report the files changed, evidence, and any baseline failure separately from
   a regression caused by the patch.

For a change that crosses core, host, webview, catalogs, and docs, split the
work at those boundaries. A plan is a handoff, not permission to implement all
of its phases in one turn. See [`COST-CONTROL.md`](./COST-CONTROL.md).

## Validation ladder

| Change | Minimum evidence | Add when relevant |
|---|---|---|
| Pure TypeScript logic | focused Vitest file(s) | `npm run typecheck` for exported types |
| Extension host, config, or messages | focused Vitest + `npm run typecheck` | `npm run lint` for `src/**` |
| `media/src/**` | `npm run build` | focused browser-protocol or host tests |
| Cross-layer feature | `npm run typecheck`, `npm test`, `npm run build` | `npm run lint` before review/package |
| Release/VSIX explicitly requested | `npm run package` | security audit before distributing |

The snapshot dated 2026-10-23 records a known baseline: `npm test` had nine
locale-key-parity failures outside English and Polish. Do not label those as a
new regression unless the task touched that surface or the current run shows a
different failure. Never claim a green suite without running it.

## Context upkeep

Update product docs only when the user asks for docs or a change alters a fact
they claim. `codebase-snapshot.md` describes shipped behavior; `prd.md`
describes requirements; `architecture.md` changes with file ownership;
`security.md` changes when data flow, storage, or network trust changes. Use
`11-sync-product-docs` only for its specifically listed documentation sweep.

The links to `implementation-plans/market-2026-09/` currently have no matching
directory in this checkout. Do not spend a turn chasing that missing reference;
ask only if that planned work is explicitly requested.

## Next documents

- [`COST-CONTROL.md`](./COST-CONTROL.md) — how to keep Codex turns short,
  independent, and proportionately verified.
- [`OPENAI-API.md`](./OPENAI-API.md) — boundaries for local Codex history and
  OpenAI API work.
- [`PROMPTS.md`](./PROMPTS.md) — copyable task prompts that name scope and proof
  without pasting a large project brief.
