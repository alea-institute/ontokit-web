---
phase: 12-toolchain-integration-duplicate-detection
plan: "04"
subsystem: api
tags: [duplicate-detection, composite-scoring, embeddings, fastapi, pytest, async, pydantic]

requires:
  - phase: 12-02
    provides: StructuralSimilarityService.compute_similarity(), DuplicateRejection model, Pydantic schemas
  - phase: 12-03
    provides: EmbeddingService.semantic_search_all_branches() for cross-branch ANN search

provides:
  - DuplicateCheckService at ontokit/services/duplicate_check_service.py
  - POST /projects/{project_id}/duplicate-check endpoint returning DuplicateCheckResponse
  - SuggestionService.reject() extended to record DuplicateRejection records (D-10/D-11)
  - SuggestionRejectRequest with entity_iri + canonical_iri fields (D-10)

affects: [phase-13-suggestion-generation, phase-14-duplicate-ux, any caller of POST duplicate-check]

tech-stack:
  added: []
  patterns:
    - "Composite scoring: EXACT_WEIGHT=0.40 + SEMANTIC_WEIGHT=0.40 + STRUCTURAL_WEIGHT=0.20 (D-01)"
    - "Verdict thresholds: >0.95 block, >0.80 warn, <=0.80 pass (D-02)"
    - "Source classification: main/pending/rejected via SuggestionSession.status lookup (D-09)"
    - "Rejection history: DuplicateRejection queried by entity IRI, NOT branch name (D-11 critical)"

key-files:
  created:
    - ontokit/services/duplicate_check_service.py
    - ontokit/api/routes/duplicate_check.py
    - tests/unit/test_duplicate_check.py (replaced 7 stubs with real tests)
  modified:
    - ontokit/schemas/suggestion.py (entity_iri + canonical_iri fields on SuggestionRejectRequest)
    - ontokit/services/suggestion_service.py (DuplicateRejection creation in reject())
    - ontokit/api/routes/__init__.py (duplicate_check router registered)

key-decisions:
  - "rejected_iri in DuplicateRejection MUST be the entity IRI (data.entity_iri), NOT the session branch — _get_rejection_info queries by entity IRI so using branch name would always return empty"
  - "SuggestionSessionStatus uses string values with hyphens ('auto-submitted', 'changes-requested') — compared against .value not name"
  - "Structural score forced to 0.0 when no parent_iri provided — avoids meaningless similarity between arbitrary IRIs"
  - "Test block verdict requires parent_iri to enable structural score; pure exact+semantic max = 0.80 which is at pass threshold boundary"

patterns-established:
  - "AsyncMock with side_effect pattern for mocking async service methods in unit tests"
  - "Route registered without prefix in router, prefix carried by include_router in __init__.py (consistent with other routes)"

requirements-completed: [DEDUP-04, DEDUP-05, DEDUP-06, DEDUP-07, DEDUP-08]

duration: 18min
completed: 2026-04-06
---

# Phase 12 Plan 04: Composite Duplicate Check Service Summary

**POST /projects/{id}/duplicate-check with 40/40/20 composite scoring (exact+semantic+structural), block/warn/pass verdicts, source classification, and rejection history surfacing**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-04-06T21:50:00Z
- **Completed:** 2026-04-06T22:08:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- DuplicateCheckService composites exact (40%), semantic (40%), structural (20%) scores per D-01 with block/warn/pass thresholds at 0.95/0.80 per D-02
- `_classify_source()` maps branches to main/pending/rejected via SuggestionSession.status database lookup (D-09)
- `_get_rejection_info()` surfaces rejection_reason and canonical_iri for previously-rejected candidates (D-11)
- SuggestionService.reject() now records DuplicateRejection rows when canonical_iri + entity_iri provided (D-10/D-11)
- SuggestionRejectRequest extended with optional entity_iri + canonical_iri — non-duplicate rejections unchanged
- POST /projects/{project_id}/duplicate-check endpoint registered and returning full DuplicateCheckResponse (D-13)
- All 7 Wave 0 test stubs replaced with passing async unit tests; full suite: 162 passed, 14 skipped

## Task Commits

1. **Task 1: Create DuplicateCheckService with composite scoring** - `a884e27` (feat)
2. **Task 2: Create duplicate-check API endpoint and implement all tests** - `2a07937` (feat)

## Files Created/Modified

- `ontokit/services/duplicate_check_service.py` — DuplicateCheckService with check(), _classify_source(), _get_rejection_info()
- `ontokit/api/routes/duplicate_check.py` — POST /projects/{project_id}/duplicate-check endpoint
- `ontokit/api/routes/__init__.py` — duplicate_check router import + include_router
- `ontokit/schemas/suggestion.py` — entity_iri + canonical_iri optional fields on SuggestionRejectRequest
- `ontokit/services/suggestion_service.py` — DuplicateRejection record creation in reject() method
- `tests/unit/test_duplicate_check.py` — 7 real tests replacing stubs (DEDUP-04/05/06/07/08, D-01/D-09/D-13)

## Decisions Made

- **rejected_iri must be entity IRI, not branch**: `_get_rejection_info()` queries `DuplicateRejection.rejected_iri` by entity IRI. If the branch name were stored instead, lookups would always return empty. Plan's CRITICAL note preserved.
- **Structural score only when parent_iri provided**: compute_similarity(iri_a, "") would produce meaningless Jaccard similarity between an entity and an empty string. Zero is correct when no parent context exists.
- **SuggestionSessionStatus.AUTO_SUBMITTED.value = "auto-submitted"** (hyphen, not underscore) — Python StrEnum preserves literal value strings.
- **Test block verdict requires parent_iri**: With no parent_iri, max composite = 0.40 (exact) + 0.40 (semantic) = 0.80, exactly at the pass/warn boundary. Adding parent_iri enables structural score to push composite > 0.95.

## Deviations from Plan

None — plan executed exactly as written. The CRITICAL note about `rejected_iri` vs branch name was in the plan and implemented correctly.

## Issues Encountered

None.

## Known Stubs

None — all composite scoring logic is implemented. `GlossExtractionService` in 12-02 remains a stub but is not used by this plan.

## Next Phase Readiness

- Phase 13 (suggestion generation) can now call `POST /projects/{id}/duplicate-check` before submitting a suggestion
- Phase 14 (inline UX) can surface block/warn/pass to the user with score_breakdown transparency
- Rejection flow extended: when admin rejects with canonical_iri + entity_iri, the rejection is persisted for future duplicate checks

---
*Phase: 12-toolchain-integration-duplicate-detection*
*Completed: 2026-04-06*
