# 2026-08-08 LLM subsystem fixes — web disposition

Branch: `feat/pr-party`  
Worktree: `.worktrees/pr-party`

## Web-owned findings

| Finding | Disposition | Fix commit | Red evidence | Green evidence |
|---|---|---|---|---|
| P0-3 | Added a provider-filtered generation-model picker (with manual model ID entry for providers without registry entries), submits the exact `model` field, disables save until valid, and clears stale models on provider changes. LLM config/status caches are user-scoped and the deliberate unconfigured 404 does not retry. | `55ad9d53`, `95d8dfea` | `npm test -- --run __tests__/components/projects/LLMSettingsSection.test.tsx` failed: no accessible `Generation model` combobox. | Same focused test: 2 passed; `npm run type-check`: passed. |
| P1-4 (web half) | Rejects unsafe IRI characters before emitting `<IRI>` Turtle. Server-side parse validation remains API-owned. | `cefae2ac` | Focused test failed because breakout IRI did not throw. | `__tests__/lib/ontology/turtleUtils.test.ts`: 56 passed. |
| P1-10 | Added `beacon_token` to the session contract and uses the signed response token instead of `session_id`. | `d3203d78` | Hook test expected `signed-beacon-token`, received `sess-1`. | `__tests__/lib/hooks/useSuggestionSession.test.ts`: 17 passed. |
| P1-13 | Disables the API client's internal 5xx retry for generation and suggestion write/review actuations, including approve and bulk review. | `a1ea219b` | Generation API test expected `retryOn5xx: false`, received `undefined`. | Generation and suggestions API focused suites passed. |
| P1-14 | Keys stored suggestions by project, branch, entity IRI, and suggestion type; added cross-project/cross-branch isolation coverage. | `b329f138` | Existing implementation used only `entityIri::suggestionType`; review proof established the collision. | Store and hook focused suites: 18 passed. |
| P1-15 | Maps 400/402/403/429/502 to actionable UI copy, renders that copy in both editor suggestion slots, and invalidates LLM status on 402/429. | `4b0442f6`, `0324a47b`, `95d8dfea` | Prior slots hard-coded `Could not generate suggestions`; no status branch or invalidation caller existed. | Hook/gate tests cover all five statuses and invalidation; Class/Property panel suites passed (225 tests combined). |
| Web type drift | Removed unsupported `anthropic` embedding provider from the TS contract and settings choices. | `9e941f33` | `npm run type-check` failed after narrowing the contract because the stale settings option still existed. | `npm run type-check`: passed. |
| React Query stale/retry states | User-scoped LLM config/usage/search keys; no retry for intentional config 404, LLM gate status, or semantic search; semantic fallback only on not-configured 404, while 401/403/5xx remain visible. The gate no longer treats the API's static `daily_remaining` allowance as live exhaustion. | `0324a47b`, `95d8dfea` | Existing semantic-search test demonstrated catch-all fallback; review identified boolean-only user keys and repeated 4xx retries. | Semantic-search and LLM-gate focused suites passed, including 403 propagation and static-allowance behavior. |

## API-owned findings skipped here

| Finding | Disposition |
|---|---|
| P0-1, P0-2, P0-4, P0-5, P0-6 | API/database/git remedies only; intentionally not changed in ontokit-web. |
| P1-1, P1-2, P1-3 | Pricing, embedding metering, and provider usage accounting are API-owned. |
| P1-5, P1-6 | Prompt construction and Anthropic transport are API-owned. |
| P1-7 | Entity-minting must be detected server-side; adding the untrusted client flag would not fix the trust boundary. |
| P1-8, P1-9 | Git/process and SQL concurrency remedies are API-owned. |
| P1-11, P1-12 | Embedding/index refresh and server-side Turtle/dedup validation are API-owned. |

## Verification

- `npm run type-check` — passed.
- `npm run test` — passed under `CI=1`; authoritative non-watch run: `npm test -- --run`.
- `npm run lint` — exited successfully with 19 warnings and zero errors. No new error was introduced; the warning set consists of existing `react-hooks/set-state-in-effect` findings.
- Simplification review: reuse 0 applied, quality 3 applied (provider/model consistency, neutral event contract, dead gate state), efficiency 0 applied; 2 low-value structural suggestions skipped because they would broaden test/layout churn without improving the reviewed contract.

No files under `components/pr-party/**` or `app/pr-party/**` were changed. No push or PR was created.
