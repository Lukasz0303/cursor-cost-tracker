# Publishing and install

Cursor does **not** install from the Microsoft Marketplace. Third-party extensions: **Open VSX** → Cursor’s proxy (scan + sync, often a few hours).

## Local (MVP)

```bash
npm run build
npx @vscode/vsce package --no-dependencies
cursor --install-extension ./cursor-cost-tracker-1.0.2.vsix
```

Or: Extensions → Install from VSIX.

## Open VSX (when the product should be searchable)

1. Account + namespace matching `publisher` in `package.json`.
2. Open VSX PAT.
3. `npx ovsx publish <file.vsix> -p <token>`.
4. `engines.vscode` ≤ the VS Code version from Cursor Help → About.
5. `LICENSE` (MIT), **`icon.png`**, and **`CHANGELOG.md`** **inside** the VSIX — do not exclude them in `.vscodeignore`.

The Microsoft Marketplace is optional and does not help Cursor users.

Listing requires `displayName`, `repository`, `license: MIT`, `"icon": "icon.png"`, and root [`CHANGELOG.md`](../../CHANGELOG.md) (Open VSX / Cursor **Changelog** tab). Product icon: repo-root [`icon.png`](../../icon.png) (PNG, at least 128×128). Do not use Cursor’s cube or the VS Code logo in the icon. Do not exclude `CHANGELOG.md`, `LICENSE`, or `icon.png` in `.vscodeignore`.

**README / Details tab:** Open VSX and Cursor show root [`README.md`](../../README.md). Screenshots live in [`screenshots/`](../../screenshots/) and use relative paths (`screenshots/status_bar.png`, …). `vsce` / `ovsx` rewrite those to GitHub raw URLs using `package.json` `repository` — so **`screenshots/` must be on the default branch** before (or with) the publish that should show them. Keep `screenshots/**` out of the VSIX (see `.vscodeignore`); the gallery loads images from GitHub, not from the package.

Unofficial API: disclaimer in the README. Do not imply this is an official Cursor product.
