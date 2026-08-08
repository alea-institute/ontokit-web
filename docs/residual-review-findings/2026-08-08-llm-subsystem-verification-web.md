# LLM-Subsystem Fix Verification (Web) — 2026-08-08

Adversarial verification of the web fix round (7ac21727..c55db363). Fresh-context
Opus verifier; suite (3170) + tsc re-run green independently.

## Verdicts
- VERIFIED-FIXED: P1-4 (toTurtle guard, both branches), P1-10 (beacon token wired,
  schema-matched), P1-13 (retryOn5xx:false on generate + all 10 actuations), React
  Query key scoping (token-carrying keys, retry:false, prefix invalidation intact),
  embedding provider type drift, dailyExhausted dead-end removal.
- PARTIAL P0-3: picker renders, saves model, gate truthful, contract matches the
  API exactly — but no loading/error surface on the models query (D1/D2) and the
  `custom` provider dead-ends (D3, API-side set mismatch).
- PARTIAL P1-14: storeKey now project::branch::iri::type and accessors updated, but
  `getPendingCount()` still flattens the whole store → cross-project badge counts
  (suggestionStore.ts:100-112; consumed in both editor layouts); `clearSuggestions`
  has zero non-test callers.
- PARTIAL P1-15: 400/402/403/429/502 mapped + status-invalidation events consumed;
  the API's NEW fail-closed 503 (pricing unavailable) and 500 fall to the generic
  string — the exact path a mistyped model produces.

## New defects
- D3 (High): API `generation.py` pricing exemption omits `custom` while llm.py's
  _LOCAL_PROVIDERS includes it → every generate on a custom endpoint 503s (web
  offers custom as isLocal). Fix is API-side set alignment; web shows the fallout.
- D2 (Med): free-text-vs-select chosen on providerModels.length>0, which is false
  while the models query is IN FLIGHT → fast users type arbitrary models for
  registry providers; the select-branch `disabled={isModelsLoading}` is unreachable.
- D1 (Med): failed GET /llm/known-models silently degrades to free-text with no
  surfaced error; no custom-model escape when a saved model is absent from the
  registry (that user can never re-save).
- D4 (Low-Med): turtleSnippetGenerator.ts:130 `toPrefixedOrFull` still emits
  `<${iri}>` unvalidated (called from editor page); the P1-4 guard covers toTurtle
  only.
- D5 (Low): useSemanticSearch falls back to text search on 404 only, but the API
  never raises 404 (402/403/503) — fallback is dead code and an embedding 503 now
  errors the search box where it used to degrade.

## Scope/contract checks
pr-party dirs untouched (diff empty). known-models route + schema match TS types
exactly; LLMConfigUpdate.model accepted; local providers intentionally registry-less.

## Verdict
Web side conditionally DEV-ready alone; before deploy fix D3 (API set alignment)
and map 503 in generationErrorMessage; D1/D2/D4/D5 + P1-14 completion in round 2.
