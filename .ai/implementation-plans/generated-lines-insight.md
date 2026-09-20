# v1.7 implementation plan — Generated Lines Insight

**English canonical.** Polish: [generated-lines-insight.pl.md](./generated-lines-insight.pl.md)  
**Status:** research **R1** recorded — shipped in **1.0.4** with Burn Rate Guard  
**Depends on:** MVP baseline (**1.0.3**). Ships in the same PATCH as Burn Rate Guard.  
**Version:** **1.0.4** (PATCH)

If this file and [prd.md](../context/prd.md) disagree, **the PRD wins**.

Usage API events have **no** LOC, diffs, accept/reject, or file paths. AI line counts come from **local Cursor storage** and/or IDE edit heuristics; merged lines come from **git** on the active workspace default branch.

---

## 1. Goal

For the **active workspace** only, answer:

1. How many lines were **added** over time?
2. How many of those were **AI-applied / AI-generated**?
3. What is the **ratio** of AI lines to lines that **landed on `main` or `master`**?

Show three Statistics sections and matching Charts series. These are **two independent volumes** (AI activity vs default-branch insertions), **not** “which AI lines survived code review.”

**Done when:**

- Research spike recorded as **R1**, **R2**, or **R3** in §5.
- Pure aggregate / parse / ratio / default-branch helpers covered by Vitest (no `vscode` in core math).
- Statistics: Added / AI / Ratio-vs-merged; Charts: cumulative AI + merged (shared scale) + ratio callout; empty states honest.
- Toggle `cursorCost.codeLinesInsight` (default **true**).
- No cookie, bubble `text`, or raw diffs in the webview payload.
- `activate()` never blocks on DB/git; `npm test` / `typecheck` green.
- G5 unchanged (no new blocking modal).

---

## 2. Product verdict (what we can show)

| Question | v1 answer |
|----------|-----------|
| AI-applied line volume | Yes if R1/R2; estimate if Fallback A; unavailable if B |
| Lines merged to `main`/`master` | Yes via git numstat |
| Ratio AI : merged | Yes when AI is not null and merged > 0 |
| Exact AI lines that survived onto master | **Out of scope** (needs blame / hunk identity) |

UI copy must state the two counters are independent.

---

## 3. Out of scope

| Item | Why |
|------|-----|
| Usage API for LOC | No fields |
| Multi-workspace / Team sync | Scope = active folder |
| Configurable base branch | v1 auto-detect `main` then `master` |
| Status-bar chip | Density; Statistics + Charts only |
| Blocking modal / toasts | Display-only |
| Reading chat transcript `text` / CoT | PRD non-goal; only structured checkpoint hunks allowed |
| Line-level survival / blame | Later product |
| 7th tab / React | Never |

---

## 4. PRD deltas (ship with the code)

New subsection **Generated Lines Insight**:

- Setting `cursorCost.codeLinesInsight` (default **true**).
- Active workspace only; default branch = `main` if present else `master` else origin/HEAD when available.
- Statistics: three sections — lines added over time, AI lines, AI/merged ratio.
- Charts: cumulative AI vs merged on one Y scale; ratio as callout / secondary series; keep existing tokens / cost / MTD.
- Disclaimer: local inference from Cursor checkpoints and/or edit heuristics + git; not Cursor billing metadata.
- Narrow non-goal: still ban transcript bodies; **allow** structured `checkpointId` hunk metadata (line counts + paths only).

Stories:

- L1: Agent apply increases AI lines on next refresh (R1/R2).
- L2: Merge to default branch increases Merged and updates ratio.
- L3: Charts render without breaking tokens/cost/MTD.
- L4: Large `state.vscdb` does not freeze `activate()`.
- L5: Payload has aggregates only.

---

## 5. Research gate

### 5.1 Hypothesis

`globalStorage/state.vscdb` → `cursorDiskKV`:

| Key | Use |
|-----|-----|
| `checkpointId:{composerId}:{id}` | `files[].originalModelDiffWrtV0[].modified[]` → inserted line count |
| `bubbleId:…` | Optional `suggestedCodeBlocks` / `toolResults` — **no** message `text` |
| `composer.composerHeaders` / workspace map | Filter to active workspace |

### 5.2 Spike steps

1. Copy DB (same pattern as session); never log secrets.
2. Count `checkpointId:%` / `bubbleId:%` keys.
3. Parse 1–3 checkpoints: can we compute `sum(modified.length)`?
4. Map workspace via `workspaceStorage/*/workspace.json` + headers.
5. Size / time budget: selective queries + caps required for host.

