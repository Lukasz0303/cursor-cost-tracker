# Cursor Cost Tracker

**See Cursor AI spend without leaving the editor.**

Cursor Cost Tracker is a VS Code–compatible extension for **Cursor**. It puts your current billing-cycle cost and today’s budget on the status bar. One click opens the last 100 queries — time, model, cost, tokens, input/output, and billing kind.

No extra app. No browser tab. No configuration if you are already signed in to Cursor.

| Status bar | History |
|------------|----------|
| `3.79 $ / 250.00 $` · `Today 3.79 $ / 11.19 $` | Table: Last 100 Cursor queries |

---

## Why it exists

Cursor bills chat, agent, and inline edits in dollars and tokens. Official usage lives on the account website. While you work, you do not see:

- how much of the **monthly** limit is already used
- how much of a **daily** budget is left
- which recent query was expensive (model, tokens, kind)

This extension keeps those numbers next to Git and Problems — the same place you already look.

---

## Features

- **Current** — used vs plan/limit for the billing cycle (`Unlimited` when the plan has no cap)
- **Today** — spend vs a daily budget derived from remaining cycle allowance and working days left
- **Last 100** — full history in a native editor panel (click the status bar)
- **Refresh** — manual sync plus polling (default every 5 minutes)
- **Zero setup** — reads the local Cursor session; no API key to paste
- **Windows, macOS, Linux**

Not in scope: payments, team dashboards, other IDEs, estimating cost *before* you send a prompt.

---

## Requirements

- [Cursor](https://cursor.com) signed in on this machine
- Local session database (`state.vscdb`) — the same login Cursor already uses

VS Code can install the VSIX, but data appears only if Cursor is installed and you are logged in (the extension reads Cursor’s user data, not VS Code’s).

Remote SSH / cloud workspaces: the session file is on the **local** UI machine. If the extension host has no access to that file, the status bar shows an error instead of numbers.

---

## Install

The product is not on the marketplace until you publish a VSIX (see [Publishing](#publishing)). Until then:

1. Build a `.vsix` (`npm run package` once the extension exists).
2. In Cursor: **Extensions** → `…` → **Install from VSIX…**
3. Reload the window.

Or from a terminal:

```bash
cursor --install-extension cursor-cost-tracker-0.1.0.vsix
```

After publish, users install from **Cursor → Extensions** by searching **Cursor Cost Tracker** (Open VSX id: `publisher.cursor-cost-tracker`).

---

## Privacy

- The access token never leaves the extension host (it is not sent to the history webview).
- Requests go only to Cursor’s usage APIs (`cursor.com`).
- No analytics, no third-party telemetry in the product design.

This tool uses **unofficial** account APIs and a local session file. Cursor may change either without notice. Treat numbers as a convenience overlay, not a billing invoice.

---

## Publishing

Cursor does **not** install from the Microsoft Visual Studio Marketplace. Third-party extensions in Cursor come from **[Open VSX](https://open-vsx.org/)**, then Cursor’s own marketplace proxy (malware scan + periodic sync, often a few hours).

### What you need before anyone can search-install

| Item | Why |
|------|-----|
| Public GitHub (or other) repo | Review, `repository` field, trust |
| `package.json`: `publisher`, `name`, `displayName`, `license`, `engines.vscode`, icon 128×128 | Marketplace listing |
| Open VSX namespace + access token | `ovsx publish` |
| `engines.vscode` **≤** Cursor’s embedded VS Code (`Help → About`) | Otherwise Cursor **hides** the extension in search |

Microsoft Marketplace is optional (helps VS Code users only). For Cursor, Open VSX is the required store.

### One-time setup

1. Create an [Open VSX](https://open-vsx.org/) account (Eclipse Foundation login).
2. Create a **namespace** matching `publisher` in `package.json` (e.g. `lukasz0303`).
3. Create a **personal access token** in Open VSX.
4. Confirm `license` is `MIT` and `LICENSE` is in the VSIX (do not exclude it in `.vscodeignore`).

### Each release

```bash
npm run build
npx @vscode/vsce package --no-dependencies
npx ovsx publish cursor-cost-tracker-0.1.0.vsix -p %OVSX_PAT%
```

Wait for Open VSX to show the version, then wait for Cursor search (reload window if needed). If search is empty, lower `engines.vscode` to the version Cursor reports.

**Verified publisher** (optional, more trust in Cursor): own domain that links to the Open VSX listing, same extension id, forum post in Cursor’s Extension Verification category. A GitHub README alone is not enough for that badge.

### Private / team only

Skip stores. Ship the VSIX (release asset on GitHub, internal share). Install from VSIX. Fine for personal use; not searchable in Cursor.

---

## License (MIT) — is it OK?

**Yes.** MIT is the usual license for VS Code / Open VSX extensions. Stores expect an SPDX id (`MIT`) and a `LICENSE` file.

**What MIT means (plain language):**

- Anyone may use, copy, modify, merge, publish, and even **sell** the software.
- They must keep the copyright notice and the MIT text in copies.
- There is **no warranty**. You are not liable if it breaks, shows a wrong dollar amount, or Cursor’s API changes.
- You still own copyright. MIT is a **permission**, not a transfer of ownership.
- It does **not** grant Cursor’s trademarks. Do not imply the product is official Cursor software.

**What it does not do:** it does not make unofficial API use “approved” by Cursor. Disclaimer in this README is still required.

Copyright in `LICENSE` is **Łukasz Zileiński**. MIT still does not grant Cursor’s trademarks.

If you ever want “nobody can reuse this commercially”, MIT is the wrong license (use something like BUSL or keep the repo private and distribute VSIX only). For an open extension people can install, **keep MIT**.

---

## Product spec and agent context

- Requirements: [`.ai/context/prd.md`](.ai/context/prd.md) · Polish: [`.ai/context/prd.pl.md`](.ai/context/prd.pl.md)
- Agent index: [`.ai/context/README.md`](.ai/context/README.md)
- Cursor rules: `.cursor/rules/` · commands: `.cursor/commands/`

---

## Status

Product definition and AI workspace are in place. Extension host, status bar, and history panel are not implemented yet.
