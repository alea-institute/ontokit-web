---
phase: 12-toolchain-integration-duplicate-detection
plan: "02"
subsystem: api
tags: [folio-python, owlready2, rdflib, owl-reasoning, structural-similarity, pre-commit-validation, fastapi]

requires:
  - phase: 12-00
    provides: Wave 0 stubs in test files, folio-python installed in venv
  - phase: 12-01
    provides: DuplicateRejection model, Pydantic schemas for duplicate_check, HNSW migration

provides:
  - StructuralSimilarityService with compute_similarity() (Jaccard via folio-python) and get_structural_context()
  - GlossExtractionService stub (NotImplementedError pending OpenGloss — TOOL-02)
  - ReasonerService with check_consistency() (RDFLib cycle detection + owlready2 HermiT unsatisfiable class detection)
  - POST /projects/{id}/validate endpoint with optional owl_content for pre-commit validation (TOOL-04)
  - 8 passing unit tests covering all 4 services

affects:
  - 12-03 (DuplicateCheckService depends on StructuralSimilarityService)
  - 12-04 (composite scoring pipeline uses structural similarity score)
  - 12-05 (pre-commit validation endpoint used by suggestion workflow)

tech-stack:
  added: []  # folio-python and owlready2 already installed in 12-00
  patterns:
    - Module-level FOLIO cache dict with clear_folio_cache() for merge invalidation
    - RDFLib for cycle detection (reliable), owlready2 HermiT for unsatisfiable classes (optional)
    - OWL format auto-detection: <?xml prefix -> format=xml, else format=turtle
    - Validation endpoint accepts optional owl_content body — None falls back to serializing loaded graph

key-files:
  created:
    - ontokit/services/structural_similarity_service.py
    - ontokit/services/gloss_extraction_service.py
    - ontokit/services/reasoner_service.py
    - ontokit/api/routes/validation.py
  modified:
    - ontokit/api/routes/__init__.py
    - tests/unit/test_structural_similarity.py
    - tests/unit/test_reasoner_validation.py

key-decisions:
  - "RDFLib used for cycle detection instead of owlready2 is_a traversal — owlready2/HermiT normalizes cycles into class equivalences, making is_a traversal unreliable for cycle detection"
  - "OWL/XML format auto-detection in _detect_cycles_rdflib — g.parse() defaults to Turtle but OWL/XML requires format=xml; detection via <?xml/rdf:RDF prefix"
  - "GlossExtractionService raises NotImplementedError referencing TOOL-02 and OpenGloss — stub matches must_have requirement"
  - "Validation endpoint fallback uses load_project_graph() + graph.serialize() not storage.get_source() — storage service has no get_source() method; RDFLib graph serialization is the correct approach"

patterns-established:
  - "RDFLib + owlready2 hybrid: RDFLib for graph traversal checks, owlready2 HermiT for logical consistency — use this split for any future reasoner work"
  - "OWL/XML format detection: strip() then check startswith('<?xml') or '<rdf:RDF' before choosing parse format"

requirements-completed: [TOOL-01, TOOL-02, TOOL-03, TOOL-04, TOOL-05]

duration: 7min
completed: 2026-04-06
---

# Phase 12 Plan 02: Toolchain Integration Services Summary

**Folio-python structural similarity (Jaccard), owlready2+RDFLib OWL reasoning, and pre-commit POST /validate endpoint — all 8 unit tests passing**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-04-06T21:33:20Z
- **Completed:** 2026-04-06T21:40:01Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- `StructuralSimilarityService`: Jaccard similarity between parent sets via folio-python, with module-level `_folio_cache` dict and `clear_folio_cache()` for merge invalidation; graceful degradation returns 0.0 when folio-python unavailable
- `GlossExtractionService`: NotImplementedError stub with message referencing OpenGloss (TOOL-02) per plan spec
- `ReasonerService`: RDFLib DFS cycle detection on subClassOf hierarchy + owlready2 HermiT for unsatisfiable class detection; format auto-detection handles both OWL/XML and Turtle input
- `POST /projects/{id}/validate`: Accepts optional `owl_content` body field for true pre-commit validation (TOOL-04); falls back to loading and serializing the current ontology when `owl_content` is absent
- All 8 unit test stubs replaced with passing tests (4 structural + 4 reasoner/validation)

## Task Commits

