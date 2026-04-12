---
phase: 13-validation-guardrails-suggestion-generation
plan: "01"
subsystem: api
tags: [pydantic, validation, fastapi, owl, ontology, uuid, tdd]

# Dependency graph
requires:
  - phase: 12-toolchain-integration-duplicate-detection
    provides: DuplicateCheckService, DuplicateVerdict schemas, OntologyIndexService
  - phase: 11-roles-llm-abstraction-cost-controls
    provides: LLMProvider.chat(), budget, rate limiting infrastructure
provides:
  - Pydantic v2 schemas for suggestion generation and validation API contract (generation.py)
  - ValidationService with VALID-01..06 rules and IRI minting (validation_service.py)
  - mint_iri() and detect_project_namespace() utilities
  - 29 passing tests (17 schema + 12 validation)
affects: [13-02, 13-03, 13-04, 14-frontend-suggestion-ux]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Literal type aliases (not Enum) for discriminated schema types — consistent with duplicate_check.py"
    - "TDD RED-GREEN cycle: test file first (import error), then schema/service implementation"
    - "SQL-based cycle detection via get_ancestor_path() — lightweight pre-submit gate (not full OWL DFS)"
    - "Fail-open on DB errors in validation rules — consistent with rate_limiter.py pattern"

key-files:
  created:
    - ../ontokit-api/ontokit/schemas/generation.py
    - ../ontokit-api/ontokit/services/validation_service.py
    - ../ontokit-api/tests/unit/test_generation_schemas.py
  modified:
    - ../ontokit-api/tests/unit/test_entity_validation.py

key-decisions:
  - "CONTROLLED_RELATIONSHIP_TYPES defined as list[str] not Literal — allows runtime iteration without Literal exhaustion"
  - "VALID-03 cycle check uses OntologyIndexService.get_ancestor_path() not ReasonerService._detect_cycles_rdflib() — SQL CTE is the lightweight pre-submit gate per RESEARCH.md Pitfall 2"
  - "VALID-04 skips namespace check when entity_iri is empty/None — IRI minting happens after validation in the pipeline"
  - "detect_project_namespace falls back through: (1) provided IRI, (2) DB namespace count, (3) stable fallback URL"
  - "ValidationError is imported from schemas.generation not defined separately in validation_service — single source of truth for the type"

patterns-established:
  - "ValidationService._check_*() methods each return list[ValidationError] — allows short-circuit or full accumulation"
  - "entity dict shape: {label, parent_iris, labels, iri} — used by all downstream validators"

requirements-completed: [VALID-01, VALID-02, VALID-03, VALID-04, VALID-05, VALID-06]

# Metrics
duration: 5min
completed: 2026-04-07
---

# Phase 13 Plan 01: Validation Guardrails & Generation Schemas Summary

**Pydantic v2 API contract schemas and ValidationService with 4 rule methods (VALID-01..06) blocking orphan classes, missing English labels, hierarchy cycles, and foreign-namespace IRIs, plus UUID-based IRI minting**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-07T14:26:15Z
- **Completed:** 2026-04-07T14:31:28Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Created `generation.py` with 10+ Pydantic v2 schema classes: SuggestionType, Provenance, ValidationError, GeneratedSuggestion, EdgeSuggestion, AnnotationSuggestion, GenerateSuggestionsRequest/Response, ValidateEntityRequest/Response, plus CONTROLLED_RELATIONSHIP_TYPES (14 entries ported from generative-folio)
- Created `validation_service.py` with ValidationService (4 rule methods + orchestrator), mint_iri(), and detect_project_namespace() — all VALID-01..06 rules implemented
- Replaced all 11 Wave 0 stubs in test_entity_validation.py with real async tests; added 17 schema tests — 29 total new tests, 0 stubs

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Pydantic schemas for suggestion generation and validation** - `029d309` (feat)
2. **Task 2: Implement ValidationService with 6 rules + IRI minting, replace test stubs** - `220c88c` (feat)

_Both tasks used TDD RED-GREEN cycle: failing import test → schema/service implementation_

## Files Created/Modified

- `../ontokit-api/ontokit/schemas/generation.py` — Complete Phase 13 API contract: 10+ Pydantic schemas, CONTROLLED_RELATIONSHIP_TYPES
- `../ontokit-api/ontokit/services/validation_service.py` — ValidationService with VALID-01..06, mint_iri(), detect_project_namespace()
- `../ontokit-api/tests/unit/test_generation_schemas.py` — 17 schema tests (new file)
- `../ontokit-api/tests/unit/test_entity_validation.py` — 12 validation tests replacing all 11 Wave 0 stubs

## Decisions Made

- VALID-03 uses OntologyIndexService.get_ancestor_path() (SQL CTE), not ReasonerService._detect_cycles_rdflib() — the SQL BFS is the intended lightweight pre-submit gate; full OWL DFS is reserved for reasoner-level checks
- VALID-04 skips namespace check when entity_iri is empty or None — generation pipeline mints the IRI after validation passes, so pre-mint state is always exempt
- CONTROLLED_RELATIONSHIP_TYPES is a list[str], not a Literal alias — allows runtime iteration and membership testing without Literal type exhaustion at call sites
- ValidationError imported from schemas.generation in validation_service — single definition, not re-declared

## Deviations from Plan

None — plan executed exactly as written. Test counts: plan specified 11 tests for Task 2; implemented 12 (added one extra for empty-lang label acceptance). Both tasks followed TDD RED-GREEN as specified.

## Issues Encountered

None.

## Known Stubs

None — all generated code is fully implemented. No placeholder values, no TODO comments, no hardcoded empty returns.

## Next Phase Readiness

- generation.py schemas are the contract consumed by Plans 13-02 (context assembly), 13-03 (generation service), and 13-04 (API routes)
- ValidationService is ready to be called from the generation pipeline (D-09) and the standalone validate endpoint
- mint_iri() and detect_project_namespace() are ready for IRI assignment in the generation route (13-04)
- All 204 unit tests pass (29 new, 0 regressions)

---
*Phase: 13-validation-guardrails-suggestion-generation*
*Completed: 2026-04-07*
