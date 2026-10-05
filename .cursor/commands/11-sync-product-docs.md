Sync every product-facing description of Cursor Cost Tracker so it matches the code in the working tree. One invocation. Do not implement features, bump `package.json` version, tag, commit, or push unless the user asked for that in the same message.

This is not `7-release-notes` (that one writes `release-notes/*.json` and a git tag).

## Source of truth

Read the code and `package.json` first. Docs follow the code. If a doc and the code disagree, change the doc.

Version string: `package.json` `"version"`. Date: today. Language of `.ai/`, `README.md`, `CHANGELOG.md`, and this command: **English**. `prd.pl.md` stays Polish and must say the same facts as `prd.md`.

Do not mention the gated seventh panel tab (`src/leaderboard/`, `src/unlock/`) in `README.md`, `CHANGELOG.md`, `site/`, `package.json` description/keywords, or `contributes.commands`. A one-line “keep this out of user-facing docs” note in `.ai/context/` is allowed.

## What to read before editing

- `package.json` — version, description, `homepage`, commands, every `cursorCost.*` key
- `CHANGELOG.md` — current version section and anything still under `Unreleased`
- `src/locale.ts` — locale list
- New or changed modules since the snapshot (settings, commands, sample window, forecast, Optimize/Play, pricing, Support, guards)
- Git log since the parent of the current version’s first commit, when you need authors: `git log` and `git log <merge>^2 --not <merge>^1` per contributor merge

## Files to update (all of them, same turn)

| File | Keep it aligned with |
|------|----------------------|
| `.ai/context/codebase-snapshot.md` | What the tree does today, plus a history table of **1.0.0 through the current version**. Dated test count only if you actually run `npm test` once |
| `.ai/context/prd.md` | Behavior, commands, settings, phases. Bump the document version and date |
| `.ai/context/prd.pl.md` | Same facts as `prd.md` |
| `.ai/context/architecture.md` | File ownership and data flow |
| `.ai/context/README.md` | Short canonical summary and links. No second full PRD |
| `.ai/context/tech-stack.md` | Runtime, HTTP hosts, CI, tests |
| `.ai/context/security.md` | Token, CSP, command URI allowlist, FormSubmit, public pricing fetch |
| `.ai/context/publishing.md` | VSIX filename for the current version, homepage, Pages vs CI |
| `.ai/context/plan.md` | Only if a new plan folder or this command path is missing |
| `README.md` | Marketplace description: features, comparison table, settings, FAQ, contributors |
| `CHANGELOG.md` | Current version section. User-facing sentences, not class names |
| `site/index.html` | Fallback `<span data-version>` |
| `site/i18n.js` | Every `footer.fine` `data-version` (one replace across locales) |
| `site/README.md` | Fallback version sentence |

Skip implementation plans, locale catalogs under `src/i18n/catalogs/`, `media/`, and `.cursor/rules/` unless the user named them. Do not rewrite `shared.mdc` except when a new top-level `src/` folder changes the project map.

## Changelog and contributor credits

- If the user is cutting the release (this message says release / wypuszczam / 1.0.x), move **Unreleased** bullets into that version and delete the empty Unreleased heading. Otherwise leave Unreleased, and still describe landed behavior in the snapshot and PRD.
- Each change that came from someone other than the publisher gets a Prettier-style credit on **that bullet**, in `CHANGELOG.md` and again next to the same fact in `README.md`:

```markdown
([#11](https://github.com/Lukasz0303/cursor-cost-tracker/pull/11) by [@milichev](https://github.com/milichev))
```

Use the PR number, the repo `Lukasz0303/cursor-cost-tracker`, and `https://github.com/<login>`. Login comes from the PR head (`from <login>/…`) or the commit author. Do not invent a display name; git’s author name is enough for the Contributors list.

- `README.md` **Contributors** lists each person once, with profile link and their PRs. Publisher-only work has no `@` credit.
- Do not credit docs-only commits as their own changelog feature. Credit the user-visible fix or feature those commits belong to.

## Still not shipped

If the code does not have it, say so in the snapshot and do not mark it done in the README comparison table. Known leftovers until the code says otherwise: table Ignore, Today pace arrows, model-cost simulator, 80/90% spend alerts, Copy stats, Secret Storage.

## After editing

Reply in the user’s language. Table: file, what changed. Do not commit.
