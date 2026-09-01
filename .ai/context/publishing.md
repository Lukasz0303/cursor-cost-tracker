# Publishing and install

Cursor does **not** install from the Microsoft Marketplace. Third-party extensions: **Open VSX** → Cursor’s proxy (scan + sync, often a few hours).

## Local (MVP)

```bash
npm run build
npx @vscode/vsce package --no-dependencies
cursor --install-extension ./cursor-cost-tracker-0.1.0.vsix
```

Or: Extensions → Install from VSIX.

## Open VSX (when the product should be searchable)

1. Account + namespace matching `publisher` in `package.json`.
2. Open VSX PAT.
3. `npx ovsx publish <file.vsix> -p <token>`.
4. `engines.vscode` ≤ the VS Code version from Cursor Help → About.
5. `LICENSE` (MIT) **inside** the VSIX — do not exclude it in `.vscodeignore`.

The Microsoft Marketplace is optional and does not help Cursor users.

128×128 icon, `displayName`, `repository`, `license: MIT` are required for listings.

Unofficial API: disclaimer in the README. Do not imply this is an official Cursor product.
