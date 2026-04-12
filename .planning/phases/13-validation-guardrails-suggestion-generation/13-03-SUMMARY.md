---
phase: 13-validation-guardrails-suggestion-generation
plan: "03"
subsystem: ontokit-api
tags: [llm, suggestion-generation, validation, api-endpoints, tdd]
dependency_graph:
  requires: [13-01, 13-02]
  provides: [suggestion_generation_service, generation_routes]
  affects: [ontokit-api/ontokit/api/routes, ontokit-api/ontokit/services]
tech_stack:
  added: []
  patterns: [tdd-red-green, sequential-async-pipeline, byo-key-routing, audit-log-pattern]
key_files:
  created:
    - ../ontokit-api/ontokit/services/suggestion_generation_service.py
    - ../ontokit-api/ontokit/api/routes/generation.py
  modified:
    - ../ontokit-api/ontokit/api/routes/__init__.py
    - ../ontokit-api/tests/unit/test_suggestion_generation.py
decisions:
  - "SuggestionGenerationService.generate() runs validate+dedup sequentially per suggestion — AsyncSession not safe for concurrent use (Pitfall 5)"
  - "check_budget returns (bool, reason) tuple — generation route maps daily_cap_reached vs budget_exhausted to distinct 402 messages"
  - "generate_suggestions catches non-auth LLM errors and returns empty suggestions list rather than 500 — prevents cascade failures from malformed LLM output"
  - "validate-entity endpoint defaults to branch='main' since request has no branch param — consistent with ValidateEntityRequest schema"
metrics:
  duration_minutes: 15
  completed_date: "2026-04-07"
  tasks_completed: 2
  files_changed: 4
---

# Phase 13 Plan 03: Suggestion Generation Service and API Endpoints Summary

SuggestionGenerationService composing context assembly + LLM + validation + dedup into typed endpoints with rate limiting, budget enforcement, and BYO-key routing.

## What Was Built

### Task 1: SuggestionGenerationService (TDD)

**File:** `ontokit/services/suggestion_generation_service.py`

Implements the full 7-step pipeline defined in RESEARCH.md Pattern 3:

1. `OntologyContextAssembler.assemble()` — fetches current class, parents, siblings (GEN-06)
2. `PROMPT_BUILDERS[suggestion_type](context, batch_size)` — type-specific prompt (GEN-07)
3. `provider.chat(messages)` — LLM call returns `(text, input_tokens, output_tokens)`
4. `_parse_json_safe(text)` — strips markdown fences, extracts `suggestions` list (Pitfall 3)
5. `_normalize_confidence(raw)` — scales >1.0 values by /100, returns None for non-numeric (Pitfall 4 / GEN-08)
6. Per-suggestion sequential loop: `mint_iri()` + `ValidationService.validate_entity()` + `DuplicateCheckService.check()` (Pitfall 5 — sequential to avoid AsyncSession concurrent use)
7. Tags each suggestion with `provenance="llm-proposed"` (GEN-09)

**Tests:** 13 real async tests replacing Wave 0 stubs — 0 `pytest.skip` remaining.

### Task 2: Generation API Endpoints

**File:** `ontokit/api/routes/generation.py`

**POST /projects/{project_id}/llm/generate-suggestions**
- Role gate via `check_llm_access()` — owner/admin/editor/suggester only
- Rate limit via `check_rate_limit()` — Redis-backed, fails open if Redis unavailable
- Budget check via `check_budget()` — daily cap + monthly budget enforcement
- BYO-key routing: `X-BYO-API-Key` header wins over stored project key (never logged)
- Constructs all services, calls `SuggestionGenerationService.generate()`
- Audit log via `log_llm_call()` — metadata only, no prompt/response content
- Error handling: 403/402/429/404/502 with descriptive messages; non-auth LLM errors return empty suggestions (not 500)

**POST /projects/{project_id}/llm/validate-entity**
- Any project member can validate (no LLM config required)
- Calls `ValidationService.validate_entity()` with all VALID-* rules
- Returns `ValidateEntityResponse(valid=bool, errors=[ValidationError])`

**Registered in `__init__.py`** following established router pattern.

## Test Results

```
217 passed, 14 skipped, 0 failed
```

All 13 GEN-01..09 tests pass. No regressions in full suite.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] RequiredUser dependency injection pattern**
- **Found during:** Task 2 implementation
- **Issue:** The plan's endpoint signature used `Annotated[dict, Depends(RequiredUser)]` but the actual pattern in `llm.py` uses `user: RequiredUser` directly (RequiredUser is itself an Annotated type alias)
- **Fix:** Used `user: Annotated[RequiredUser, Depends()]` which matches FastAPI's dependency resolution for Annotated type aliases
- **Files modified:** `ontokit/api/routes/generation.py`
- **Commit:** 481284a

**2. [Rule 2 - Missing Critical Functionality] `validate-entity` branch parameter**
- **Found during:** Task 2 — `ValidateEntityRequest` has no `branch` field
- **Issue:** The plan called for `request.branch` but the schema has no such field
- **Fix:** Defaulted to `branch="main"` for the validate-entity endpoint — consistent with schema definition and typical use case (validating before submission)
- **Files modified:** `ontokit/api/routes/generation.py`
- **Commit:** 481284a

## Known Stubs

None — all pipeline steps are wired to real services. The `context_tokens_estimate` field in `GenerateSuggestionsResponse` is intentionally `None` (some providers don't expose pre-call token estimates) — this is by design in the schema, not a stub.

## Self-Check

Files created:
- `../ontokit-api/ontokit/services/suggestion_generation_service.py` — exists
- `../ontokit-api/ontokit/api/routes/generation.py` — exists

Files modified:
- `../ontokit-api/ontokit/api/routes/__init__.py` — generation router registered
- `../ontokit-api/tests/unit/test_suggestion_generation.py` — 13 real tests, 0 stubs

Commits:
- `1fa317e` — TDD RED: 13 failing tests
- `3399045` — TDD GREEN: SuggestionGenerationService implementation
- `481284a` — API endpoints + router registration
