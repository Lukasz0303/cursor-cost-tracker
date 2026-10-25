# Phase 6 — Organization comparison

**Parent:** [openai-codex.md](./openai-codex.md) §9 phase 6
**Status:** later minor. Do not start until the PRD allows an opt-in admin client.
**Depends on:** [phase-5-recorder.md](./phase-5-recorder.md)
**Next:** [phase-7-analysis.md](./phase-7-analysis.md)
**Polish:** [phase-6-organization.pl.md](./phase-6-organization.pl.md)

If this file and the parent plan disagree, **the parent plan wins**. If either disagrees with the PRD, **the PRD wins**.

One Agent message. Touch only the paths in §3.

---

## 1. Goal

Show the local estimate and the reported organization cost for the same org, project, time, model, and unit. Those dollars are not written onto requests and are not a ChatGPT plan balance.

**Done when:**

- A sync error leaves local rows in place (acceptance 16).
- Organization cost is not added to request rows and is not subtracted from a ChatGPT plan (acceptance 17).
- The admin key lives in `context.secrets`. It is not a setting, not in the webview, not in CSV, not in logs.

---

## 2. Out of scope

| Item | Why |
|------|-----|
| Turning buckets into request rows | They are aggregates |
| Polling faster than 15 minutes | Parent contract |
| Blocking `activate()` on the network | `activate()` stays non-blocking |

---

## 3. Files

```
src/openaiHistory/org/client.ts
src/openaiHistory/org/buckets.ts
src/openaiHistory/store/migrations.ts
src/ui/historyPanel.ts
media/src/tabs/stats.js
test/openaiOrgBuckets.test.ts
```

Migration **4** adds `billing_buckets`. Unique `(scope_id, start_at, end_at, dimensions_hash)`.

`historyPanel.ts` and `stats.js` only for the comparison card. Do not change request totals.

---

## 4. Client

Manual refresh plus a 15-minute poll. Re-fetch the recent window and replace buckets that share the same scope and range. Follow `next_page`. On HTTP 429, back off and keep the previous buckets. Timeout does not delete local requests.

Endpoints, after the PRD names them:

```text
GET https://api.openai.com/v1/organization/usage/completions
GET https://api.openai.com/v1/organization/costs
```

The key is read from Secret Storage at call time. The webview posts `openai.orgRefresh` only. It never posts the key.

Compare only a matching org, project, time, model, and unit. Statistics shows `localTokenEstimate` and `reportedOrganizationCost` as two figures. A missing dimension hides the comparison instead of forcing a match.

---

## 5. Tests

- Fixture buckets replace the same range and do not duplicate.
- A thrown client leaves previously inserted requests and buckets unchanged.
- A mapper that is handed both a request row and a bucket does not write the bucket amount onto `reported_cost_usd`.
- The client module’s exported request builder has no field that accepts a key into a return value logged by tests (the key parameter is used as a header inside the injected `fetch` and is absent from thrown error messages).

---

## 6. Handoff

Phase 7 stores analysis runs. It does not reprice from organization buckets.