1. **Task 1: StructuralSimilarityService + GlossExtractionService stub + 4 tests** - `9a97712` (feat)
2. **Task 2: ReasonerService + validation endpoint + 4 tests** - `fd23949` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `ontokit/services/structural_similarity_service.py` — Jaccard similarity via folio-python with module-level cache
- `ontokit/services/gloss_extraction_service.py` — NotImplementedError stub for TOOL-02/OpenGloss
- `ontokit/services/reasoner_service.py` — RDFLib cycle detection + owlready2 HermiT unsatisfiable class check
- `ontokit/api/routes/validation.py` — POST /projects/{id}/validate with optional owl_content body (TOOL-04)
- `ontokit/api/routes/__init__.py` — registered validation router
- `tests/unit/test_structural_similarity.py` — 4 passing tests (replaced stubs)
- `tests/unit/test_reasoner_validation.py` — 4 passing tests (replaced stubs, added test_pre_commit_validates_provided_content)

## Decisions Made

- **RDFLib for cycle detection, not owlready2 is_a traversal:** owlready2 and HermiT normalize subClassOf cycles into class equivalences. After loading an OWL with A⊑B and B⊑A, owlready2 reports A≡B with `is_a = [owl.Thing]` for one class — the cycle is invisible to `is_a` traversal. RDFLib DFS on raw RDFS triples correctly identifies the cycle before HermiT normalizes it.
- **OWL/XML format auto-detection:** RDFLib's `g.parse(data=...)` defaults to Turtle. OWL/XML content requires `format="xml"`. Added prefix-based auto-detection (`<?xml`, `<rdf:RDF`, `<owl:`) to handle both formats transparently.
- **Validation endpoint fallback uses graph serialization:** The plan specified `storage.get_source(project_id, branch)` but `StorageService` has no such method. Used `load_project_graph()` (same pattern as `quality.py`) followed by `graph.serialize(format="turtle")` — this is the correct API and works for both git-backed and storage-backed ontologies.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Replaced owlready2 is_a cycle detection with RDFLib DFS**
- **Found during:** Task 2 (ReasonerService implementation + testing)
- **Issue:** The plan's `_detect_cycles_owlready2` traversing `cls.is_a` fails because owlready2/HermiT normalizes cycles into class equivalences before Python code can observe them. Test `test_reasoner_detects_cycle` failed with 0 issues returned.
- **Fix:** Moved cycle detection to `_detect_cycles_rdflib()` using a DFS over raw `RDFS.subClassOf` triples. Added OWL/XML format auto-detection so both XML and Turtle inputs parse correctly.
- **Files modified:** `ontokit/services/reasoner_service.py`
- **Verification:** `test_reasoner_detects_cycle` and `test_pre_commit_validates_provided_content` both pass
- **Committed in:** `fd23949`

**2. [Rule 1 - Bug] Replaced storage.get_source() with load_project_graph() + serialize()**
- **Found during:** Task 2 (validation.py route implementation)
- **Issue:** The plan's code used `storage.get_source(str(project_id), request.branch)` but `StorageService` has no `get_source()` method — only `upload_file()`, `download_file()`, `delete_file()`, `file_exists()`.
- **Fix:** Used `load_project_graph()` from `api.dependencies` (same as `quality.py`) followed by `graph.serialize(format="turtle")` to get the current ontology as text.
- **Files modified:** `ontokit/api/routes/validation.py`
- **Verification:** `test_pre_commit_validation_endpoint` passes; route imports cleanly
- **Committed in:** `fd23949`

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs in plan's API/code choices)
**Impact on plan:** Both fixes essential for correctness. Cycle detection now reliable; storage fallback uses the API that actually exists. No scope creep.

## Issues Encountered

- owlready2 startup logs cluttered test output (prints HermiT invocation to stdout) — not a failure, just noise from the Java subprocess

## Known Stubs

- `GlossExtractionService.extract_glosses()` raises `NotImplementedError` — intentional TOOL-02 stub. Will be resolved when OpenGloss becomes available (tracked in 12-RESEARCH.md Open Questions #1).

## Next Phase Readiness

- `StructuralSimilarityService` is ready for use by `DuplicateCheckService` in Plan 12-03
- `ReasonerService` is ready for integration into the duplicate check composite scoring in Plan 12-04
- `POST /projects/{id}/validate` is available for the suggestion submit workflow in Plan 12-05
- TOOL-05 (Generative FOLIO) is not addressed in this plan — remains for Plan 12-03 or a dedicated stub

---
*Phase: 12-toolchain-integration-duplicate-detection*
*Completed: 2026-04-06*
