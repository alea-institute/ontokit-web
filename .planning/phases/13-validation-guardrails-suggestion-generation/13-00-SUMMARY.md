---
phase: 13-validation-guardrails-suggestion-generation
plan: "00"
subsystem: testing
tags: [pytest, asyncio, tdd, stubs, validation, suggestion-generation, wave-0]

# Dependency graph
requires: []
provides:
  - 11 async pytest stubs for ValidationService (VALID-01..VALID-06)
  - 13 async pytest stubs for SuggestionGenerationService (GEN-01..GEN-09 + pipeline)
  - 6 async pytest stubs for OntologyContextAssembler
  - tests/unit/conftest.py with mock_llm_provider, mock_ontology_index, mock_duplicate_check_service fixtures
affects:
  - 13-01-PLAN (ValidationService implementation)
  - 13-02-PLAN (SuggestionGenerationService implementation)
  - 13-03-PLAN (API routes and frontend integration)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wave 0 stubs: @pytest.mark.skip(reason='Wave 0 stub — implementation in Plan 13-0X') on async def test_* functions"
    - "Unit conftest.py at tests/unit/ level for phase-scoped fixtures"

key-files:
  created:
    - "../ontokit-api/tests/unit/test_entity_validation.py"
    - "../ontokit-api/tests/unit/test_suggestion_generation.py"
    - "../ontokit-api/tests/unit/test_context_assembler.py"
    - "../ontokit-api/tests/unit/conftest.py"
  modified: []

key-decisions:
  - "Wave 0 stubs use @pytest.mark.skip decorator (not pytest.skip() in body) — consistent with Phase 11-12 established pattern in test_llm_config.py"
  - "Unit-level conftest.py created at tests/unit/ to scope Phase 13 fixtures without polluting top-level conftest.py"

patterns-established:
  - "Phase 13 mock pattern: mock_llm_provider returns ('json_string', 100, 50) tuple — matches chat() signature from Phase 11"
  - "Phase 13 mock pattern: mock_ontology_index exposes get_class_detail, get_class_children, get_ancestor_path as AsyncMock"

requirements-completed: [VALID-01, VALID-02, VALID-03, VALID-04, VALID-05, VALID-06, GEN-01, GEN-02, GEN-03, GEN-04, GEN-05, GEN-06, GEN-07, GEN-08, GEN-09]

# Metrics
duration: 2min
completed: 2026-04-07
---

# Phase 13 Plan 00: Validation Guardrails + Suggestion Generation — Wave 0 Test Stubs

**30 async pytest Wave 0 stubs across 3 files covering all VALID-01..06 and GEN-01..09 requirements, with unit-level conftest.py for Phase 13 mock fixtures**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-07T14:25:59Z
- **Completed:** 2026-04-07T14:28:00Z
- **Tasks:** 1
- **Files modified:** 4

## Accomplishments

- Created 11 async stub tests covering all VALID-01..VALID-06 requirements in `test_entity_validation.py`
- Created 13 async stub tests covering GEN-01..GEN-09 plus D-05/D-09 pipeline concerns and Pitfall 3/4 edge cases in `test_suggestion_generation.py`
- Created 6 async stub tests for OntologyContextAssembler in `test_context_assembler.py`
- Created `tests/unit/conftest.py` with `mock_llm_provider`, `mock_ontology_index`, `mock_duplicate_check_service` fixtures for reuse across Plans 13-01 and 13-02
- All 30 stubs collected by `pytest --co` (exit code 0), all skip cleanly, 162 existing tests remain green

## Task Commits

1. **Task 1: Create test stubs for ValidationService and SuggestionGenerationService** - `3b1874a` (test)

## Files Created/Modified

- `../ontokit-api/tests/unit/test_entity_validation.py` — 11 Wave 0 stubs for VALID-01..06
- `../ontokit-api/tests/unit/test_suggestion_generation.py` — 13 Wave 0 stubs for GEN-01..09 + pipeline
- `../ontokit-api/tests/unit/test_context_assembler.py` — 6 Wave 0 stubs for OntologyContextAssembler
- `../ontokit-api/tests/unit/conftest.py` — Unit-level fixtures: mock_llm_provider, mock_ontology_index, mock_duplicate_check_service

## Decisions Made

- Used `@pytest.mark.skip(reason="Wave 0 stub — implementation in Plan 13-0X")` decorator rather than `pytest.skip()` in function body — this matches the established pattern in Phase 11 (test_llm_config.py, test_llm_audit.py, etc.)
- Created `tests/unit/conftest.py` (new file) rather than adding to `tests/conftest.py` — scopes Phase 13 fixtures to unit tests only, avoids polluting integration test fixtures

## Deviations from Plan

None — plan executed exactly as written.

(Note: `test_generation_schemas.py` was found as a pre-existing untracked file in the repository, likely created by a parallel agent working on Plan 13-01. It was out of scope for this Wave 0 task and was not modified or committed.)

## Issues Encountered

None.

## Known Stubs

All 30 tests are intentional Wave 0 stubs. Each requires implementation in its designated downstream plan:
- `test_entity_validation.py` — 11 stubs, implementation in Plan 13-01
- `test_suggestion_generation.py` — 13 stubs, implementation in Plan 13-02
- `test_context_assembler.py` — 6 stubs, implementation in Plan 13-02

This is the intended purpose of Wave 0: guaranteeing test files exist before implementation begins (Nyquist compliance pattern).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plans 13-01 and 13-02 can now import and implement the stubs without test-discovery failures
- conftest.py fixtures are ready for both plans to use in their RED phase
- The established `@pytest.mark.skip` pattern is consistent with Phase 11-12 convention

---
*Phase: 13-validation-guardrails-suggestion-generation*
*Completed: 2026-04-07*
