# Focused Codex prompts

Use these short templates instead of pasting a broad project summary. Replace
the brackets, keep the stated file limit, and begin a fresh session for a new
surface after a long or warning-level turn.

## Orient without editing

```text
Read .ai/codex/README.md and inspect only [paths]. Explain the current behavior
relevant to [question], the constraints that apply, and the smallest safe change.
Do not edit files or run package commands.
```

## Diagnose a reported defect

```text
Investigate [expected behavior] versus [actual behavior]. Read only [up to five
paths] and their focused tests. Check configuration, boundary conditions, and
known baseline failures. Do not edit yet; report evidence, likely cause, and the
smallest testable fix.
```

## Implement one core slice

```text
Implement [single outcome] in [source paths] with tests in [test paths]. Read
.ai/codex/README.md plus the one named plan/PRD section only if needed. Preserve
the existing public behavior outside this slice. Do not wire webview, locales,
docs, version, or VSIX. Run [focused test] and typecheck if exported types change.
```

## Implement one host or webview slice

```text
Implement [visible/host outcome] using only [up to five paths]. Read the relevant
section of .ai/codex/README.md and the matching Cursor rule. Edit media/src, not
generated media files. Preserve source boundaries and secret handling. Run
[build/focused test]; do not package a VSIX or broaden into locales/docs.
```

## Local Codex or OpenAI source work

```text
Read .ai/codex/OPENAI-API.md, .ai/context/security.md, [exact modules], and
[focused tests]. Implement [one approved outcome]. Keep Cursor, Codex local, and
OpenAI API data separate; do not expose credentials, prompt bodies, tool output,
or paths. Report the cost basis and validation evidence. Do not add network calls
unless the request explicitly authorizes the approved product flow.
```

## Review a patch

```text
Review [diff range or named files] against .ai/codex/README.md, relevant PRD
behavior, architecture, security, and focused tests. Do not edit. List findings
first by severity with paths and concrete regression risks; distinguish known
baseline test failures from failures introduced by this diff.
```

## Documentation-only handoff

```text
Update only [named documents] to match [named current code/behavior]. Keep .ai
and code text in English. Do not modify implementation, version, release notes,
site, or locale catalogs unless named. State which fact each edit is based on.
```

## Dedicated packaging task

```text
The implementation is already complete. Run only npm run package and report the
artifact or failure. Do not read unrelated files, edit sources, bump a version,
or repeat the command unless I ask.
```
