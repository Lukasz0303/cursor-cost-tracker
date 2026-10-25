# Agent instructions — Cursor Cost Tracker

Read [`.ai/codex/README.md`](.ai/codex/README.md) before implementing. It is the
Codex task router: it names the smallest required context, validation command, and
the docs to update. Do not load every historical plan by default.

Read [`.ai/context/README.md`](.ai/context/README.md) before a product-affecting
change. Read the canonical English PRD only for behavior that the change can affect.

- Product requirements: [`.ai/context/prd.md`](.ai/context/prd.md) (English, canonical) · [`.ai/context/prd.pl.md`](.ai/context/prd.pl.md) (Polish)
- Stack: [`.ai/context/tech-stack.md`](.ai/context/tech-stack.md)
- MVP plan: [`.ai/implementation-plans/mvp.md`](.ai/implementation-plans/mvp.md) (English) · [`.ai/implementation-plans/mvp.pl.md`](.ai/implementation-plans/mvp.pl.md) (Polish)
- Token spike / Ignore: [`.ai/implementation-plans/token-spike.md`](.ai/implementation-plans/token-spike.md)
- Burn Rate Guard (1.0.4): [`.ai/implementation-plans/burn-rate-guard.md`](.ai/implementation-plans/burn-rate-guard.md)
- Generated Lines Insight (1.0.4): [`.ai/implementation-plans/generated-lines-insight.md`](.ai/implementation-plans/generated-lines-insight.md)
- Additional / backlog: [`.ai/implementation-plans/additional/README.md`](.ai/implementation-plans/additional/README.md)
- Market follow-ups (historical): read only if the requested plan directory is
  present in the checkout; see `.ai/codex/README.md` for the known missing link.
- Always-on rules: [`.cursor/rules/shared.mdc`](.cursor/rules/shared.mdc)

## Codex workflow

- Task routing, repository state, and validation: [`.ai/codex/README.md`](.ai/codex/README.md)
- Cost and context controls: [`.ai/codex/COST-CONTROL.md`](.ai/codex/COST-CONTROL.md)
- Safe OpenAI API / local Codex-history changes: [`.ai/codex/OPENAI-API.md`](.ai/codex/OPENAI-API.md)
- Reusable focused requests: [`.ai/codex/PROMPTS.md`](.ai/codex/PROMPTS.md)

The MVP and OpenAI/Codex phase documents are historical implementation plans. Do
not restart their phase numbering or trust an old “planned” status over current
code, `.ai/context/codebase-snapshot.md`, or the PRD.

Language: **English** for `.ai`, Cursor commands, code, commits, and MVP UI.
