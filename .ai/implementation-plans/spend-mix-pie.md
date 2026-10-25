# Spend mix pie

**English canonical.** Polish: [spend-mix-pie.pl.md](./spend-mix-pie.pl.md)
**Parent:** [feedback-2026-10-25.md](./feedback-2026-10-25.md)
**Status:** shipped in 1.0.8. The tree has more chips than this note (Model, Size, Limit, Kind, Conversations, Cache, plus Vendor and Grade). [prd.md](../context/prd.md) wins.
**Depends on:** the loaded Last N / From–To sample (`UsageQuery`). Workspace slices wait on [additional/project-cost-attribution.md](./additional/project-cost-attribution.md), which is also unshipped.
**Version:** unset. Do not bump `package.json` for this note.

If this file and [prd.md](../context/prd.md) disagree, **the PRD wins**.

The ask: one pie of **billed** spend. Slice the same requests by workspace directory, by model vendor (Anthropic, OpenAI, Cursor, …), or by a model grade (cheap / balanced / high). Grades are a JSON list a user can edit. A pivot-builder UI is explicitly not worth it.

---

## 1. Goal

On **Statistics**, under the existing spend-by-model bars, show one pie (or donut) of `costUsd` for the current sample.

Three chips pick the dimension:

| Chip | Slice key | When |
|------|-----------|------|
| Vendor | Provider name | First slice. No new Cursor API. |
| Grade | Bucket id from the JSON list | First slice. Ships with a built-in example. |
| Workspace | Stamped project folder | Hidden until project attribution stores a folder on the row. |

**Done when:**

- Pure classify + aggregate covered by Vitest (no `vscode`, no DOM).
- Vendor and Grade render from the sample. A row with `costUsd === 0` does not inflate a dollar slice.
- Invalid JSON does not replace the last good bucket list.
- Workspace is absent from the pie until attribution exists. The plan does not invent a directory from the usage event.
- `npm test` / `typecheck` green for the new modules.

---

## 2. What the usage event does not contain

`UsageQuery` (`src/usage/types.ts`) is timestamp, model, kind, dollars, and token counts, plus an optional conversation id. There is **no** workspace path, cwd, or vendor field.

That matches the report: the active directory cannot be read off the LLM query. Do not scan composer JSON or the chat transcript to guess it. Project attribution, if it lands, stamps the workspace that was open when this extension first saw the row. Historical rows stay **Unattributed**. The pie must say that in one line when the Workspace chip is on.

Vendor **is** recoverable without that stamp:

1. Join the query model id to the account catalog (`src/pricing/accountModels.ts` already reads `vendorName` / `vendor.displayName` into `provider`).
2. If the id is not in the catalog, a small local map: `claude` → Anthropic, `gpt` / `o1` / `o3` / `o4` → OpenAI, `grok` → xAI, `gemini` → Google, `cursor` / `composer` → Cursor.
3. Else **Unknown**.

The map is a fallback, not a price list. Do not fetch a new pricing page for this.

---

## 3. Grade buckets

Built-in example, first match wins, case-insensitive substring on the model id:

```json
{
  "buckets": [
    { "id": "cheap", "label": "Cheap", "match": ["luna", "haiku"] },
    { "id": "balanced", "label": "Balanced", "match": ["terra", "sonnet"] },
    { "id": "high", "label": "High", "match": ["sol", "opus"] }
  ]
}
```

Unmatched models go to **Other**. Empty `match` is invalid.

Settings → a collapsed fieldset **Spend mix**, one multiline text area, Apply / blur. Show the example as placeholder text. The webview posts the string. The host validates.

Schema rules:

- At most **8** buckets, **32** match strings, **4 KB** of JSON.
- `id`: `^[a-z][a-z0-9-]{0,31}$`, unique.
- `label`: 1–40 characters, plain text.
- `match`: 1–24 strings, each 1–40 characters, no regex.

Use `zod` in `src/spendMix/schema.ts` only. esbuild may bundle it into `dist/extension.js`. Do not import `zod` from `media/`. On failure, keep the previous list and surface the issue on the fieldset. Do not throw into the usage poll.

Default when the setting is empty: the example above, held in code, not parsed from the placeholder.

This is the whole configuration UI. No add-row form, no drag-and-drop, no per-user pivot designer.

---

## 4. Pie

- Dollars only (`costUsd`). Title makes that obvious: billed spend, not list price, not included-quota percent.
- If the sample’s billed sum is 0, skip the pie and say the sample has no billed dollars. Do not silently switch the pie to tokens.
- Slices under 1% of the total collapse into **Other** (after the grade **Other**, merge by label).
- Legend: label, dollars, share. No seventh tab. SVG in `media/src/charts/`, same `--vscode-*` tokens as the other charts.
- Dimension chips are client-side. They do not refetch usage.
- One sentence under the pie: the mix is this sample (Last N or From–To), not the invoice.

Workspace chip: render only when rows carry a project stamp. Until [project-cost-attribution.md](./additional/project-cost-attribution.md) lands, do not add the chip and do not add an empty state that implies the directory was on the query.

---

## 5. Files

| Phase | Paths |
|-------|--------|
| 1. Core + Vitest | `src/spendMix/schema.ts`, `src/spendMix/classify.ts`, `src/spendMix/aggregate.ts`, `test/spendMix.test.ts`. Add `zod` in this phase only. |
| 2. Wire | `package.json` key `cursorCost.spendMixBuckets` (string, default `""`), `src/config.ts`, Statistics mount in `media/src/tabs/stats.js`, pie drawer `media/src/charts/spendMix.js`, `media/history.html` fieldset, `src/i18n/catalogs/en.ts`, `src/i18n/catalogs/pl.ts`. |
| Later | Other locale catalogs. Workspace slices, and only after attribution stamps exist. |
| Docs | PRD / README / CHANGELOG in a separate turn, when the slice ships. |

Phase 1 does not touch `media/`. Phase 2 does not add Workspace.

---

## 6. Out of scope

| Item | Why |
|------|-----|
| Reading a directory out of the usage API or the transcript | The field is not there. Attribution is a different plan. |
| Pivot builder, saved views, shared team configs | The ask says a text area is enough. |
| Regex matchers | User input as a regex is an easy footgun. Substring only. |
| List-price pie, token pie, kind pie | Spend-by-model and spend-by-kind bars already exist. |
| Status bar, Optimize prompt, CSV column | Statistics only, until a later ask. |
| React / chart library | Vanilla SVG. |

---

## 7. Security

The text area is local settings. Parse with `JSON.parse` on a length-capped string, then Zod. No `eval`, no `Function`, no network. The pie payload is aggregates (label, dollars, share). It must not add the session cookie, the email, or prompt text.
