# Do not rewrite the panel in React or Svelte

**English canonical.** Polish: [webview-rewrite.pl.md](./webview-rewrite.pl.md)
**Parent:** [feedback-2026-10-25.md](./feedback-2026-10-25.md)
**Status:** rejected. There is no implementation phase.
**Checked:** 2026-10-25. The split this note relies on is [datetime-media-foundation.md](./datetime-media-foundation.md), status implemented.

The note agreed that the next stretch should be stabilization, bugfix, and tests, and then floated a new `media/` UI in React because generated code is weak at maintaining the current large file. Svelte was mentioned as possibly cheaper in tokens. The same note already doubted the rewrite would be cheaper even over a long run.

That doubt is the decision.

---

## 1. Decision

Keep the vanilla panel. Do not start a React or Svelte port of `media/`.

[shared.mdc](../../.cursor/rules/shared.mdc) already forbids React in this panel. The foundation plan already lists “Rewrite webview in TypeScript / React” as out of scope, because it is too expensive next to vanilla modules.

The maintenance pain was real when the UI was one IIFE. The sources now live under `media/src/` (`tabs/`, `charts/`, `session.js`). `media/history.js` is the esbuild output and is not hand-edited. A new framework would re-buy every tab: queries, Statistics, Charts, Optimize, Support, Settings, and the Codex sheets.

---

## 2. Why a port is not the cheaper maintenance path

- The host already owns the logic that is worth unit-testing (usage, groups, forecast series, guards). The webview paints. Moving the paint to React does not make the host modules easier, and it adds a second runtime to every CSS and CSP change.
- CSP is `default-src 'none'` with a nonce. A framework build has to keep that. It is not a free component tree.
- Svelte’s smaller output does not pay for re-implementing the forecast chart, the grouped sheet, Optimize, and Settings. Token cost of a port is the whole surface, not the size of one component file.
- Stabilization, which the note asked for first, is delayed by a port. Every behavior has to be re-proven. The open product gaps are the pie and the column sort, both of which fit the current modules.

---

## 3. What to do instead

- Fix bugs in the module that owns them. One slice, the paths named in that slice.
- Add Vitest on the host pure functions. Do not chase coverage inside `media/src` by rewriting it.
- When a tab file grows again, split that tab. That is the foundation plan, not a new framework.

No `package.json` dependency, no `media/` scaffold, no version bump.
