Run Vitest unit tests per `.ai/context/tech-stack.md`.

## Instructions

If there is no `package.json` / `test` script yet, stop and say tests do not exist (pre-implementation in `codebase-snapshot.md`). Do not invent a green result.

When the script exists:

```bash
npm test
```

(Windows: same npm. If `package.json` uses `npx vitest run`, use that.)

## After running

Table:

| Component | Status | Count | Details |
|-----------|--------|-------|---------|
| Unit (Vitest) | OK / FAIL | X/Y | parse, format, … |

Then: what failed and a fix proposal. Do not commit.
