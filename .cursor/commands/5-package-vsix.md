Build the extension VSIX (esbuild + vsce) per `.ai/context/publishing.md`.

## Instructions

If `package.json` is missing — stop: scaffold the extension first.

Otherwise, in order:

```bash
npm run build
npx @vscode/vsce package --no-dependencies
```

Confirm a `*.vsix` was created and that `.vscodeignore` does **not** exclude `dist/`, `media/`, or `LICENSE`.

## After running

- VSIX path
- file size
- vsce / esbuild errors
- reminder: do not commit the VSIX unless the user wants a release asset
