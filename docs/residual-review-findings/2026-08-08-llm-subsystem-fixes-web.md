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

## Round 2 — adversarial verification follow-up

| Finding | Disposition | Fix commit | Red evidence | Green evidence |
|---|---|---|---|---|
| P1-15 completion | Maps fail-closed 503 pricing failures to guidance that names registry models and local providers, and maps generic 500 responses to actionable retry/support copy. | `9d426bca` | `useSuggestions.test.ts`: the new 500 and 503 cases both received `Could not generate suggestions.` | Focused hook suite: 11 passed. |
| D1 / D2 | Registry providers retain a disabled model select while models load or fail; registry failures render a visible alert. A saved registry-provider model missing from the registry opens as an explicit custom-model input and can be re-saved. | `9201aa56` | `LLMSettingsSection.test.tsx`: loading rendered a textbox, registry failure had no alert, and an absent saved model had no custom escape. | Focused component suite: 5 passed; `npm run type-check`: passed. |
| D4 | Extracted the existing `toTurtle` unsafe-IRI guard as `assertSafeTurtleIri` and reused it in `toPrefixedOrFull` for both subjects and parents. | `c58306f3` | Snippet-generator subject and parent breakout cases did not throw. | Turtle snippet/utils suites: 93 passed; `npm run type-check`: passed. |
| D5 | Semantic search degrades to text results only for the API's real recoverable statuses, 402 and 503. Authorization 403 and the dead 404 case remain visible errors. | `60031f64` | New 402/503 fallback cases errored, while 404 incorrectly invoked text search. | Focused semantic-search suite: 12 passed; `npm run type-check`: passed. |
| P1-14 completion | `getPendingCount(scope)` filters by project and branch, and both editor-layout badges pass their active scope. Removed the zero-caller `clearSuggestions` store API. | `4b80e3a3` | Cross-project/branch count returned 3 instead of 1; TypeScript rejected the new scoped accessor calls. | Store and suggestions-hook suites: 25 passed; `npm run type-check`: passed. |

The post-implementation review found two follow-ups, fixed in `a24a889a`: the
custom-model escape is now limited to saved models absent from the registry, and
the known-models request disables retries in both React Query and the API client
so its visible failure state is prompt and does not amplify traffic.

D3 remains API-owned. The web does not mask it: generation 503 responses surface the
honest model-pricing guidance above.

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
- Simplification review found no reuse or quality defects. It replaced the
  live pending-count selector's allocation-heavy collection pipeline with one
  scoped loop and simplified derived custom-model state in `99c2217e`.

No files under `components/pr-party/**` or `app/pr-party/**` were changed. No push or PR was created.