### 5.3 Verdict (fill after spike)

| Code | Meaning | Primary AI source |
|------|---------|-------------------|
| **R1** | Checkpoints sufficient | `aiFromCheckpoints` |
| **R2** | Partial | Checkpoints + Fallback A |
| **R3** | Unusable | Fallback A (prefer) or B |

**Recorded verdict: R1** (2026-09-15, local spike on ~349 MB `state.vscdb`)

- Table `composerHeaders` exposes per-composer JSON with **`totalLinesAdded`**, **`totalLinesRemoved`**, **`filesChangedCount`**, **`workspaceIdentifier.uri.fsPath`**, and timestamps. Filter by active workspace path (also matches `workspaceStorage/<hash>/workspace.json`).
- `checkpointId:*` hunks (`original` + `modified[]`) work, but are **cumulative wrt V0** — summing all checkpoints overcounts ~4×. Prefer **header totals**; use **max lines among checkpoints per composer** only as fallback when header fields are missing.
- Empty checkpoints (~40%) are normal. Do **not** read bubble `text`.
- Daily series v1: attribute each composer’s `totalLinesAdded` to the local calendar day of `lastUpdatedAt` (conversation-level; not per-turn).

---

## 6. Definitions

- **`addedLines(t)`** — insertions in period `t` (checkpoint applied **or** document inserts **or** branch commits — one primary after verdict; document in Settings hint).
- **`aiLines(t)`** — AI-attributed insertions; `null` if unknown.
- **`mergedLines(t)`** — `+` lines on default branch in `t` (`git log --numstat`, prefer first-parent for merges; skip binary).
- **`ratio(t)`** — `aiLines / mergedLines` when merged > 0 and ai not null; else null / “no merges yet”.

---

## 7. Fallback ladder

1. **Checkpoints** (R1/R2)  
2. **Fallback A** — `onDidChangeTextDocument` + heuristic “large non-typing apply”; copy says **estimated**  
3. **Fallback B** — git only; AI section unavailable (do not label commits as AI)

---

## 8. Files (after research)

```
src/codeLines/types.ts
src/codeLines/defaultBranch.ts
src/codeLines/gitMerged.ts
src/codeLines/composerHeaders.ts     # R1 primary: totalLinesAdded
src/codeLines/checkpointLines.ts     # fallback max-per-composer (never sum all)
src/codeLines/aggregate.ts
src/codeLines/copy.ts
src/config.ts                        # Phase 2
src/ui/historyRows.ts                # Phase 2 payload.codeLines
src/ui/historyPanel.ts               # Phase 2
src/extension.ts                     # Phase 2 async collect
package.json
media/history.html|css|js            # Phase 2
test/codeLines*.test.ts              # Phase 1 done
```

**Phase 1 status (2026-09-15):** pure modules + Vitest green.  
**Phase 2 status (2026-09-15):** host collect (`composerHeaders` + git), `cursorCost.codeLinesInsight`, Statistics / Charts / Settings wired. Package **1.0.4**.  
**Phase 3 (open):** PRD / README / CHANGELOG / architecture / codebase-snapshot.

---

## 9. Payload (draft)

```typescript
codeLines: {
  enabled: boolean
  source: 'checkpoints' | 'edits' | 'git-only' | 'unavailable'
  disclaimer: string
  summary: {
    added: number
    ai: number | null
    merged: number
    ratio: number | null
    rangeLabel: string
  }
  series: {
    date: string // YYYY-MM-DD local
    added: number
    ai: number | null
    merged: number
    ratio: number | null
  }[]
} | null
```

---

## 10. Charts layout add-ons

Keep tokens, cost, MTD, period cards. Add:

- Cumulative **AI lines** + **merged lines** (two polylines, one Y scale)
- Ratio callout from summary (avoid dual-axis)

---

## 11. Performance / safety

- Cap checkpoints parsed per refresh; incremental where possible.
- Copy DB file; parameterized SQL; never log cookie or bubble text.
- Remote-SSH: local UI DB caveat (document like attribution).

---

## 12. Acceptance checklist

- [ ] Research verdict R1/R2/R3 written in §5.3
- [ ] Vitest for parse / ratio / default branch / numstat
- [ ] Statistics three sections + Charts series
- [ ] Toggle + disclaimer
- [ ] No transcript bodies in payload
- [ ] PRD / architecture / snapshot / webview rule updated (docs turn)
